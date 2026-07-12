# Notes for AI assistants

This file exists so you don't accidentally "clean up" the things that
make the system work. Read it before touching certificate verification,
data retention, or the legacy `/verify` route.

Companion docs (read as needed):

- `docs/ARCHITECTURE.md` — system map: stack, data model, the three core
  flows, security model, and things that look wrong but are deliberate.
- `docs/DEVELOPMENT.md` — commands, verification checklist, conventions
  (strings/i18n pattern, API route pattern, migrations workflow, test
  placement), and the gotchas that have cost real time.
- `docs/ROADMAP.md` — parked work with the reasoning captured, so options
  don't get re-litigated or rebuilt by accident.

Keep all four documents truthful in the SAME commit as any change that
affects what they say.

## Security model: the hash IS the certificate

The point of attester.no is to prove a certificate exists without storing
what it says.

Data flow:

1. A volunteer submits their info via the public form (`/org/<slug>`).
2. An admin reviews the submission and clicks "Generer PDF". The PDF
   contains a QR code pointing to
   `/org/<slug>/verify?t=<template_id>&id=<vol_id>&name=&group=&...`.
3. The server stores ONLY: `cert_id`, `hash(URL params)`, `template_id`,
   `organization_id`, `created_at`. Never the name, dates, group, role, or
   any other identifying field.
4. The submission row is deleted automatically by the retention sweep
   24 hours after it was created — whether or not a certificate was
   issued. The window exists so the admin can regenerate the PDF if
   something went wrong; the certificates POST is idempotent per
   submission (a re-issue returns the existing cert row).
5. To verify: anyone with the QR code opens the URL. The verify page
   recomputes the canonical hash from the URL params, fetches the stored
   hash from the API, compares them.

**Consequence:** if the database is leaked, no personal data leaks. The
server cannot answer "what was on Ola Nordmann's certificate" because it
doesn't know who Ola Nordmann is or what was attested. Only the bearer of
the printed PDF (or its QR URL) has that information.

### What this rules out

Do NOT add any of the following:

- Logging or audit columns that contain volunteer fields (name, group,
  dates, role, etc.).
- A "snapshot the cert data onto the certificate row" mechanism — this
  defeats the entire privacy design.
- A background job that reads certificate data and does anything with it.
- Any feature that re-derives "who was this cert about" from server state
  alone.

What IS acceptable:

- An audit log row recording "user X issued cert &lt;id&gt; at time T"
  with no payload describing what the cert says. Low priority, but allowed.

### Volunteer deletion

Deletion is automatic and TIME-based, not issuance-based (product
decision 2026-07-12: admins need to regenerate a PDF within a window
after issuing). The single deletion mechanism is the lazy retention
sweep (`src/lib/server/retention.ts`, TTL in `src/util/retention.ts`):
every submission is deleted 24 hours after creation, issued or not,
whenever the submissions API is touched. No scheduler exists on the
edge runtime, and none is needed — if nothing triggers the sweep,
nothing is reading the data either. Do NOT remove the sweep calls from
the submissions GET/POST routes; they are the entire privacy guarantee
for unprocessed data.

Issuing a certificate does NOT delete the submission. The certificates
POST is idempotent per submission (re-issue returns the existing cert),
so "Generer PDF" can be clicked again within the window without minting
duplicate cert rows. The admin UI keeps its per-submission "Slett data"
button and the batch one for deleting early.
Storing volunteer data beyond the TTL is NOT acceptable — do not extend
the TTL without a deliberate product decision.

## The legacy `/verify` route

Echo issued certificates before the multi-org migration. Their QR codes
point to `/verify?<positional underscore-joined string>` and were already
physically printed onto PDFs that are in the wild. We cannot change those
QR codes — paper has been printed.

So the legacy route stays, untouched, **until approximately 2030** (when
echo decides no pre-migration certificate is still relevant). Do not
delete or refactor any of the files below before then.

Files that exist solely for legacy back-compat:

- `src/app/verify/page.tsx` — legacy verify page (positional URL parser).
- `src/app/api/certificates/verify/route.ts` — reads from the
  `legacy_certificates` table.
- `src/app/login/adminpage/generateParams.ts` — old positional hash
  input builder. Not used at issuance anymore, kept as a record of the
  legacy URL contract.
- `src/util/hashFunction.ts` — old SHA-512 over the positional string.
  Not used at issuance anymore.

The `legacy_certificates` table is a one-time snapshot taken during the
multi-org migration. **No new rows are ever inserted by the app.** Only
the historical echo certs live there.

### Do NOT "unify" the verify routes

Tempting refactor: "let's make `/verify` and `/org/<slug>/verify` share
code." Don't. The two routes have:

- Different URL formats (positional vs key=value).
- Different hash algorithms (over the positional string vs over the
  sorted key=value params).
- Different backing tables (`legacy_certificates` vs `certificates`).

Sharing code couples two contracts that need to evolve independently
(and the legacy one needs to *not* evolve at all).

## Per-template architecture

Templates are **immutable**. Editing a template creates a new row. The
cert URL embeds `t=<template_id>` so a verifier always knows exactly
which template was used to render the original PDF.

Consequence: editing a template (= inserting a new row) does NOT
invalidate any already-issued certificates, because the old template row
still exists and the old certs reference it by id.

`is_default` lets one template per org be the default selection on the
admin "Generer PDF" UI. Saving a new template with `is_default=true`
flips the previous default off (handled in the templates POST route).

The cert hash deliberately **excludes** `t` (template id) from the hash
inputs — `canonicalHash` drops it before sorting. This means the hash
covers the verifiable data only, not the presentation choice. A
historical cert keeps verifying even if you delete the template row it
points to (which you shouldn't, but the hash would still match).

## Canonical hash format

Single source of truth: `src/util/canonicalHash.ts` + `src/util/certParams.ts`.

Algorithm:
1. Build a `URLSearchParams` from the cert fields (issuer side: see
   `buildCertParams`).
2. Drop `t` from the params.
3. Sort the remaining entries by key, ascending.
4. Join as `key=value&key=value&...`.
5. SHA-512 hex over that UTF-8 byte sequence.

Issuer (`submitHash`), verifier (`OrgVerifyClient`), and seed scripts
all import from these utilities. Do NOT inline the algorithm anywhere
else — drift will silently invalidate certificates.

### Future idea: version-tag the hash

Today every cert is bound to v1 of the algorithm above — we cannot
change the param shape, the encoding, or the digest without invalidating
every cert in the wild. If a future change becomes necessary (add a
field that participates in the hash, change canonicalisation, swap
SHA-512 for something else), the escape hatch is to include a `v=2`
slot in the cert URL **and** in the hash inputs. The verifier reads
`v`, dispatches to the right algorithm. Old certs (no `v`) keep using
v1 forever; new certs get the new algorithm. Storing the `v` on the
certificates row (alongside the hash) lets the verifier route without
trusting the URL.

NOT implemented today and deliberately not added preemptively — the
dispatch costs nothing once we actually need v2, and adding it before
we need it is dead code. Captured here so the door stays visible.

## Org assets are the per-org content library

The `organizations` row carries identity only (id, slug, name). All
per-org content — signatures, logos, body-text blocks, lookup lists —
lives in `org_assets` keyed by `(organization_id, kind)`.

Kinds and their `content` jsonb shapes:

- `signature` — `{ photo, role, phone }` (the row's `name` column holds the
  person's name).
- `logo` — `{ image }` (row's `name` holds a human label).
- `body_text` — `{ text }` (row's `name` holds a block title).
- `lookup_list` — `{ items: [{ name, description, ... }] }` (row's `name`
  holds the list title).

`is_default` marks which assets are auto-picked when a template binding
asks for the "default" of a kind (e.g. "first default signature").
`sort_order` orders the defaults.

### Do NOT re-add per-org columns

The migration in `scripts/migrations/2026-05-org-assets.sql` deleted
the old columns `signatures`, `groups`, `generic_text` from
`organizations`. Adding a new echo-specific column is a regression —
put it in the asset library as a new kind, or extend an existing
kind's content jsonb.

## Templates' field_bindings drive PDF rendering

Every template carries a `field_bindings` jsonb column mapping pdfme
schema field names to a data source:

- `system` — qr_code, qr_info, qr_page, today
- `submission` — a key in the volunteer's submission data
- `composite` — a string template with `{key}` placeholders; `{key:date}`
  formats dates; optional `requireAll` blanks the field if any listed
  submission key is missing
- `asset` — a specific asset by id (+ optional `subField` to pick a
  jsonb path like `photo`, `text`, `image`)
- `asset_default` — the Nth default asset of a given kind (so an admin
  swap of "current Leder" propagates automatically)
- `lookup` — find an item in a lookup_list by matching its `name`
  against a submission key, return the named sub-field

The resolver is `src/util/resolveBinding.ts`. The single PDF-input
builder is `buildPdfInput` in the same file.

### Implicit fallback

If a pdfme field has NO binding, the resolver looks for a submission key
of the same name. This is what lets simple templates ("PDF field name =
form field name") work without any binding configuration.

### Do NOT inline per-template rendering logic

The old `getPDFInput.tsx` had hardcoded echo-specific composite logic
(`student_role`, `verv_1`, `group_info`, …). All of that is gone. New
per-org PDF rules go into `field_bindings` (data in the DB), not code.

## Form fields

`FormFieldSchema` types: `text | date | dropdown | long_text | number`.
Dropdowns can specify static `options` or `optionsFromAsset` (a
`lookup_list` id). The public template API (`templates/[id]` and
`default-template`) resolves `optionsFromAsset` → `options` so the
volunteer sees a static dropdown without ever seeing the asset id.

The Designer page's `SchemaEditor` lets admins edit the form_schema; the
`fromPdfmeTemplate` helper auto-derives a starter schema from the
pdfme placeholder names when the admin hasn't set one.

## Mandatory PDF elements

`validateTemplateForSave` (`src/util/validateTemplate.ts`) is run by the
designer before save and refuses templates without:

- A `qrcode` field (so certs are verifiable).
- A text field whose default `content` includes "attester.no" (the
  platform fingerprint, by user request).

Placement is the admin's choice. Removing this validation defeats the
constraint the user explicitly asked for.

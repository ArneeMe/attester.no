# Notes for AI assistants

This file exists so you don't accidentally "clean up" the things that
make the system work. Read it before touching certificate verification,
data retention, or the legacy `/verify` route.

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
4. The admin deletes the volunteer row (manual today; meant to happen
   immediately after PDF issuance).
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

The admin UI has a per-volunteer "Slett data" button and a batch one. The
intended workflow is: generate PDF → confirm everything looks right →
delete the volunteer. Automating this deletion (e.g. on successful cert
insertion) is a reasonable future change. Storing volunteer data
indefinitely is NOT.

## The legacy `/verify` route

Echo issued certificates before the multi-org migration. Their QR codes
point to `/verify?<positional underscore-joined string>` and were already
physically printed onto PDFs that are in the wild. We cannot change those
QR codes — paper has been printed.

So the legacy route stays, untouched, forever (or until echo decides no
pre-migration certificate is still relevant — likely years from now).

Files that exist solely for legacy back-compat:

- `src/app/verify/page.tsx` — legacy verify page (positional URL parser).
- `src/app/api/certificates/verify/route.ts` — reads from the
  `legacy_certificates` table.
- `src/app/login/adminpage/generateParams.ts` — old positional hash
  input builder. Not used at issuance anymore.
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

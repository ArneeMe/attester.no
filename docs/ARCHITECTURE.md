# Architecture

A map of how attester.no fits together. For the privacy invariants that must
never be broken, read [CLAUDE.md](../CLAUDE.md) first — this file explains
*how* things work, that one explains *what must stay true*.

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend + API | Next.js 15 App Router, React 19, MUI 7 | Every route exports `runtime = 'edge'` |
| Hosting | Cloudflare Pages via `@cloudflare/next-on-pages` | No Node APIs, no schedulers, no shared memory between isolates |
| Database | Postgres via Hasura GraphQL (Nhost) | App talks to Hasura with the **admin secret**; tenancy is enforced in app code, NOT in Hasura permissions |
| Auth | Nhost Auth (email/password) | JWT verified server-side with `jose` against remote JWKS |
| PDF | pdfme 5, generated **client-side** in the admin's browser | Volunteer data never makes an extra server hop for rendering |

## Core data model

- `organizations` — identity only (id, slug, name). Never add content columns.
- `user_organizations` — who administers which org. All members are equal.
- `org_assets` — per-org content library keyed by `(organization_id, kind)`:
  `signature`, `logo`, `body_text`, `lookup_list`. Images are base64 data URLs
  inside the jsonb (known cost trade-off, see ROADMAP).
- `templates` — **immutable** pdfme layouts + `form_schema` (the volunteer
  form) + `field_bindings` (how each PDF field gets its value). Editing
  creates a new row; certs reference the exact row they used.
- `submissions` — volunteer data awaiting review. `issued_at` is stamped when
  a certificate is issued and is the deletion clock: the retention sweep
  removes rows whose `issued_at` is older than `ISSUED_RETENTION_HOURS`.
  Unissued rows (`issued_at IS NULL`) are never swept — they wait for the
  admin. See CLAUDE.md "Volunteer deletion".
- `certificates` — id, `submission_id` (opaque lookup key from the QR URL's
  `id=` param — NOT a personal reference), `hash`, `template_id`,
  `organization_id`, `issued_by`, `created_at`. Never anything personal.
- `invites` — 7-day tokens; redemption requires session email == invited email.
- `legacy_certificates` — frozen pre-migration echo certs (until ~2030).

## The three core flows

### 1. Submit
`/org/[slug]` → public form (schema from the chosen offered template) →
`POST /api/org/[slug]/submissions` (size-capped, flat-string-shape enforced,
template-ownership-checked) → row in `submissions` with `issued_at` NULL.

Nothing notifies the admin: there is no email and no pending-count badge, so
an org has to remember to check its queue. Unissued rows are never
auto-deleted, so nothing is lost — but see ROADMAP, this gap is known.

### 2. Issue
Admin dashboard → "Generer PDF" → `submitHash` computes the canonical hash
client-side (`src/util/canonicalHash.ts`) and `POST /api/org/[slug]/certificates`
stores it (idempotent per submission; records `issued_by`). The same mutation
stamps `submissions.issued_at`, so a certificate can never exist without its
deletion clock started. The PDF renders in the browser (`buildAttestPdfBlob`)
with a QR pointing at
`/org/[slug]/verify?t=<template>&id=<submission>&<fields...>`.

The submission then survives for `ISSUED_RETENTION_HOURS` so the PDF can be
regenerated (lost file, misprint, late-spotted typo); the retention sweep
(`src/lib/server/retention.ts`) removes it on the next touch of the
submissions API. Re-issuing does **not** re-stamp `issued_at`, so
regenerating can't extend retention.

### 3. Verify
Anyone opens the QR URL → `OrgVerifyClient` recomputes the hash from the URL
params (dropping `t`, sorting keys, SHA-512) and compares with the stored
hash fetched by `submissionId`. Match ⇒ green. The database never learns what
was attested; the URL carries the data.

Which params feed the hash is narrowed by `selectHashFields`
(`src/util/verifyFieldSelection.ts`): once the template's `form_schema` is
loaded, only its declared field keys (plus `id`) count. That makes the
verifier immune to incidental params — the `lang` UI switch, or the
`utm_*`/`fbclid` junk that messaging apps append to shared links — which
would otherwise change the digest and show a genuine certificate as invalid.
The language toggle on this page is deliberately local React state, never a
URL param, for the same reason.

## Security model

- **Server is the only boundary.** Client-side guards are UX, not security.
- Every org-scoped route calls `requireOrgMemberBySlug` (`src/lib/server/apiAuth.ts`):
  verify JWT → resolve slug → check `user_organizations`. Object ownership is
  double-checked (`src/lib/server/ownership.ts`) when ids come from the client.
- Platform-level actions (`/api/admin/*`) additionally require the caller's
  `auth.users` email to be on the `PLATFORM_ADMIN_EMAILS` env allowlist
  (`src/lib/server/platformAdmin.ts`). Unset ⇒ surface disabled.
- `UNLISTED_ORG_SLUGS` (a constant in `src/util/orgVisibility.ts`, applied in
  `listPublicOrgs`) hides orgs from the front-page picker and the sitemap.
  Edit the list and deploy. It is a **discovery** filter, not access control:
  `/org/<slug>` still serves an unlisted org, by design, so test orgs stay
  testable. Never treat an unlisted slug as secret.
- The anonymous submissions POST is size-capped (64 KB body, per-field
  length limit) and enforces a flat string→string data shape. There is no
  rate limiter: the in-memory one was dropped because per-isolate state on
  the edge runtime made it best-effort theatre. See ROADMAP if abuse ever
  becomes real.
- All Hasura access goes through `hasuraAdmin()` (`src/lib/server/hasura.ts`)
  with GraphQL **variables only** — never interpolate values into query text.

## Things that look wrong but are deliberate

- Two verify routes (`/verify` legacy vs `/org/[slug]/verify`) that share no
  code — printed QR codes froze the legacy contract. See CLAUDE.md.
- `certificates.submission_id` survives submission deletion — it is the
  verify lookup key, not a dangling personal reference.
- The hash excludes `t` (template id) — presentation is not attested content.
- No Hasura row-level permissions — tenancy lives in app code by design;
  every new route MUST call the guards.
- No cron anywhere — the retention sweep is lazy on purpose. The edge runtime
  has no scheduler, and none is needed: the deletion window only starts when
  an admin issues a certificate, and admin activity is exactly what triggers
  the sweep.
- Unissued submissions have no expiry. Deleting a volunteer's application
  before a human read it is worse than holding it, so the sweep's
  `issued_at IS NOT NULL` guard is load-bearing (product decision, 2026-08).
- No `/personvern` page. Publishing a privacy policy is a legal commitment
  the owner isn't in a position to make yet; `/om` explains the mechanics
  factually instead.

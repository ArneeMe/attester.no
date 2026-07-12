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
- `submissions` — transient volunteer data. Deleted by the retention sweep
  24h after creation, no exceptions.
- `certificates` — id, `submission_id` (opaque lookup key from the QR URL's
  `id=` param — NOT a personal reference), `hash`, `template_id`,
  `organization_id`, `issued_by`, `created_at`. Never anything personal.
- `feedback` — anonymous rating + comment per org. No identity by design.
- `invites` — 7-day tokens; redemption requires session email == invited email.
- `legacy_certificates` — frozen pre-migration echo certs (until ~2030).

## The three core flows

### 1. Submit
`/org/[slug]` → public form (schema from the org's default template) →
`POST /api/org/[slug]/submissions` (rate-limited per IP, size-capped,
template-ownership-checked) → row in `submissions` → optional content-free
email to admins (`notify.ts`, Resend, opt-in via env).

### 2. Issue
Admin dashboard → "Generer PDF" → `submitHash` computes the canonical hash
client-side (`src/util/canonicalHash.ts`) and `POST /api/org/[slug]/certificates`
stores it (idempotent per submission; records `issued_by`). The PDF renders
in the browser (`buildAttestPdfBlob`) with a QR pointing at
`/org/[slug]/verify?t=<template>&id=<submission>&<fields...>`. The submission
stays until its 24h TTL so the PDF can be regenerated; the retention sweep
(`src/lib/server/retention.ts`) deletes it whenever the submissions API is
next touched.

### 3. Verify
Anyone opens the QR URL → `OrgVerifyClient` recomputes the hash from the URL
params (dropping `t`, sorting keys, SHA-512) and compares with the stored
hash fetched by `submissionId`. Match ⇒ green. The database never learns what
was attested; the URL carries the data.

## Security model

- **Server is the only boundary.** Client-side guards are UX, not security.
- Every org-scoped route calls `requireOrgMemberBySlug` (`src/lib/server/apiAuth.ts`):
  verify JWT → resolve slug → check `user_organizations`. Object ownership is
  double-checked (`src/lib/server/ownership.ts`) when ids come from the client.
- Platform-level actions (`/api/admin/*`) additionally require the caller's
  `auth.users` email to be on the `PLATFORM_ADMIN_EMAILS` env allowlist
  (`src/lib/server/platformAdmin.ts`). Unset ⇒ surface disabled.
- Anonymous endpoints (submissions POST, feedback POST) are rate-limited
  per IP (`src/lib/server/rateLimit.ts` — in-memory per isolate, best-effort)
  and size-capped.
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
- No cron anywhere — the retention sweep is lazy on purpose (edge runtime
  has no scheduler; if nobody triggers the sweep, nobody is reading data).

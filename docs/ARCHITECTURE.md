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
- `org_requests` — organisations asking to be set up, pending until a platform
  admin approves or rejects. `org_number` (organisasjonsnummer) is optional:
  many student societies and local chapters are not registered. Contact
  details here are business records, not volunteer data, so the retention
  sweep does not touch them and handled rows are kept.
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

## The design layer

Two styling systems coexist, deliberately.

**The landing layer** — `src/app/style/tokens.ts` (colours, spacing, type
scales) plus `src/components/landing/*`. Hand-built, warm paper background,
serif wordmark. `SiteHeader` is the single header for the whole site:
`LandingHeader` wraps it for public pages, `SignedInShell` wraps it for
`/login/adminpage/**` and `/admin`. They share one component so the two sides
cannot drift apart.

**Stock MUI** — everything inside an admin page: forms, tables, dialogs. The
theme (`src/app/style/customTheme.ts`) derives its palette from the same
tokens, so the two do not clash, but they are not the same system.

Where the line currently falls: `/`, `/om` and `/ny-organisasjon` are fully
landing-layer; the verify client uses tokens but is hand-rolled; the chrome
around every signed-in page is landing-layer while its contents are MUI. The
volunteer form and the four auth pages are still entirely MUI.

**Do not reach for stock MUI when adding a public page** — use `PageShell`.
Inside admin, MUI is correct until someone decides otherwise; converting a
page is a deliberate act, not a drive-by.

Typography variants in the theme must not hardcode `color`: `body1`/`body2`
inherit, and a fixed colour there once overrode a contained button's
`contrastText` through a nested `Typography`, making button labels
unreadable. `customTheme.test.ts` pins that.

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
- There are exactly **two** unauthenticated write paths. The second is
  `POST /api/org-requests`, where an organisation asks to be set up. Same
  shape of defence as the submissions POST — body cap, per-field caps, strict
  string validation (`src/util/orgRequest.ts`) — plus a honeypot field that
  returns the same success a real submission gets, so a bot has nothing to
  tune against. It writes a `pending` row and nothing else: creating the
  organisation requires a platform admin approving it at `/admin`, where the
  slug can be edited first — that edit is the veto on a squatted or
  misleading one.
- **Nobody self-serves an organisation.** Approval is manual because the slug
  is a permanent public URL and the product's value rests on an attest being
  verifiable — an unvetted org issuing official-looking certificates attacks
  the core proposition, not just the signup flow. Approving mints an invite
  rather than attaching a member, so the applicant needs no prior account and
  a leaked link still grants nothing (redeem requires the session email to
  match).
- All Hasura access goes through `hasuraAdmin()` (`src/lib/server/hasura.ts`)
  with GraphQL **variables only** — never interpolate values into query text.

### Client session lifetime

The admin area calls our own API routes with a header built by `authHeader()`
(`src/lib/nhost.ts`), not through Nhost's HTTP clients — so the SDK's automatic
token refresh, which is installed on those clients, never runs. Without help the
access token simply expires (~15 min) while the refresh token stays valid for
weeks, and every request 401s.

`useSessionKeepAlive()` (`src/util/auth.ts`) is that help: it refreshes on
mount, on an interval, and whenever the tab becomes visible again — the last one
being the case that actually bites, a tab left open overnight. It reports the
session as expired only when the SDK has discarded the stored session, because a
null refresh result also covers the auth endpoint being briefly unreachable.

`UserOrgsProvider` carries a four-way `status` (`loading` / `ok` /
`unauthenticated` / `error`) rather than an org array that is empty for all
three failure modes. That distinction is load-bearing: collapsing a 401 into an
empty list is what once made an expired session render as a fully working admin
shell saying "you are not connected to any organization yet". If you add a state
here, keep the failure modes distinguishable.

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

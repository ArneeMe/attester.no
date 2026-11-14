# Architecture

A map of how attester.no fits together. For the privacy invariants that must
never be broken, read [CLAUDE.md](../CLAUDE.md) first — this file explains
*how* things work, that one explains *what must stay true*.

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 15 App Router, React 19, MUI 7 in `apps/web` | On Cloudflare Pages via `@cloudflare/next-on-pages`. Every route exports `runtime = 'edge'` |
| API | `apps/api`, plain `Request` → `Response` handlers | A long-running Node process in a container (`Dockerfile`). Bundled to one file with esbuild. Locally: `npm run dev -w @attester/api` |
| Shared code | `packages/shared` | Hash, validation, types. Imported by web and API as `@attester/shared/...` |
| Database | Postgres via Hasura GraphQL (Nhost) | Only the API talks to Hasura, with the **admin secret**; tenancy is enforced in API code, NOT in Hasura permissions |
| Auth | Nhost Auth (email/password) | JWT verified server-side with `jose` against remote JWKS |
| PDF | pdfme 5, rendered by the API (`apps/api/src/issuance/`) | The server already holds the submission until issuance. The PDF is returned, never stored |

## How a request travels

```
browser or app ──► attester.no/api/v1/<path>      apps/web/src/app/api/v1/[...path]
                     │  forwards, holds no secret
                     ▼
                   API_URL/<path>                  apps/api/src/server.ts
                     │  apps/api/src/app.ts picks the route
                     ▼
                   Hasura (admin secret)
```

- The route table is `apps/api/src/app.ts`. One file per route in
  `apps/api/src/routes/`, exporting `GET`/`POST`/... like a Next route.
- `server.ts` is the only file that knows it is a Node server. It serves
  `/v1/*`, answers `/healthz`, caps request bodies at `MAX_BODY_BYTES` and
  starts the scheduler.
- The forwarder in the web app keeps browser calls same-origin, so the API
  needs no CORS. A mobile app can call the container directly.
- Links the API hands out (QR codes, invite and notice emails) are built from
  `PUBLIC_APP_URL`, never from the request. The Host header is the caller's to
  choose.
- The web app keeps exactly one database call of its own: the frozen legacy
  route `apps/web/src/app/api/certificates/verify/route.ts`. That is why
  `apps/web/src/lib/server/hasura.ts` and `apiError.ts` still exist there and
  the web app still needs `NHOST_ADMIN_SECRET` until ~2030.
- Server components fetch through `apps/web/src/lib/publicOrgs.ts`.

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
- `notices` — outbox for emails to an org's admins. Organisation id and kind
  only; see "Channels and the outbox".
- `org_settings` — per-org switches (`digipost_enabled`). `organizations`
  stays identity only.
- `submission_recipients` — a sealed fødselsnummer for Digipost, apart from
  the certificate data. Deleted on delivery or with the submission.
- `deliveries` — delivery queue and record. Holds a sealed PDF only while
  queued.
- `platform_errors` — the platform's own failures, one row per distinct
  error. No caller, no payload; see "Logs and errors".
- `org_requests` — organisations asking to be set up, pending until a platform
  admin approves or rejects. `org_number` (organisasjonsnummer) is optional:
  many student societies and local chapters are not registered. Contact
  details here are business records, not volunteer data, so the retention
  sweep does not touch them and handled rows are kept.
- `legacy_certificates` — frozen pre-migration echo certs (until ~2030).

## The three core flows

### 1. Submit
`/org/[slug]` → public form (schema from the chosen offered template) →
`POST /api/v1/org/[slug]/submissions` (size-capped, flat-string-shape enforced,
template-ownership-checked) → row in `submissions` with `issued_at` NULL.

The answer carries a `statusToken`, shown to the volunteer once as a link:
`/org/[slug]/status#<token>`. That page (`StatusClient`) posts the token to
`POST /api/v1/org/[slug]/status` and gets dates back: sent in, issued, sent
to Digipost, deleted. Once the request has waited three days it offers
"send reminder", which queues the same notice a new submission does
(`routes/statusRemind.ts`). The rules are in CLAUDE.md "The volunteer's
status link".

The same request queues a notice for the organisation and tries to send it:
one email to the org's admins saying a request is waiting, with a link to the
dashboard and nothing about the volunteer. See "Channels and the outbox".
Without an email provider configured nothing is queued. The admin still sees
how many submissions wait: `GET /me/organizations` carries a `pending` count
per organisation, shown in the menu and the organisation picker.

### 2. Issue
Admin dashboard → "Generer PDF" →
`POST /api/v1/org/[slug]/submissions/[id]/issue`. The server
(`apps/api/src/issuance/issue.ts`) loads the submission, its template
and the org's assets, renders the PDF, computes the canonical hash
(`packages/shared/src/canonicalHash.ts`) and stores it (idempotent per
submission; records `issued_by`). The same mutation stamps
`submissions.issued_at`, so a certificate can never exist without its deletion
clock started. The response carries the PDF (base64) and the verify URL
`/org/[slug]/verify?t=<template>&id=<submission>&<fields...>`, which is also
what the QR code holds.

The client sends only the submission id. It can no longer choose the hash or
the template, so a tampered browser cannot register a certificate that does
not match the stored submission. `.../preview` renders the same PDF with a
watermark and registers nothing. Rendering happens before the hash is stored,
so a template that fails to render leaves no certificate behind.

The submission then survives for `ISSUED_RETENTION_HOURS` so the PDF can be
regenerated (lost file, misprint, late-spotted typo); the retention sweep
(`apps/api/src/lib/retention.ts`) removes it on the next touch of the
submissions API. Re-issuing does **not** re-stamp `issued_at`, so
regenerating can't extend retention.

### 3. Verify
Anyone opens the QR URL → `OrgVerifyClient` recomputes the hash from the URL
params (dropping `t`, sorting keys, SHA-512) and compares with the stored
hash fetched by `submissionId`. Match ⇒ green. The database never learns what
was attested; the URL carries the data.

Which params feed the hash is narrowed by `selectHashFields`
(`packages/shared/src/verifyFieldSelection.ts`): once the template's `form_schema` is
loaded, only its declared field keys (plus `id`) count. That makes the
verifier immune to incidental params — the `lang` UI switch, or the
`utm_*`/`fbclid` junk that messaging apps append to shared links — which
would otherwise change the digest and show a genuine certificate as invalid.
The language toggle on this page is deliberately local React state, never a
URL param, for the same reason.

## The design layer

Two styling systems coexist, deliberately.

**The landing layer** — `apps/web/src/app/style/tokens.ts` plus
`apps/web/src/components/landing/*`. `SiteHeader` is the one header for the whole site:
`LandingHeader` wraps it for public pages, `SignedInShell` for
`/login/adminpage/**` and `/admin`. One component, so the two sides cannot
drift apart.

**Stock MUI** — everything inside an admin page. The theme
(`apps/web/src/app/style/customTheme.ts`) takes its palette from the same tokens, so
they do not clash, but they are not one system.

Where the line falls: `/`, `/om` and `/ny-organisasjon` are fully
landing-layer; the verify client uses tokens but is hand-rolled; signed-in
pages have landing-layer chrome and MUI contents. The volunteer form and the
four auth pages are still entirely MUI.

The template editor (`edit_pdf`) is the first admin page with landing-layer
structure: numbered sections with serif headings from the tokens, MUI only
for the inputs. It shows one plain line per PDF field
(`packages/shared/src/describeBinding.ts` turns a binding into "fixed text",
"from the form", "filled in automatically" and so on) and keeps the detailed
settings closed until asked for. The stored `field_bindings` are unchanged;
only how they are shown is.

Use `PageShell` for a new public page. Inside admin, MUI is correct until
someone decides otherwise — converting a page is a deliberate act.

Theme typography must not hardcode `color`: a fixed colour on `body1`/`body2`
once overrode a contained button's `contrastText` through a nested
`Typography`. `customTheme.test.ts` pins it.

## Channels and the outbox

The core never imports a provider. `apps/api/src/ports.ts` names what it
needs, `adapters/` holds one file per provider, and `channels.ts` picks the
adapter from the environment. A caller gets `null` when nothing is configured
and must cope, so the platform runs without any provider.

| Port | Carries | Adapter today |
|---|---|---|
| `NoticeChannel` | "Something is waiting" emails and invites. Never volunteer data | Resend (`RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`) |
| `CertificateChannel` | A finished certificate to a person's own mailbox | Digipost (`DIGIPOST_BROKER_ID`, `DIGIPOST_PRIVATE_KEY`, `DIGIPOST_API_URL`), and only when `DELIVERY_KEY` is set |

**The `notices` table is the outbox.** A row holds an organisation id and a
kind, nothing else. Recipients are read from the membership table at send
time. Reliability comes from the row, not from a send succeeding:

- A submission queues at most one unsent notice per organisation.
- `dispatchNotices` sends what is queued. It runs right after a submission and
  on every scheduled round. A failed send leaves the row and counts an attempt; after
  five the row is left alone.
- One email per organisation per `NOTICE_QUIET_HOURS`. A notice queued inside
  the window goes out when it ends, unless the queue was cleared meanwhile.

### Digipost delivery

attester.no is the sender, on behalf of the organisation. The letter's
subject names the organisation.

1. The platform owner turns it on for an organisation at `/admin`
   (`org_settings.digipost_enabled`). An organisation cannot grant it to
   itself, and `DIGIPOST_DAILY_LIMIT` caps its letters per day.
2. The public form then shows an optional fødselsnummer field. It is posted
   beside `data`, validated (`packages/shared/src/nationalId.ts`) and
   stored sealed in `submission_recipients`. If the org has not turned
   Digipost on, the number is dropped, not stored.
3. In the issue dialog the dashboard asks `.../recipient-check`. The server
   asks Digipost whether that person has a mailbox and answers yes or no.
4. Issuing with `{ "deliver": "digipost" }` renders the PDF, registers the
   certificate, puts the sealed PDF and recipient in `deliveries` and tries
   to send at once. On success the payload and the recipient row are erased
   and the row reads "sent via Digipost at T". On failure the row stays
   queued and the scheduler retries it.
5. The admin still gets the PDF in the response, whatever Digipost answers.

`deliveries` is both the queue and the record. One row per certificate and
channel, so a repeat issue cannot send twice. The delivery id is also the
Digipost message id, so a retry of a letter Digipost already took is
answered as a duplicate and counted as sent.

The adapter (`adapters/digipostChannel.ts`) is written from Digipost's
official Java client and `api_v8.xsd`: requests signed with RSA-SHA256 over a
canonical string, the entry point read for links, one multipart request per
letter. It has been tested against a fake, not against Digipost. It has
also been compared with the owner's Android Digipost client in
`arneeme/apps`, written separately from the same sources: the signed string,
the headers and the multipart layout agree.

**The scheduler** (`jobs/scheduled.ts`) runs inside the API process every ten
minutes: retention sweep, the outbox, then queued deliveries. Everything it
does also runs lazily elsewhere, so a missed round delays work and loses
nothing. With more than one API instance each runs its own; the jobs tolerate
that, at worst a notice email is sent twice.

## Logs and errors

Built in, with no outside service. The rules for what may be written down
are in CLAUDE.md "Logs and errors"; this is how it works.

```
a route or a job fails
   │
   ▼
reportError(e, source, place)          apps/api/src/errors/report.ts
   ├─► one JSON line on stderr          lib/log.ts
   ├─► ErrorSink.record(report)         ports.ts → adapters/hasuraErrorSink.ts
   │      one row per distinct error in `platform_errors`
   └─► ntfy ping to the owner, only for a new kind of error
```

- **Logs** are one JSON object per line on stdout: `time`, `level`, `event`
  and, inside a request, `requestId`, `method` and `route`. Every request
  writes one `request` line with `status` and `ms`. That is the interface:
  `docker logs` reads it today, and Vector, Loki or any other collector can
  read it later without a code change.
- **The request id** is made per request (`lib/requestContext.ts`, an
  `AsyncLocalStorage`), returned as `x-request-id` and inside a 500 body. A
  user can quote it; it finds the log lines and the error row, and says
  nothing about them.
- **An error's identity** is its fingerprint: source, place, error name and
  top stack frame. Repeats bump `count` and `last_seen` on the same row.
- **A failing database cannot be flooded with its own failures.** A repeating
  error is written at most once a minute with the count held back, at most
  500 distinct errors are kept, and rows unseen for 30 days are pruned by the
  scheduler. Storing is fire-and-forget and never throws.
- **Reading them:** `/admin` lists unresolved errors (`GET /admin/errors`).
  "Mark as resolved" hides a row; if it happens again it comes back and the
  owner is pinged again.
- **`ErrorSink` is a port.** The Hasura adapter is the only one. A
  self-hosted GlitchTip (open source, speaks the Sentry protocol) would be a
  second adapter, not a rewrite. `ERROR_STORE=off` keeps errors in the log
  only.
- **Errors from outside the API** come in through `POST /v1/errors`
  (`routes/errors.ts`). The browser posts there from `ErrorReporter`
  (uncaught errors and rejected promises), from `app/error.tsx` and from
  `app/global-error.tsx`. The web app's server code posts there from
  `instrumentation.ts`. They are stored like any other error, with source
  `browser` or `web`.
  - The page sends the route as a pattern (`routePattern()` in
    `util/reportError.ts`): `/org/:slug/verify`, never the address. The query
    is never sent; on the verify page it is the whole certificate.
  - The endpoint is anonymous, so everything it receives is treated as
    hostile: fields are cut, scrubbed again on the server, limited to thirty
    reports a minute and to a hundred distinct rows of their own, so they
    cannot crowd out the API's own errors. It never reads the request's
    headers and always answers 202.
  - A page sends at most five reports per load.
- **Not covered:** the API being down altogether. It cannot report its own
  death, and the web app's reports go to the API. That takes a check from
  outside, see ROADMAP. Whether `instrumentation.ts` runs on Cloudflare Pages
  has not been seen in production; it builds there.

## Security model

- **Server is the only boundary.** Client-side guards are UX, not security.
  That includes the template rules: the API runs `validateTemplateForSave`
  itself, so a template without a QR code or the platform mark cannot be
  stored by skipping the designer.
- **A submission may only carry the fields its form declares.** The reviewer
  sees the form's fields and nothing else, so an extra key would be hidden
  from them while still able to fill an unbound PDF field or break the hash.
  The POST rejects unknown keys. Do not loosen this to "ignore unknown keys".
- **Ids are checked to be uuids before they reach Hasura** (`lib/input.ts`).
  Hasura quotes a malformed uuid back in its error and errors are logged, so
  this keeps caller-chosen text out of the log.
- **Email addresses count only when verified.** The platform-admin allowlist
  and invite redemption both require `emailVerified`. Otherwise whoever first
  registers someone else's address inherits its rights.
- **Bounded everywhere a stranger can write.** Anonymous bodies are capped at
  128 KB before a route sees them, an organisation's unissued queue at 2,000
  rows and pending organisation requests at 100. Lists are bounded too: the
  submissions list is paged (500 at most), and the templates list carries no
  PDF or layout; `templates/:id/full` serves those one template at a time. Hasura calls time out after
  ten seconds.
- Every org-scoped route calls `requireOrgMemberBySlug` (`apps/api/src/lib/apiAuth.ts`):
  verify JWT → resolve slug → check `user_organizations`. Object ownership is
  double-checked (`apps/api/src/lib/ownership.ts`) when ids come from the client.
- Platform-level actions (`/api/v1/admin/*`) additionally require the caller's
  `auth.users` email to be on the `PLATFORM_ADMIN_EMAILS` env allowlist
  (`apps/api/src/lib/platformAdmin.ts`). Unset ⇒ surface disabled.
- `UNLISTED_ORG_SLUGS` (a constant in `packages/shared/src/orgVisibility.ts`, applied in
  `listPublicOrgs`) hides orgs from the front-page picker and the sitemap.
  Edit the list and deploy. It is a **discovery** filter, not access control:
  `/org/<slug>` still serves an unlisted org, by design, so test orgs stay
  testable. Never treat an unlisted slug as secret.
- The anonymous submissions POST is size-capped (64 KB body, per-field
  length limit) and enforces a flat string→string data shape. There is no
  rate limiter; the ceilings listed above bound what a script can do. See
  ROADMAP if abuse ever becomes real.
- There are exactly **four** unauthenticated write paths: submissions,
  organisation requests, error reports and the volunteer's reminder (see "Logs and errors"). The second is
  `POST /api/v1/org-requests`, where an organisation asks to be set up. Same
  shape of defence as the submissions POST — body cap, per-field caps, strict
  string validation (`packages/shared/src/orgRequest.ts`) — plus a honeypot field that
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
- All Hasura access goes through `hasuraAdmin()` (`apps/api/src/lib/hasura.ts`)
  with GraphQL **variables only** — never interpolate values into query text.
- **Owner notifications say that something is waiting, never what.**
  `notifyPlatformOwner()` (`apps/api/src/lib/notifyOwner.ts`) pushes via ntfy,
  where the topic name is the only secret and anyone who learns it reads every
  message. So the payload carries no organisation name, slug, contact details
  or message text — just a link to `/admin`. It never throws: a failed
  notification must not fail the submission that triggered it.

### Client session lifetime

The admin area calls our own API routes with a header built by `authHeader()`
(`apps/web/src/lib/nhost.ts`), not through Nhost's HTTP clients — so the SDK's automatic
token refresh, which is installed on those clients, never runs. Without help the
access token simply expires (~15 min) while the refresh token stays valid for
weeks, and every request 401s.

`useSessionKeepAlive()` (`apps/web/src/util/auth.ts`) is that help: it refreshes on
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
- The retention sweep still runs lazily on the submissions routes even though
  the scheduler runs it too. A host may put an idle container to sleep; the
  lazy call is what makes deletion happen regardless.
- Unissued submissions have no expiry. Deleting a volunteer's application
  before a human read it is worse than holding it, so the sweep's
  `issued_at IS NOT NULL` guard is load-bearing (product decision, 2026-08).
- No `/personvern` page. Publishing a privacy policy is a legal commitment
  the owner isn't in a position to make yet; `/om` explains the mechanics
  factually instead.

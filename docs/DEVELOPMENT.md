# Development guide

Practical knowledge for working on this codebase — written for both humans
and AI assistants. Read [CLAUDE.md](../CLAUDE.md) (invariants) and
[ARCHITECTURE.md](ARCHITECTURE.md) (system map) before changing anything
touching verification, retention, or auth.

## Commands

```bash
npm install          # from the repo root; npm workspaces link apps/web, apps/api and packages/shared
npm run dev          # the web app (needs apps/web/.env.local, see .env.example)
npm run dev -w @attester/api   # the API on :8787; point API_URL at http://localhost:8787/v1
npm run typecheck    # tsc --noEmit
npm run lint         # eslint — 2 known warnings are acceptable, 0 errors
npm test             # vitest unit suite (src/**/*.test.ts only)
npm run test:e2e     # Playwright suite (apps/web/e2e/*.spec.ts), mocked APIs, no DB needed
npm run build        # next build — needs NEXT_PUBLIC_NHOST_* set (placeholders fine)
```

Full verification before any commit:

```bash
rm -rf apps/web/.next && npm run typecheck && npm run lint && npm test \
  && NEXT_PUBLIC_NHOST_SUBDOMAIN=ci-placeholder NEXT_PUBLIC_NHOST_REGION=eu-central-1 npm run build \
  && npm run test:e2e
```

CI (`.github/workflows/ci.yml`) runs exactly this on every push/PR.

## The local test rig

Runs production's services on your own machine with invented data. Nothing
in it touches the real project. Needs Docker.

```bash
npm run stack:up      # start everything, set up the database, seed test data
npm run dev           # the web app, against the rig
npm run stack:smoke   # one real pass through every flow
npm run stack:logs    # what the services said
npm run stack:down    # stop it and delete its data
```

`stack:up` prints the addresses and the test logins. What runs
(`dev/docker-compose.yml`):

| Service | Where | What it is |
|---|---|---|
| Postgres, Hasura | `localhost:8080/console` | The real database layer, same Hasura version as Nhost |
| Nhost Auth | `localhost:4000` | The real auth service. Sign-up, verification and reset mails go to the mail catcher |
| API | `localhost:8787` | Built from the same `Dockerfile` as production |
| Mailpit | `localhost:8025` | Catches every email. Nothing leaves the machine |
| Fake Digipost | `localhost:8090` | Checks each request's signature like Digipost does, and shows the letters it received |

- The seeded data: organisation `testorg` with Digipost on and one template,
  `annenorg` for testing that organisations cannot see each other, and three
  users. A fødselsnummer starting with `01` has a mailbox in the fake
  Digipost; use the synthetic `01818099912`.
- Keys are generated on first start into `.dev/` (gitignored). They are not
  secrets and exist only on your machine.
- `stack:up` writes `apps/web/.env.local` if you have none. If you have one,
  it prints the four lines the rig needs.
- The rig sets the schema up from `0000-baseline-schema.sql`, so that file
  is tested on every run. A column missing there fails the smoke test.
- CI runs the same rig and smoke test on every PR (job `stack`).
- **To test against the real Digipost test environment**, change
  `DIGIPOST_API_URL`, `DIGIPOST_BROKER_ID` and `DIGIPOST_PRIVATE_KEY` for the
  `api` service to your test sender's values. Keep them out of git.

What the rig does not cover: Cloudflare Pages, Resend, and Nhost's hosted
configuration. Those need a staging copy, see ROADMAP.

## Conventions

### Strings & languages
- Every user-facing string lives in `apps/web/src/strings.ts`, in a `no` object and an
  `en` object. `Strings = typeof no` makes missing translations a **compile
  error** — never add a key to one language only.
- Public pages (landing, /om, form, auth) read the language from the URL:
  `?lang=en`, Norwegian default. Server components get it from `searchParams`,
  client components from `useSearchParams()`.
- **Exception — the verify page.** `/org/[slug]/verify` keeps its language in
  local React state and never writes `?lang=` into the URL. That URL is a
  frozen external contract (printed on paper, inside a QR code), and any extra
  param risks feeding the hash. Don't "make it consistent" with the others.
- Admin pages use `useAdminLang()` (`apps/web/src/util/useAdminLang.ts`,
  localStorage-persisted) and alias a subgroup:
  `const a = strings.admin.<page>;`.
- Interpolations are template functions in the dictionary:
  `title: (org: string) => \`...\``.
- Do NOT translate database-persisted values (asset names, template content,
  starter template data) — only UI chrome.

### API routes
- Routes live in `apps/api/src/routes/` and are registered in
  `apps/api/src/app.ts`. They take a web-standard `Request` and return a
  `Response` (`json()` from `../http`). No Next imports, no `runtime` export.
- The API is bundled with esbuild (`npm run build -w @attester/api`), so a
  dependency must be pure JavaScript. Native addons do not survive bundling.
- Org-scoped admin routes start with
  `const auth = await requireOrgMemberBySlug(req, slug); if (auth instanceof Response) return auth;`.
- Ids received from the client get an ownership check
  (`templateBelongsToOrg`, `submissionBelongsToOrg`) before use.
- Anonymous write endpoints get explicit size caps and strict shape
  validation and a ceiling on how much can pile up. There is no rate limiter.
- Hasura: only through `hasuraAdmin<T>(query, variables)`. Values go in
  variables, NEVER in the query string. Multiple root fields in one mutation
  run in a single transaction — use that for atomicity (see the /admin org
  creation for the client-generated-uuid trick).
- Deliberate failures: `json({ error: message }, { status })`
  with a message written for the reader.
- Never `console.*` in `apps/api`. `log(level, event, fields)` for an event,
  `reportError(e, "api" | "job", place)` for a failure outside a route's
  own catch. Pass free text through `scrub()` first.
- Unexpected failures: `return serverError(e, "api/route/path")`
  (`apps/api/src/lib/apiError.ts`). NEVER return the caught message — Hasura's
  text names tables and constraints, and one of these routes is the anonymous
  volunteer POST. It reports the error and returns `{ code: "server_error", requestId }`, leaving `error` unset
  so callers written as `json.error ?? "Kunne ikke laste maler"` keep their
  own wording.

### Database changes
- Migrations are hand-run SQL in `scripts/migrations/`, executed in the
  Hasura SQL console, then tables/columns must be (re-)tracked there.
- Every new table/column goes in TWO places: a dated migration file AND
  `0000-baseline-schema.sql` (which must stay a full, `IF NOT EXISTS`,
  fresh-install script).
- Think twice before any new table — the privacy model (CLAUDE.md) forbids
  anything that stores volunteer fields outside `submissions`.

### Tests
- Unit tests: pure `.ts` modules only (vitest has no JSX transform). Put
  logic in `apps/web/src/util/`, `packages/shared/src/` or `apps/api/src/` and test it there; keep React
  components thin.
- E2E: `apps/web/e2e/*.spec.ts`, APIs mocked with `page.route()`. The verify tests
  compute the SHA-512 independently (`apps/web/e2e/helpers.ts`) — they are the guard
  on the hash contract, so a drift in either the page or the algorithm fails
  CI.
- E2E navigation timing: `next dev` compiles each route on first request,
  which under parallel workers regularly exceeds Playwright's 5s default. Give
  the **first** assertion after a navigation an explicit longer timeout (see
  `apps/web/e2e/landing.spec.ts`) rather than accepting a flaky spec.

## Gotchas (each of these has cost real time)

- **Stale `.next/types`** after switching branches breaks `tsc` with phantom
  module errors → `rm -rf .next` first.
- Scripts in `apps/web/scripts/` without imports need `export {}` or their top-level
  consts collide in tsc's global scope.
- In sandboxes with a pre-provisioned Chromium, run e2e with
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` instead of `playwright install`.
- `.claude/` is gitignored (AI worktrees live there) — keep it that way.
- `apps/web` runs on the edge runtime: no `setInterval`/cron, no Node
  `crypto` module (use Web Crypto), per-isolate memory only. `apps/api` is
  plain Node and has none of these limits. Shared code in `packages/shared`
  must run in both, so it uses Web Crypto and no Node modules.
- `next-env.d.ts` is generated and lint-ignored; don't edit or lint it.

## Deploy checklist (per release)

1. Merge to `main`; `npm run deploy -w @attester/web` (wrangler → Cloudflare
   Pages) or CI/CD. The Cloudflare Pages project must build from the repo
   root with `npm run pages:build -w @attester/web` and output directory
   `apps/web/.vercel/output/static`.
2. Run any new `scripts/migrations/*.sql` in the Hasura console and (re-)track
   affected tables. The first deploy of the rebuild needs four:
   `2026-11-notices.sql`, `2026-11-digipost.sql`,
   `2026-11-platform-errors.sql` and `2026-11-submission-status.sql`.
3. Env vars are split by who needs them.
   - **Cloudflare Pages (web):** `NEXT_PUBLIC_NHOST_*`, `API_URL` (the API's
     `/v1` root, e.g. `https://api.attester.no/v1`) and `NHOST_ADMIN_SECRET`,
     which only the frozen legacy verify route uses.
   - **The API container:** required: `NHOST_SUBDOMAIN`, `NHOST_REGION`,
     `NHOST_ADMIN_SECRET` and `PUBLIC_APP_URL` (`https://attester.no`; every
     link in a QR code or an email is built from it). Optional:
     `PLATFORM_ADMIN_EMAILS` (unset ⇒ `/admin` disabled), `RESEND_API_KEY` +
     `NOTIFY_EMAIL_FROM` (unset ⇒ no email; the invite dialog shows the link
     to copy), `NTFY_TOPIC` (unset ⇒ the owner is not notified of new org
     requests; the topic name is its only secret, so generate it), `PORT`
     (default 8787), `SCHEDULER=off` to stop the built-in scheduler,
     `ERROR_STORE=off` to keep errors in the log only.
   - **Running the container.** `docker build -t attester-api .` from the
     repo root, then run it anywhere that runs a container and gives it a
     public HTTPS address: Fly.io, Cloud Run, Railway, Nhost Run. It listens
     on `PORT`, answers `/healthz`, runs as a non-root user and keeps no
     state on disk. Give it at least 512 MB; rendering a PDF needs memory.
4. Digipost (optional; without it the feature is hidden everywhere). Set
   these as secrets on the API container:
   - `DELIVERY_KEY`: `openssl rand -base64 32`. Seals fødselsnummer and
     queued PDFs. Losing it makes queued letters unreadable, nothing else.
   - `DIGIPOST_BROKER_ID`: the sender id from Digipost. Requests are signed as
     this sender. `DIGIPOST_SENDER_ID` is only for sending on behalf of
     another sender; leave it unset otherwise.
   - `DIGIPOST_PRIVATE_KEY`: the private key as PEM. From the `.p12`:
     `openssl pkcs12 -in cert.p12 -nocerts -nodes | openssl pkey`. If the
     secret store dislikes newlines, base64 the PEM; both forms are read.
   - `DIGIPOST_API_URL`: defaults to the test environment,
     `https://api.test.digipost.no`. Production must be set by name:
     `https://api.digipost.no`.

   Then turn Digipost on for one organisation at `/admin` and issue one
   certificate to a test person. Never paste the key or a real fødselsnummer
   into a chat, an issue or a commit.
5. One-time Nhost setup (Settings → Auth):
   - **Allowed Redirect URLs** must contain every origin you use, with the
     `/login/reset` path — production, `http://localhost:3000`, and a
     wildcard for Cloudflare previews (`https://*.<project>.pages.dev/...`).
     A missing entry fails password reset with `The value of
     "options.redirectTo" is not allowed` — it's an allowlist, not a bug.
   - **Client URL** should be the production origin, not localhost.
   - **Email verification must be on.** The API refuses platform-admin access
     and invite redemption for an unverified address.
   - Email verification and the minimum password length are project settings,
     not code. `PASSWORD_MIN_LENGTH` in `apps/web/src/util/auth.ts` only mirrors the
     latter for a friendly client-side message — keep the two in sync.

## Working style that has worked here

- Small, independently shippable slices; stacked PRs when they depend on each
  other (base each PR on its parent branch, retarget as parents merge).
- **`main` auto-deploys to production** via the Cloudflare Pages Git
  integration, so anything merged is live. While the platform rebuild runs
  (docs/ROADMAP.md), work goes to `develop` in small PRs and the owner merges
  `develop` to `main` when the downtime suits. The branch is `develop` and not
  `dev` because old `dev/*` branches block that name.
- Stack only genuinely dependent work; unrelated branches go off `develop` in
  parallel. A stacked child does NOT auto-retarget unless the merged branch is
  deleted, and a child that quietly merges into a dead branch loses its work.
  This has happened once already.
- Hygiene-only PRs get closed unreviewed. Fold small fixes into whatever
  larger change already touches those files.
- Group changes by review difficulty: language/tests/UI polish are quick
  approvals; anything touching issuance, retention, auth, or tenancy gets its
  own clearly-labelled PR for deep review.
- Update CLAUDE.md in the same commit as any change to an invariant it
  documents. Stale invariant docs are worse than none.

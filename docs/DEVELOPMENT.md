# Development guide

Practical knowledge for working on this codebase — written for both humans
and AI assistants. Read [CLAUDE.md](../CLAUDE.md) (invariants) and
[ARCHITECTURE.md](ARCHITECTURE.md) (system map) before changing anything
touching verification, retention, or auth.

## Commands

```bash
npm install
npm run dev          # local dev (needs .env.local, see .env.example)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint — 2 known warnings are acceptable, 0 errors
npm test             # vitest unit suite (src/**/*.test.ts only)
npm run test:e2e     # Playwright suite (e2e/*.spec.ts), mocked APIs, no DB needed
npm run build        # next build — needs NEXT_PUBLIC_NHOST_* set (placeholders fine)
```

Full verification before any commit:

```bash
rm -rf .next && npm run typecheck && npm run lint && npm test \
  && NEXT_PUBLIC_NHOST_SUBDOMAIN=ci-placeholder NEXT_PUBLIC_NHOST_REGION=eu-central-1 npm run build \
  && npm run test:e2e
```

CI (`.github/workflows/ci.yml`) runs exactly this on every push/PR.

## Conventions

### Strings & languages
- Every user-facing string lives in `src/strings.ts`, in a `no` object and an
  `en` object. `Strings = typeof no` makes missing translations a **compile
  error** — never add a key to one language only.
- Public pages (landing, /om, /personvern, form, verify, auth) read the
  language from the URL: `?lang=en`, Norwegian default. Server components get
  it from `searchParams`, client components from `useSearchParams()`.
- Admin pages use `useAdminLang()` (`src/util/useAdminLang.ts`,
  localStorage-persisted) and alias a subgroup:
  `const a = strings.admin.<page>;`.
- Interpolations are template functions in the dictionary:
  `title: (org: string) => \`...\``.
- Do NOT translate database-persisted values (asset names, template content,
  starter template data) — only UI chrome.

### API routes
- Every route: `export const runtime = "edge";`.
- Org-scoped admin routes start with
  `const auth = await requireOrgMemberBySlug(req, slug); if (auth instanceof NextResponse) return auth;`.
- Ids received from the client get an ownership check
  (`templateBelongsToOrg`, `submissionBelongsToOrg`) before use.
- Anonymous write endpoints get `checkRateLimit(...)` and explicit size caps.
- Hasura: only through `hasuraAdmin<T>(query, variables)`. Values go in
  variables, NEVER in the query string. Multiple root fields in one mutation
  run in a single transaction — use that for atomicity (see the /admin org
  creation for the client-generated-uuid trick).
- Errors: `NextResponse.json({ error: message }, { status })`; catch and
  return 500 with the message.

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
  logic in `src/util/` or `src/lib/server/` and test it there; keep React
  components thin.
- E2E: `e2e/*.spec.ts`, APIs mocked with `page.route()`. The verify tests
  compute the SHA-512 independently (`e2e/helpers.ts`) — they are the guard
  on the hash contract. MUI Rating gotcha: click
  `.MuiRating-root label` (nth), not the hidden radio input.

## Gotchas (each of these has cost real time)

- **Stale `.next/types`** after switching branches breaks `tsc` with phantom
  module errors → `rm -rf .next` first.
- Scripts in `scripts/` without imports need `export {}` or their top-level
  consts collide in tsc's global scope.
- In sandboxes with a pre-provisioned Chromium, run e2e with
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` instead of `playwright install`.
- `.claude/` is gitignored (AI worktrees live there) — keep it that way.
- The edge runtime has no `setInterval`/cron, no Node `crypto` module (use
  Web Crypto), and per-isolate memory only.
- `next-env.d.ts` is generated and lint-ignored; don't edit or lint it.

## Deploy checklist (per release)

1. Merge to `main`; `npm run deploy` (wrangler → Cloudflare Pages) or CI/CD.
2. Run any new `scripts/migrations/*.sql` in the Hasura console and (re-)track
   affected tables.
3. Env vars live in Cloudflare Pages: `NEXT_PUBLIC_NHOST_*`,
   `NHOST_ADMIN_SECRET`, `NHOST_JWT_SECRET`, optional `PLATFORM_ADMIN_EMAILS`,
   `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`.
4. One-time Nhost setup: production URL + `/login/reset` in Auth → Redirect URLs.

## Working style that has worked here

- Small, independently shippable slices; stacked PRs when they depend on each
  other (base each PR on its parent branch, retarget to main as parents merge).
- Group changes by review difficulty: language/tests/UI polish are quick
  approvals; anything touching issuance, retention, auth, or tenancy gets its
  own clearly-labelled PR for deep review.
- Update CLAUDE.md in the same commit as any change to an invariant it
  documents. Stale invariant docs are worse than none.

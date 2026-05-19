# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Next.js dev server (localhost:3000)
npm run build         # plain Next.js build (compile + type check)
npm run pages:build   # build for Cloudflare Pages — runs @cloudflare/next-on-pages, outputs .vercel/output/static
npm run preview       # local wrangler preview of the Pages build
npm run deploy        # deploy to Cloudflare Pages (CI normally handles this)
```

No test suite exists. There is no separate lint script — `npm run build` does the type checking.

## Architecture

**Stack:** Next.js 15 (App Router) on Cloudflare Pages, TypeScript, Material UI, Nhost backend (Postgres + Hasura GraphQL + Nhost Auth), pdfme for in-browser PDF generation. UI text is in Norwegian.

**The single most important rule: the browser never talks to Hasura directly.**

Hasura's public/user role permissions are not honored on this Nhost project, so every database operation is proxied through Next.js Route Handlers under `src/app/api/*`. Those routes hold the Hasura admin secret server-side and call Hasura with `x-hasura-admin-secret`. The pattern is non-negotiable — if you find yourself reaching for `nhost.graphql.request(...)` in client code, stop and add an API route instead.

Two server-only helpers keep routes thin:
- `src/lib/server/hasura.ts` — `hasuraAdmin<T>(query, variables)` posts to `https://${subdomain}.hasura.${region}.nhost.run/v1/graphql` with the admin secret.
- `src/lib/server/auth.ts` — `isValidJwt(authHeader)` decodes the Bearer JWT and checks `exp` locally. Nhost's `/user` endpoint is not used because it was returning non-200 for valid sessions; local verification is sufficient because Nhost signs the tokens.

Convention: `GET` endpoints are public, write endpoints (`POST`/`PATCH`/`DELETE`) check `isValidJwt` and return 401 if invalid. Two exceptions: `POST /api/volunteers` is unauthenticated (public submission form), `POST /api/certificates` requires JWT.

**Every API route under `src/app/api/` must export `const runtime = "edge"`** — Cloudflare Pages refuses to build otherwise. Both server helpers use only `fetch` and `atob`, so they are Edge-compatible; do not import Node-only modules into API routes.

Client side, `src/lib/nhost.ts` exports:
- `nhost` — the singleton client (used for auth only, not DB calls)
- `authHeader()` — returns `{ authorization: "Bearer ..." }` to attach to `fetch` calls against `/api/*`
- `getDefaultOrgId()` — resolves the `echo` org slug to its UUID, memoized. Used everywhere a UI flow needs an `organization_id`.

## Database

Postgres schema (managed in Nhost; the schema-as-code file was removed after the initial migration). Multi-tenant by `organization_id`:

| table | key columns | notes |
|---|---|---|
| `organizations` | `id`, `slug` (unique), `name`, `generic_text`, `groups` (jsonb), `signatures` (jsonb) | per-org content for the PDF templates lives here as JSON blobs |
| `certificates` | `id`, `organization_id`, `volunteer_id`, `hash` | indexed on `(organization_id, volunteer_id)`; one row per generated PDF, used by `/verify` |
| `volunteers` | `id`, `organization_id`, `person_name`, `group_name`, `start_date`, `end_date`, `role`, `extra_roles` (jsonb) | dates are stored as `text`, not `date` — keep them as strings |
| `templates` | `id`, `organization_id`, `name`, `base_pdf`, `schemas` (jsonb), `is_default` | pdfme template definitions, one set per org |
| `user_organizations` | `(user_id, organization_id)`, `role` | links Nhost `auth.users` to orgs; admin-only role today |

The `echo` org slug is currently hardcoded in `src/util/databaseInteractions/fetchInfo.ts` and `insertData.ts` (constant `ORG_SLUG = 'echo'`). When multi-org goes live, resolve the active org from the session/JWT and remove that constant.

`fetchInfo.ts` has fallback values from `src/app/pdfinfo/*` — if the DB read fails the UI still renders with defaults. Don't remove the fallbacks; they are why a fresh deploy works before seeding.

## Deployment

Cloudflare Pages via `@cloudflare/next-on-pages`. The build outputs to `.vercel/output/static`, which `wrangler.toml` references with `pages_build_output_dir`.

Configuration split (this surprised the first deploy):
- `wrangler.toml [vars]` — `NEXT_PUBLIC_NHOST_SUBDOMAIN`, `NEXT_PUBLIC_NHOST_REGION`. These are not secret, and Cloudflare delegates env-var management to `wrangler.toml` when the file is present.
- Cloudflare dashboard → Secrets — `NHOST_ADMIN_SECRET`. Read at runtime by the API routes.

`NEXT_PUBLIC_*` vars are inlined into the JS bundle at build time, not read at runtime — changing them in the dashboard does nothing until a rebuild.

## Known constraints

- `next` is pinned to `15.5.2`. The peer dep cap on `@cloudflare/next-on-pages@1.13.16` is `next <=15.5.2`; bumping next will break `npm ci` on Cloudflare with `ERESOLVE`.
- `@cloudflare/next-on-pages@1.x` is deprecated upstream in favor of `@opennextjs/cloudflare`. Migration would unlock Next.js 16+ but is a separate effort.
- `package-lock.json` must stay committed — Cloudflare runs `npm clean-install` which requires it.
- `.vercel/`, `.next/`, `next-env.d.ts`, and `tsconfig.tsbuildinfo` are generated; never commit them.

## Conventions

- 4-space indentation (matches existing source).
- Module path alias `@/` → `src/`.
- Norwegian for user-facing strings, English for code, comments, commit messages.
- Don't add Node-only imports (`buffer`, `fs`, `crypto.createHash`) to anything under `src/app/api/` — those modules run on the Edge Runtime. Use `atob`, `crypto.subtle`, etc.

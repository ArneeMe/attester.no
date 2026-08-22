# Roadmap

Deliberate future work, with the reasoning captured so it doesn't have to be
re-derived. Items are parked, not forgotten — each says what unblocks it.

## Near-term (unblocked, just needs doing)

- **Translate the template designer and content library** (`edit_pdf/*`,
  `rediger/page.tsx`, ~1 800 lines). The pattern is established
  (`src/strings.ts` + `useAdminLang`); every other admin page is done.
  Only UI chrome — never database-persisted values.
- **Live end-to-end pass against real Nhost** before onboarding a stranger
  org: password reset email, signup, invite redemption, issue + verify one
  attest on paper, and confirm the sweep deletes an *issued* submission after
  the window while leaving an unissued one alone.
- **Pilot**: echo + one external org through the full lifecycle.

## Needs a decision or an account (owner: the human)

- **Error tracking** — the most important gap once strangers depend on the
  product; today production failures are invisible (`console.error` only).
  Sentry or Cloudflare-native. Do this before promoting beyond people you know.
- **Email provider** — `RESEND_API_KEY`/`NOTIFY_EMAIL_FROM` currently power
  invite emails only; without them the invite dialog just shows a link to copy.
- **`hei@attester.no`** — referenced in the help dialog and /om. Must
  actually exist.
- **Privacy policy** — deliberately NOT shipped. A drafted `/personvern` was
  closed unmerged (2026-08): publishing one is a legal commitment the owner
  isn't positioned to make. `/om` covers the mechanics factually instead. If a
  policy is ever wanted, it needs real legal input, not a faithful-to-the-code
  draft.

## Known gaps

- **Nothing tells an admin a submission is waiting.** No email, no badge, no
  count — an org has to remember to log in. Since unissued rows are never
  auto-deleted (see below) nothing is *lost*, but an application can sit
  unseen for weeks. Cheapest fix is a pending count in the org nav; the
  heavier one is reinstating a content-free email. Raised 2026-08, not yet
  scheduled.

## Design options captured (build when the need is real)

- **A backstop for never-processed submissions.** Shipped 2026-08: the
  deletion clock starts at issuance (`submissions.issued_at`), and unissued
  rows are never swept. The accepted cost is that an org which abandons its
  queue holds volunteer data indefinitely — chosen because losing an
  application before a human read it is worse. If that becomes a real problem,
  the fix is a long secondary TTL on `created_at` for unissued rows (e.g. 90
  days) plus a warning to the org first — deliberately NOT added now, since a
  silent backstop is how the original bug hurt people.
- **Hash algorithm v2 escape hatch.** Documented in CLAUDE.md ("version-tag
  the hash"). Not implemented on purpose; the dispatch costs nothing until
  actually needed.
- **Cert revocation.** Would need a `revoked_at` column + verify-path check
  + admin UI + policy decisions (who may revoke, is it visible publicly).
  Nothing stores personal data, so revocation is purely a trust feature.
- **Rate limiting.** Removed entirely (2026-08) — the in-memory limiter was
  per-isolate on the edge runtime, so it never really bounded anything. If
  abuse becomes real, do it properly with Cloudflare KV/Durable Objects or at
  the CDN edge rather than reinstating best-effort in-process counters. The
  anonymous POST still enforces body-size and field-length caps.
- **Media out of Postgres.** Logos/signatures are base64 in `org_assets`
  jsonb — fine at pilot scale, a cost/perf smell as orgs multiply. Move to
  Nhost Storage; the seam is `ImageUpload.tsx` + `resolveBinding`'s asset
  sub-field reads.
- **i18n beyond NO/EN** — the strings file scales to more languages
  mechanically, but wait for actual demand.
- **Dedicated backend** — evaluated 2026-07-12 and rejected for now: Hasura
  is a thin data pipe, authz lives in app code, and the clean seams
  (`hasuraAdmin`, `lib/server` guards) keep an incremental migration cheap if
  server-side PDF generation, queues, or websockets ever become requirements.
  Protect those seams.

## Explicitly frozen

- The legacy `/verify` route and everything listed under it in CLAUDE.md —
  untouched until ~2030.
- The v1 canonical-hash contract (`src/util/canonicalHash.ts` +
  `certParams.ts`) — any change invalidates printed certificates.

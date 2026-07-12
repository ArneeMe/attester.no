# Roadmap

Deliberate future work, with the reasoning captured so it doesn't have to be
re-derived. Items are parked, not forgotten — each says what unblocks it.

## Near-term (unblocked, just needs doing)

- **Live end-to-end pass against real Nhost** before onboarding a stranger
  org: password reset email, signup (check whether email verification is on),
  invite redemption, issue + verify one attest on paper, confirm the sweep
  deletes an expired submission.
- **Pilot**: echo + one external org through the full lifecycle.

## Needs a decision or an account (owner: the human)

- **Error tracking** — the most important gap once strangers depend on the
  product; today production failures are invisible (`console.error` only).
  Sentry or Cloudflare-native. Do this before promoting beyond people you know.
- **Email provider** — `RESEND_API_KEY`/`NOTIFY_EMAIL_FROM` enable submission
  notifications and invite emails (both already ship dark without it). A short
  TTL is only comfortable with notifications on.
- **`hei@attester.no`** — referenced in the help dialog, /om, and
  /personvern. Must actually exist.
- **Privacy policy substance** — /personvern was drafted faithfully to the
  architecture, but it is a commitment; the controller framing and contact
  details need the owner's sign-off.

## Design options captured (build when the need is real)

- **24h-after-issuance regeneration window.** Today the window runs from
  *submission* (one `SUBMISSION_TTL_HOURS` constant); a submission issued at
  hour 23 has 1h of regeneration left. If orgs hit this, switch the sweep to
  an explicit `expires_at` column (set at creation, bumped at issuance) —
  small migration + sweep change. Decided against preemptively (2026-07-12).
- **Hash algorithm v2 escape hatch.** Documented in CLAUDE.md ("version-tag
  the hash"). Not implemented on purpose; the dispatch costs nothing until
  actually needed.
- **Cert revocation.** Would need a `revoked_at` column + verify-path check
  + admin UI + policy decisions (who may revoke, is it visible publicly).
  Nothing stores personal data, so revocation is purely a trust feature.
- **Durable rate limiting** (Cloudflare KV/DO) if the per-isolate limiter
  proves too soft at real scale. The seam is one function
  (`checkRateLimit`).
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

# Roadmap

Deliberate future work, with the reasoning captured so it doesn't have to be
re-derived. Items are parked, not forgotten — each says what unblocks it.

## Near-term (unblocked, just needs doing)

- **Live end-to-end pass against real Nhost** before onboarding a stranger
  org: password reset email, signup, invite redemption, issue + verify one
  attest on paper, and confirm the sweep deletes an *issued* submission after
  the window while leaving an unissued one alone.
- **Pilot**: echo + one external org through the full lifecycle. The
  onboarding path now exists end to end — a request at `/ny-organisasjon`,
  approval at `/admin`, and an invite to the contact address — so the
  external org no longer needs hand-holding through signup.

## Needs a decision or an account (owner: the human)

- **SEO owner actions** — Search Console/Bing verification, sitemap
  submission, backlinks from member orgs. Full playbook: docs/SEO.md.

- **Error tracking** — the most important gap once strangers depend on the
  product; production failures are invisible (`console.error` only, and
  Cloudflare's log is not retained). Three options, separated by lock-in:
  Workers Logs is Cloudflare config with no code; a `platform_errors` table
  rides the `hasuraAdmin` seam and works anywhere Postgres does; Sentry is a
  third vendor but host-agnostic. If a table, store message and route only —
  never request bodies, or it becomes the volunteer-data store the privacy
  model forbids. Do this before promoting beyond people you know.
- **Email sending needs DNS.** Admin notices and invites go through Resend
  (`RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`). Resend only sends from `attester.no`
  once its DKIM records are in DNS. A working mailbox is not enough. Until
  then nothing is queued or sent and the platform behaves as before.
- **`hei@attester.no`** — referenced in the help dialog and /om. Must
  actually exist.
- **Privacy policy** — deliberately NOT shipped. A drafted `/personvern` was
  closed unmerged (2026-08): publishing one is a legal commitment the owner
  isn't positioned to make. `/om` covers the mechanics factually instead. If a
  policy is ever wanted, it needs real legal input, not a faithful-to-the-code
  draft.

## Known gaps

- **One of the three silences remains.** The owner is pushed a notification
  when an organisation applies, and org admins are emailed when a submission
  is waiting. The volunteer still hears nothing after submitting and cannot
  check or chase. A pending count in the org nav would still help admins who
  have no email provider configured.

- **A failed request is now invisible to everyone.** #61 stopped routes
  returning the caught message, which was right — it was leaking Hasura's
  table and constraint names to anonymous callers. The consequence is that
  `console.error` into Cloudflare's ephemeral log is the only remaining
  record, so miss the moment and the reason is gone. See "Error tracking"
  above; #61 did not create this, but it removed the last accidental
  workaround.

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

## The platform rebuild (decided 2026-11-12)

The MVP is one Next.js app that is also the backend. The next stage needs
several frontends (web, an admin mobile app), outbound integrations (email
notices, Digipost delivery) and, some day, customers calling the API. A backend
on Nhost was rejected on 2026-07-12 with integrations named as the reason to
revisit. Integrations are now the goal, so this replaces that decision.

The work lands on `develop`, not `main`. The cut-over needs downtime and the
owner chooses when. See CLAUDE.md "How this repo is worked".

### Layout

```
apps/web          Next.js on Cloudflare Pages. UI only.
apps/api          The backend: /v1 handlers, use cases, ports and adapters.
packages/shared   Hash, cert params, types, validation, PDF input. One copy.
Dockerfile        Builds apps/api into one container.
```

Nhost Functions were tried first and dropped (2026-11-13): no sub-path
routing, ten functions and ten seconds on the free plan, a project that
pauses after a week idle, and no npm workspaces. The API now runs as a
long-running Node process in a container. Nhost still provides Postgres,
Hasura and Auth. A Java rewrite was weighed and declined: pdfme is
JavaScript only, and the hash code would exist in two languages.

### Principles

1. **One API, every client.** Web, mobile and any later customer use the same
   versioned `/v1` HTTP API with bearer tokens. No client gets a private route.
2. **The backend is host-neutral.** `apps/api` handlers take a web-standard
   `Request` and return a `Response`. Only `server.ts` knows it is a Node
   server, so the same code can move to another host.
3. **Ports and adapters.** The core names what it needs (`Store`,
   `NoticeChannel`, `CertificateChannel`, `Clock`) and never imports a provider.
   Hasura, Resend and Digipost are adapters. A new channel is a new adapter.
4. **The server renders the PDF.** It already holds the submission until
   issuance, so rendering there exposes nothing new, and it is the only way a
   mobile client or a delivery channel can issue.
5. **Nothing outlives its purpose.** A rendered PDF exists only in a delivery
   row until the channel confirms, with a hard time limit behind it. A
   fødselsnummer is deleted the moment Digipost accepts the letter. What stays
   is "sent via Digipost at time T".
6. **Email carries notices, never certificates.** "Your organisation has a new
   request" and nothing about who or what.
7. **The hash stays the certificate.** Everything in CLAUDE.md about the hash,
   the frozen legacy route and what the server may store still holds.

### Digipost

attester.no holds one Digipost sender agreement and sends on behalf of every
organisation. The letter is from attester.no and names the issuing
organisation.

- An organisation turns Digipost delivery on. Its form then offers an optional
  fødselsnummer field.
- The fødselsnummer is stored apart from the certificate data. It is never in
  the QR link, never in the hash and never in a log.
- Before issuing, the backend asks Digipost whether the person can receive
  mail there. The admin sees "can be sent to Digipost" or "download instead".
- No print fallback. A person without Digipost gets the PDF from the admin, as
  today.

### Steps, one PR each

1. Monorepo layout and `packages/shared`. No change in behaviour, hash output
   byte-identical.
2. `apps/api` with the existing routes ported behind `/v1`, and the web app
   as a plain client of it.
3. Nhost in git: `nhost.toml`, migrations, metadata.
4. Server-side PDF rendering and issuance through the API.
5. Outbox and the email channel: tell admins a submission is waiting.
6. Digipost: the opt-in, the fødselsnummer field, identify, deliver.
7. Scheduled work: the retention sweep, outbox retries and the delivery time
   limit on a cron trigger. The lazy sweep stays until the cron has run a while.
8. API shape the mobile app needs (list pending, approve, issue, deliver).

Not planned: tenancy in Hasura row permissions. Clients never talk to Hasura,
so tenancy stays in one tested code path in `apps/api`. Customer API keys
are not built either, but `/v1` leaves room for them.

### Status (2026-11-13)

Steps 1, 2, 4, 5, 6 and 7 are on `develop`. Not done:

- **Step 3, Nhost config in git.** Hasura metadata and `nhost.toml` were not
  written by hand. A deploy replaces the live metadata, and a wrong file
  would untrack tables in production. The safe start is `nhost init --remote`
  against the real project, committed as is. Migrations still live in
  `scripts/migrations/` and are run by hand.
- **Step 8, the mobile app.** The API it needs exists: bearer token, list
  submissions, preview, issue, deliver. Nothing mobile-specific was added.
- **Nothing has run against Nhost, Resend or Digipost.** Everything is
  tested against fakes. The first live run is the real test of the function
  bundle, the proxy, email and the Digipost signature.

### Security audit (2026-11-13)

An independent read of the API found no broken tenancy, no route missing its
auth check and no query built from input. What it did find is fixed on
`develop`: Digipost could be self-granted by an organisation, a submission
could carry hidden fields, an unverified email could inherit rights, and
several requests could exhaust the one shared process.

Left open on purpose, each needing a decision or more than a small fix:

- **The Cloudflare adapter is end of life.** `@cloudflare/next-on-pages` caps
  Next at 15.5.2, which has a critical flaw. Next is now 15.5.29 and the
  Pages build still works, with a peer warning. Move to the OpenNext adapter.
- **`pdfjs-dist` under pdfme 5** has a known flaw where a malicious PDF runs
  script when opened. It is only reached when an admin loads a PDF into the
  designer in their own browser. The fix is pdfme 6, a major upgrade that
  needs the designer and every template re-tested.
- **Unissued submissions keep a sealed fødselsnummer as long as they wait.**
  A time limit on the number alone (say 30 days) would close this without
  touching the rule that unissued submissions are never swept.
- **Lists are unpaged.** The submissions list, and the templates list with
  every revision's PDF, grow without bound. The queue ceiling limits the
  first. The second needs the list to stop returning `base_pdf`, which
  touches three admin pages.
- **A wrong fødselsnummer sends a certificate to the wrong person.** The
  check digits catch typing errors, not someone entering another person's
  number. The admin reviews the request but cannot see the number. Showing
  the name Digipost has for the recipient before sending would close it.
- **Members can add any existing account without its consent**, and the
  answer reveals whether an email has an account. Invites already do this
  job properly. Removing the direct add is a UI change.
- **Two members removing each other at the same moment** can leave an
  organisation with none. The platform owner can repair it.
- **No rate limit.** The ceilings above bound the damage. Real limiting
  belongs at the edge (Cloudflare) in front of both web and API.

### Next steps, in the order they pay off

1. **Go live on the new structure.** Deploy the API container, point
   Cloudflare Pages at `apps/web`, run the migrations, then do one full pass
   against the real services: sign in, submit, issue, verify on paper, one
   email, one Digipost letter with the test certificate.
2. **Error tracking.** Still the biggest blind spot. The API is now one
   long-running process, so Sentry or a `platform_errors` table is a small
   job. Store route and error kind only, never a request body.
3. **Replace the Cloudflare adapter** with OpenNext, so Next can follow its
   security releases without a peer warning.
4. **Database changes in git.** Run `nhost init --remote` once, commit the
   result, and let migrations and tracking deploy with the code. Four tables
   were added by hand this round; that does not scale.
5. **Tell the volunteer what happened.** The last silence: nothing reaches
   the person who asked. Digipost delivery covers those who chose it. For the
   rest, a status page behind the submission id needs no address at all.
6. **A pending count in the org nav**, for admins without email notices.
7. **The mobile app** against `docs/API.md`. Paging the submissions list and
   slimming the templates list should come first, for its sake.
8. **pdfme 6**, with the designer and all templates re-tested.
9. **Hash v2** when a reason to touch certificates appears: escape the
   separator and tag the version, as CLAUDE.md describes.

### Owner actions the code cannot do

- Run the two new migrations and track their tables (`notices`,
  `org_settings`, `submission_recipients`, `deliveries`).
- Digipost: convert the certificate to a PEM key and set the secrets, see
  DEVELOPMENT.md.
- Choose a host for the API container, deploy it and set its secrets.
- Point Cloudflare Pages at `apps/web`.
- Add the DNS records Resend asks for, so mail can be sent from `attester.no`.
- Sign the Digipost sender agreement and supply the certificate as a secret.

## Explicitly frozen

- The legacy `/verify` route and everything listed under it in CLAUDE.md —
  untouched until ~2030.
- The v1 canonical-hash contract (`packages/shared/src/canonicalHash.ts` +
  `certParams.ts`) — any change invalidates printed certificates.

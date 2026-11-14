# Roadmap

Deliberate future work, with the reasoning captured so it doesn't have to be
re-derived. Items are parked, not forgotten — each says what unblocks it.

## Where things stand (2026-11-14)

`main` is the MVP: one Next.js app that is also the backend. `develop` holds
the rebuild described under "The platform rebuild" below, nineteen PRs (#70
to #88). `develop` is green in CI and has never been deployed.

On `develop`, built and tested:

| Area | State |
|---|---|
| Monorepo: `apps/web`, `apps/api`, `packages/shared` | Done |
| API as a container with its own scheduler | Done. CI builds the image and checks it starts |
| Server renders the PDF and registers the certificate | Done |
| Email notices to admins through an outbox | Done |
| Digipost delivery, granted per organisation by the owner | Done against a fake that checks signatures. Never sent a real letter |
| Security audit and fixes | Done. Open items listed below |
| Own error tracking and JSON logging | Done for the API, the browser and the web app's server code |
| Status link and reminder for the volunteer | Done |
| Pending count in the menu, paged and lighter lists | Done |
| Template editor in four plain steps | Done. Dragging fields in the drawing has no automated test |
| `docs/API.md` for the mobile app | Done |
| Local test rig, also run in CI | Done. Passes 36 checks. Not yet run on the owner's machine |

**What "tested" means here.** Unit tests, e2e tests with the API mocked, and
the local test rig (DEVELOPMENT.md "The local test rig"), which runs the real
Postgres, Hasura, Nhost Auth and API image and passes every flow through
them in CI. Not yet met: Nhost's hosted project, Cloudflare Pages, Resend and
the real Digipost. The Digipost adapter passes a fake that checks signatures
the way Digipost does, and matches the owner's Android client, but has never
sent a real letter.

**Urgent, and separate from the rebuild:** `main` runs Next 15.5.2, which has
a critical flaw that allows code to run on the server. `develop` is on
15.5.29. Take that bump to `main` on its own if the cut-over is not close.

### Before the cut-over: try it

1. On your own machine, with invented data: `npm run stack:up`, then
   `npm run dev`. DEVELOPMENT.md "The local test rig" has the addresses, the
   logins and what the rig covers.
2. Against Digipost's test environment: point the rig's API at
   `api.test.digipost.no` with the test certificate (same section). This is
   the only way to see a real Digipost letter before production.
3. A staging copy, as the dress rehearsal: a second Nhost project, the API
   container on its real host and a Cloudflare preview. The rig cannot stand
   in for those three.

### Cut-over checklist, in order

Details for each step are in DEVELOPMENT.md "Deploy checklist".

1. Turn on email verification in Nhost. The API refuses `/admin` and invite
   redemption to an unverified address.
2. Run the four new migrations and track their tables in Hasura:
   `2026-11-notices.sql` (`notices`), `2026-11-digipost.sql` (`org_settings`,
   `submission_recipients`, `deliveries`), `2026-11-platform-errors.sql`
   (`platform_errors`) and `2026-11-submission-status.sql` (three columns on
   `submissions`; reload the table in Hasura). The admin dashboard fails
   without the second, and submitting fails without the fourth.
3. Choose a host for the API container, deploy it and set its secrets.
   `PUBLIC_APP_URL` is required.
4. Point Cloudflare Pages at `apps/web` and set `API_URL` to the API's `/v1`
   root. The Cloudflare preview check has failed on every PR since the
   monorepo move, most likely because the project still builds from the repo
   root.
5. Merge `develop` to `main`.
6. One full pass against the real services: sign in, password reset, invite,
   submit, issue, verify on paper, and confirm the sweep deletes an issued
   submission after the window and leaves an unissued one alone. Then check
   that `/admin` shows no errors.
7. Optional, each can wait: Resend DKIM records in DNS for email; the
   Digipost sender agreement, the key as PEM and `DELIVERY_KEY` for Digipost.

After that, the **pilot**: echo plus one external organisation through the
whole lifecycle.

## Needs a decision or an account (owner: the human)

- **SEO owner actions** — Search Console/Bing verification, sitemap
  submission, backlinks from member orgs. Full playbook: docs/SEO.md.

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

- **The API being down is still invisible.** The API records its own errors
  and those of the browser and the web app (ARCHITECTURE "Logs and errors").
  It cannot report its own death.

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
  per-isolate on the edge runtime, so it never really bounded anything. The
  API is now one long-running process, so an in-process limiter would work
  for a single instance. Not built: the ceilings on body size, queue length
  and pending requests bound the damage, and a limiter in the process dies
  the day there are two instances. If abuse becomes real, put it in a proxy
  in front of the API, and keep it something that moves with the code.
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

### Not done from the list above

- **Step 3, Nhost config in git.** Hasura metadata and `nhost.toml` were not
  written by hand. A deploy replaces the live metadata, and a wrong file
  would untrack tables in production. The safe start is `nhost init --remote`
  against the real project, committed as is. Migrations still live in
  `scripts/migrations/` and are run by hand.
- **Step 8, the mobile app.** The API it needs exists and is documented in
  `docs/API.md`. Nothing mobile-specific was added.

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
- **A wrong fødselsnummer sends a certificate to the wrong person.** The
  check digits catch typing errors, not someone entering another person's
  number. The admin reviews the request but cannot see the number. Showing
  the name Digipost has for the recipient before sending would close it.
- **Two members removing each other at the same moment** can leave an
  organisation with none. The platform owner can repair it.
- **No rate limit.** The ceilings above bound the damage. Real limiting
  belongs at the edge (Cloudflare) in front of both web and API.

### Decisions waiting on the owner

Asked 2026-11-13, not answered yet. None of them blocks the cut-over.

- **Where the API container runs.** One small European VPS that also holds
  an uptime monitor and future hobby backends, or a managed container host.
- **The Android app in `arneeme/apps`.** It calls the unversioned `/api/...`
  paths and stops working at cut-over. Updating it needs push access there.
  It could also issue from the phone now.
- **The look as a theme.** Whether attester's colours and type become a
  second theme in `arneeme/design`. The Android app copies them by hand.
- **Product or workshop project.** If attester may become a product, the
  Android app needs its own package name before anyone else installs it.

### Next steps, in the order they pay off

1. **Go live on the new structure.** The cut-over checklist at the top of
   this file.
2. **Finish error tracking.** Built: the API's own errors, the browser's and
   the web app's. Left:
   - An uptime check from outside against `/healthz` and the front page.
     Self-hosted Uptime Kuma or Gatus is open source and needs one small
     container. Needs somewhere to run.
   - Log retention. Logs live as long as the container host keeps stdout.
     If that is too short, run Vector with Loki or plain files on a volume.
3. **Replace the Cloudflare adapter** with OpenNext, so Next can follow its
   security releases without a peer warning.
4. **Database changes in git.** Run `nhost init --remote` once, commit the
   result, and let migrations and tracking deploy with the code. Five tables
   were added by hand this round; that does not scale.
5. **The mobile app** against `docs/API.md`. The Android app in
   `arneeme/apps` still calls the unversioned `/api/...` paths and will stop
   working at cut-over until it is moved to `/api/v1/...`. It can also issue
   now, since the server renders the PDF.
6. **pdfme 6**, with the designer and all templates re-tested.
7. **Hash v2** when a reason to touch certificates appears: escape the
   separator and tag the version, as CLAUDE.md describes.

## Explicitly frozen

- The legacy `/verify` route and everything listed under it in CLAUDE.md —
  untouched until ~2030.
- The v1 canonical-hash contract (`packages/shared/src/canonicalHash.ts` +
  `certParams.ts`) — any change invalidates printed certificates.

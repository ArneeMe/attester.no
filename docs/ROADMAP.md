# Roadmap

Deliberate future work, with the reasoning captured so it doesn't have to be
re-derived. Items are parked, not forgotten — each says what unblocks it.

## Where things stand (2026-11-28)

The rebuild is live. `develop` was merged to `main` on 2026-11-28 (#111) and
`attester.no` runs on it:

| Part | Where |
|---|---|
| Web (`apps/web`) | Cloudflare Worker `attester-no`, built by Workers Builds from `main` |
| API (`apps/api`) | Container on UpCloud in Stavanger, `api.attester.no`, from `ops/api/` |
| Database and login | Nhost (Postgres, Hasura, Auth), as before |

Tried against the real services on 2026-11-28: sign in, `/admin`, submit,
issue, verify a new certificate and an old echo one, password reset.

Not yet met in production:
- **Email.** Resend needs its DKIM records in DNS (below). Until then no
  notice or invite email is sent; the invite dialog shows the link to copy.
- **Digipost.** Needs the sender agreement, the key and `DELIVERY_KEY`. The
  adapter has only met a fake that checks signatures.
- **The retention sweep on real data.** Confirm once that an issued
  submission disappears after the window and an unissued one stays.

The old Cloudflare Pages project (`inf319-certificate`) has its builds paused.
Cloudflare refuses to delete a project with many deployments; delete those
first if the project is ever removed.

### The cut-over, as it went

Kept so the next move does not rediscover the same things:
- Email verification stays off in Nhost; platform admins are marked verified
  once in SQL.
- The four 2026-11 migrations ran, and **every new table had to be tracked
  in Hasura by hand**. An untracked `org_settings` gave a 500 on the admin
  dashboard.
- `PUBLIC_APP_URL` must be in the API's `.env`, or issuing fails with a 500.
- Workers Builds: build `npm run cf:build -w @attester/web`, deploy
  `npm exec -w @attester/web -- wrangler deploy`, version command
  `npm exec -w @attester/web -- wrangler versions upload`. `npx wrangler`
  from the root fails, wrangler lives in `apps/web`. `NEXT_PUBLIC_NHOST_*`
  are build variables; `API_URL` and `NHOST_ADMIN_SECRET` are runtime
  **secrets**, since a deploy replaces plain variables with `wrangler.toml`.
- Cloudflare's Email Address Obfuscation rewrites `hei@attester.no` in the
  HTML and causes React error #418. Turn it off for the zone.

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

- **The API being down is invisible until the uptime check runs.** The
  check is built (`ops/uptime/`, DEVELOPMENT.md "Deploy checklist") but needs
  a machine to run on, and not the API's own host.

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

The work landed on `develop` and went live on 2026-11-28 (top of this file).

### Layout

```
apps/web          Next.js on Cloudflare Workers. UI only.
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
   fødselsnummer is deleted the moment Digipost accepts the letter, and after
   30 days if no letter was sent. What stays
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

- **A wrong fødselsnummer sends a certificate to the wrong person.** The
  check digits catch typing errors, not someone entering another person's
  number. The admin reviews the request but cannot see the number. Showing
  the name Digipost has for the recipient was the planned fix, but it cannot
  be built: identifying by fødselsnummer returns only a result code, never a
  name (`identification-result` in Digipost's `api_v8.xsd`, checked
  2026-11-15).
- **No rate limit.** The ceilings above bound the damage. Real limiting
  belongs in front of both web and API: Cloudflare today, Caddy once
  Cloudflare is gone (below).

### Decisions waiting on the owner

Asked 2026-11-13, not answered yet.

- **The Android app in `arneeme/apps`.** It calls the unversioned `/api/...`
  paths, which are gone since the cut-over, so it does not work until it is
  moved to `/api/v1/...`. Updating it needs push access there. It could also
  issue from the phone now.
- **The look as a theme.** Whether attester's colours and type become a
  second theme in `arneeme/design`. The Android app copies them by hand.
- **Product or workshop project.** If attester may become a product, the
  Android app needs its own package name before anyone else installs it.

### Next steps, in the order they pay off

1. **Finish going live.** Resend DNS, then Digipost, then the sweep check
   (top of this file).
2. **Finish error tracking.** Built: the API's own errors, the browser's and
   the web app's. Left:
   - Run the uptime check (`ops/uptime/`, Gatus). Built and tested against
     fakes; needs a machine that is not the API's own server.
   - Log retention. Docker keeps the API's log in five files of 10 MB on the
     server (`ops/api/docker-compose.yml`).
     If that is too short, run Vector with Loki or plain files on a volume.
3. **Database changes in git.** Run `nhost init --remote` once, commit the
   result, and let migrations and tracking deploy with the code. Five tables
   were added by hand this round; that does not scale.
4. **The mobile app** against `docs/API.md`. The Android app in
   `arneeme/apps` still calls the unversioned `/api/...` paths and does not
   work until it is moved to `/api/v1/...`. It can also issue now, since the
   server renders the PDF.
5. **Hash v2** when a reason to touch certificates appears: escape the
   separator and tag the version, as CLAUDE.md describes.

## Leaving Cloudflare (the owner's wish, 2026-11-28)

The aim is to run everything on hosts the owner can move, ideally Nordic or
self-hosted, with Cloudflare gone in the end. Nothing is decided on timing.

What depends on Cloudflare today:
- **Hosting the web app.** The OpenNext adapter (`@opennextjs/cloudflare`),
  `apps/web/wrangler.toml`, `open-next.config.ts`, the `cf:build` script and
  Workers Builds.
- **DNS for `attester.no`.** The domain is registered at Subsys; the zone is
  on Cloudflare.
- **The old Pages project**, paused.

The likely path, in small steps:
1. Run `apps/web` as a plain Node server (`next start`, or `output:
   "standalone"` in a container) beside the API in `ops/`, with Caddy serving
   both `attester.no` and `api.attester.no`. The UpCloud server has 1 GB; two
   Node processes may need 2 GB.
2. Point `attester.no` at that server, keep the Worker as a fallback for a
   while, then remove the adapter, `wrangler.toml` and the `cf:build` script.
3. Move DNS from Cloudflare back to the registrar, or to a Nordic DNS host.
4. Delete the Worker and the Pages project.

The cost: no CDN and no DDoS shield in front. At this size neither matters;
rate limiting would move into Caddy. Rules already in place make this
cheaper: the web app's code has no Cloudflare-specific API, and logs and
errors are not built on Cloudflare features (CLAUDE.md "Logs and errors").

## Explicitly frozen

- The legacy `/verify` route and everything listed under it in CLAUDE.md —
  untouched until ~2030.
- The v1 canonical-hash contract (`packages/shared/src/canonicalHash.ts` +
  `certParams.ts`) — any change invalidates printed certificates.

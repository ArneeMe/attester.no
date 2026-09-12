# Next steps

What is worth doing next, and why. `ROADMAP.md` holds work already decided and
parked; `IDEAS.md` holds unbuilt features with their open questions. This file
is the sequenced view across both, plus the gaps nothing had written down yet.

**The assumption this file is written under:** attester.no is a side project
that serves a handful of Norwegian volunteer organisations well. It is not
chasing scale. Ideas that only pay off with hundreds of orgs are named at the
bottom and deliberately left alone.

Every claim below cites a file and line. If one stops matching, fix the line or
delete the claim — a next-steps doc nobody trusts is worse than none.

## Where things stand

Live on `main`, which auto-deploys. #57 (comment trim) is open; #58 (owner email
notifications) is a draft on hold pending one question: which provider Nhost's
SMTP already points at, since if it has an HTTP API then Resend is unnecessary.
No migrations pending.

---

## 1. Before onboarding an org that isn't echo

### Every API route returns raw Hasura errors

`src/lib/server/hasura.ts:13` throws the provider's own text:

```ts
if (json.errors?.length) throw new Error(json.errors[0].message);
```

and every route re-emits it. The identical
`return NextResponse.json({ error: (e as Error).message }, { status: 500 })`
appears **27 times across all 17 route files** — every API route in the app.

The one that matters is `src/app/api/org/[slug]/submissions/route.ts:122`: the
**unauthenticated public** volunteer POST. A constraint violation there hands
table, column and constraint names to an anonymous caller. Under this project's
privacy model that is a real leak, not untidiness.

Fix: one `serverError()` helper used in the 500 catch-alls only. Deliberate
user-facing 400s and 404s stay exactly as they are. The pattern already exists
once, at `templates/[id]/route.ts:207`, which logs the detail instead of
returning it.

### Double-submit on issuance

`src/util/confirmDialog.tsx:56` renders its confirm button with no `disabled`
prop at all, and `handleConfirm`
(`src/app/login/adminpage/[orgSlug]/page.tsx:161`) awaits two network
round-trips with the dialog open and the button live throughout.

The server already knows, at `src/app/api/org/[slug]/certificates/route.ts:107`:

> This check-then-insert has a small race window under concurrent double-clicks

Adding a busy prop to `ConfirmDialog` fixes four call sites at once: issuance,
the volunteer's own submit (`src/app/orgSubmissionForm.tsx:110`), and both
delete flows. The codebase already does this correctly in
`handleBatchIssueConfirm` and on the login form — this is inconsistency, not
ignorance.

Do **not** propose the DB unique index as part of this. ROADMAP records it was
tried in #35 and rejected as more complexity than the problem warrants.

### A shipped endpoint no one can reach

`deleteTemplate` (`src/util/databaseInteractions/templateService.ts:57`) is
referenced nowhere in `src/`, `e2e/` or `scripts/`. The `DELETE` handler on
`templates/[id]` therefore has no caller: **an admin cannot delete a PDF
template from the UI.** That is a functional gap, not dead code.

`requireOrgMemberById` (`src/lib/server/apiAuth.ts:56`) is likewise unreferenced,
and its doc comment points at a flow that uses the other guard.

### Six unlabelled destructive buttons

Bare `<DeleteIcon />` with no accessible name, announced to a screen reader as
just "button", at `rediger/page.tsx:307`, `:410`, `:504`, `:609`, `:645` and
`edit_pdf/SchemaEditor.tsx:109`. All six delete something. The fix pattern is
already in the repo at `medlemmer/page.tsx:152` (`aria-label={a.removeAria}`).

### The admin shell is hardcoded Norwegian

`src/app/login/adminpage/layout.tsx:78`, `:81`, `:84` — "Velkommen",
"Bytt organisasjon", "Logg ut" — despite `useAdminLang()` being in scope.
Switching to English leaves the chrome Norwegian on every admin page.

---

## 2. Make regressions visible

### Component tests are structurally impossible

`vitest.config.ts` sets `environment: 'node'` and
`include: ['src/**/*.test.ts']`. No `.test.tsx`, no DOM. That is *why* the two
defects above could regress silently — nothing can assert on a button's
disabled state or a label's presence. Enabling jsdom and `.test.tsx` unblocks
the whole class.

### The authorisation gates have no tests

Ten of the eleven modules in `src/lib/server/` are untested; only
`validateAssetContent.ts` is covered. The untested list includes:

- `apiAuth.ts` — `requireSession` and `requireOrgMemberBySlug`, the guard on
  every org-scoped route
- `ownership.ts` — the cross-org checks
- `retention.ts` — the deletion sweep

`src/util/retention.ts` *is* tested, but that is only the client-side
hours-remaining calculation, not the sweep. Tenancy lives in app code by
design (`ARCHITECTURE.md`), which makes these the highest-value tests missing
from the repo.

---

## 3. Finish the design pass

**Two of twenty pages use the landing design layer.** Only `/` and `/om`. The
verify client imports tokens but is hand-rolled. Every page a user actually
works in is default MUI.

- **The volunteer form is the biggest gap.** `src/app/orgSubmissionForm.tsx`
  imports stock `Container`/`Paper`/`Typography` and nothing from
  `app/style/tokens`. A volunteer arrives from a carefully designed landing page
  and lands on this, with a raw ✅ emoji as the success graphic (line 191).
- **The four auth pages are the cheapest win.** `login`, `registrer`,
  `login/glemt` and `login/reset` share a near-identical
  `Container maxWidth="xs"` structure. One shared shell on `PageShell` covers
  all four.
- **Mobile breaks at ~400px in two places.** The volunteer form header grid uses
  `xs: 7 / 1 / 2` (`orgSubmissionForm.tsx:210-228`), so a ~30px column wraps a
  text button. The admin dashboard action bar (`[orgSlug]/page.tsx:250-267`)
  declares only `sm`, no `xs` — the filter row directly below it does it
  correctly, so this is an oversight rather than a convention. Separately, the
  designer's `minHeight: 600` (`DesignerComponent.tsx:312`) fills any phone
  screen in portrait.

---

## 4. Product ideas

Written the way `IDEAS.md` asks for: with the open question, not as settled
proposals. Grouped by who they serve.

**Already shipped — do not propose:** recording which admin issued a
certificate. `issued_by` exists (`2026-07-issued-by.sql`), is written at
`certificates/route.ts:139` and surfaced with the issuer's email at `:52`.

### For the volunteer

**"Legg til på LinkedIn".** The point of an attest is proving experience to
someone later, and the platform stops one step short of where people actually
put it. LinkedIn's add-to-profile flow takes a certification name, issuing
organisation, date, credential id and credential URL — and the verify URL *is* a
credential URL, permanently checkable by anyone. Probably the best
value-per-effort idea in this file.
*Open question:* that URL carries their personal data in its query string.
Publishing it must be an explicit, clearly-labelled choice, never a default.

**"Mine attester" — a wallet with no server.** People lose PDFs. A page that
remembers the verify URLs someone has been given, in `localStorage` only, costs
the privacy model nothing *precisely because* the server never learns anything.
*Open question:* per-browser, and gone when site data is cleared. Is a
forgettable wallet better than none, or does it promise more than it keeps?

**One attest covering several roles.** A volunteer with three roles over three
years gets three PDFs. The shape half-exists already — the legacy migration maps
`group1/start1/role1` through `group3` — so a "samleattest" is closer than it
looks.
*Open question:* one hash covers one set of fields. This is a template and
form-schema question, not a hash-format change, and it must stay that way.

**Nothing is kept after submitting.** The confirmation screen
(`orgSubmissionForm.tsx:187-204`) shows next steps and a "send another" button.
No reference, no way to check back. This is the volunteer half of the silence
described under *For the platform*.

### For the organisation

**Bulk input, not just bulk issue.** An org doing end-of-year attests for forty
volunteers waits for forty form fills. Batch *issuance* exists
(`handleBatchIssueConfirm`); batch *input* does not. Pasting a roster would
collapse the slowest week of an org's year.
*Open question, and a real one:* the form exists so the volunteer asserts their
own facts. An admin typing on their behalf changes who vouches for the content.
That may be fine for a roster the org already maintains, and wrong in general.

**Handover when the board changes.** Norwegian student and youth organisations
turn over every year. Nothing warns before the last remaining admin removes
themselves, and there is no recovery path short of the platform owner
intervening at `/admin`. Specific to this audience, and currently unhandled.

**More starter templates.** `starterTemplates.ts` ships three — `Kursbevis`,
`Deltakerbevis` and `Rolleattest`. A new org's first five minutes decide whether
it sticks, and more ready-made Norwegian shapes (styreverv, dugnadstimer) is the
cheapest onboarding improvement available.

**Export everything.** For an org deciding whether to depend on a one-person
side project, "you can take your templates and your issued-certificate records
with you" is a trust argument more than a feature. Both are already readable.

**Losing a PDF is recoverable — inside the window, and nobody knows it.**
Issuance is idempotent and deliberately does not re-stamp `issued_at`, so
"Generer PDF" can be re-run until the sweep fires. Worth documenting as a
support path. After the window the data is gone by design: say that plainly, so
nobody proposes snapshotting certificate data to enable re-issue. CLAUDE.md
forbids it outright.

### For the verifier

**Say what an attest does and does not prove.** It proves this organisation
issued exactly this text and that nothing has been altered since. It does not
prove the organisation is trustworthy, or that the claim is true. That is a
paragraph on the verify page, and the honesty is the product.

### For the platform

**The silence runs both ways.** A volunteer submits and hears nothing. Nothing
tells the admin a submission is waiting — the org nav
(`[orgSlug]/layout.tsx:32-40`) is six plain buttons with no count, and the org
picker shows only names, so an admin with three orgs cannot tell which one has
work. ROADMAP records the admin half; treating both as one problem is the new
framing. Cheapest first move: an unissued count in the nav and the picker.

**Check the organisation against Enhetsregisteret.** Self-registration is parked
because anyone could claim to be "Røde Kors Oslo". Asking for an
organisasjonsnummer and validating the name against Brønnøysund's public
register is a real vetting signal, and could unblock the request form.
*Open question, and it limits the idea:* plenty of small student societies and
local chapters are not registered at all. This can be a signal that speeds up
approval — never a gate that blocks it.

**`/admin` has no in-app link.** The only repo-wide reference to the path is
`robots.ts:13`, adding it to `disallow`. Plausibly deliberate. Worth confirming
rather than fixing.

**The SEO content page.** «Mal for attest til frivillige» — the one un-built
*code* item in `SEO.md`, aimed at the most obvious query in the niche.

### Not worth it at this size

Named so they stop coming up: per-org custom domains, SSO, a public API or
webhooks for orgs, a mobile app, database-level multi-tenancy. Each only pays
off at a scale this project has decided not to chase.

---

## Deliberately not proposed

So this file doesn't reopen settled questions. Each has its reasoning in
CLAUDE.md or ROADMAP.md:

- **A privacy policy or any legal text.** Owner's standing decision: publishing
  one is a commitment that needs real legal input, not a faithful-to-the-code
  draft. `/om` covers the mechanics factually instead.
- A rate limiter; a DB unique index on certificates; unified verify routes;
  per-org columns on `organizations`; snapshotting certificate data; a secondary
  TTL backstop for unissued submissions; a dedicated backend; preemptive hash-v2
  dispatch.

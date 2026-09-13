# Ideas — not built, captured for later

Parked feature ideas with enough reasoning that a future session (human or
AI) can pick one up without re-deriving the context. Move an idea out of
here and into actual code/docs when it's built.

## Platform feedback (submitter/admin → platform owner)

**Status:** not built. An earlier pass built the wrong thing (see below) —
removed, not shipped.

**What's wanted:** a way for people using the product to send feedback
straight to the platform owner (the super admin who runs attester.no),
not to the organization they're interacting with. Two sources:

1. **Form submitters** — after submitting the volunteer form, a lightweight
   "how was this?" prompt that goes to the owner, not the org. Keep it
   anonymous, consistent with the platform's privacy model (no name, no
   submission reference, no IP).
2. **Org admins** — a "send feedback / report a problem" link somewhere in
   the admin chrome (nav or footer) that lets an org admin message the
   owner about the *platform itself* — bugs, feature requests, complaints.
   Unlike submitter feedback, these come from an authenticated session, so
   it's fine (probably useful) to know which org/person sent it.

**What was built instead, and removed:** a per-org feedback loop — volunteer
rates 1–5 stars + comment on the confirmation screen, routed to *that org's*
own admins via a new "Tilbakemeldinger" tab. That solves a different
problem (an org wanting feedback about itself) and was a misread of the
ask. Code lived in `src/app/api/org/[slug]/feedback/route.ts`,
`src/components/FeedbackWidget.tsx`,
`src/app/login/adminpage/[orgSlug]/tilbakemeldinger/`, plus a `feedback`
table migration — all removed. If per-org feedback turns out to be wanted
too, it's a separate feature from this one and can be rebuilt later; don't
conflate the two.

**Open questions for whoever builds this:**

- Storage: a `platform_feedback` table (gated by `requirePlatformAdmin`,
  same pattern as `/admin`) is the obvious fit, but for something this
  low-volume, a plain email via Resend to the owner's address might be
  enough and avoids adding a table + admin UI for a trickle of messages.
- Where does the submitter prompt live — the confirmation screen (highest
  reach, but adds friction right after the thing they came to do), or `/om`
  (lower reach, zero friction on the golden path)?
- Should the org-admin channel require the message to *not* be about a
  specific org's data (to keep the platform owner from becoming an
  accidental holder of volunteer information via a support message)? Worth
  a short reminder line in the UI either way.

## What happens to an attest after it is issued

**Status:** not built. The platform's involvement currently ends when the PDF
lands in someone's downloads folder, and the volunteer's actual goal — proving
the experience to an employer later — is one step further on.

Three ideas, increasing in ambition. They are independent; (a) is worth doing
whether or not the others ever are.

**a. Share to LinkedIn.** LinkedIn's add-to-profile flow takes a certification
name, issuing organisation, date, credential id and credential URL — and the
verify URL *is* a credential URL, permanently checkable. No standard, no
signing, no schema. Open question: the URL carries the holder's data in its
query string, so publishing it must be an explicit, clearly-labelled choice,
never a default.

**b. A wallet with no server.** Volunteers lose PDFs. A page remembering the
verify URLs someone has been given, in `localStorage` only, costs the privacy
model nothing *precisely because* the server never learns anything. Open
question: per-browser, and gone when site data is cleared — is a forgettable
wallet better than none, or does it promise more than it keeps?

**c. Sign the attest so it outlives the platform.** The deepest version.
Verification today requires attester.no to be up and holding the hash. If the
issuing organisation signed instead, a verifier could check against a public
key with the platform gone entirely. For a one-person project asking
organisations to depend on it, "your attests keep working if I stop paying the
bills" is a stronger trust argument than any export button.

This is a v2 of the hash contract, not an edit to v1 — CLAUDE.md already
reserves the escape hatch (`v=2` in the URL and in the hash inputs, verifier
dispatches on it, old certs stay v1 forever). Worth knowing the wider field
solved this with Open Badges (1EdTech) and W3C Verifiable Credentials, used by
Credly, Accredible, Canvas Credentials and others: credentials are
cryptographically signed, verify without contacting the issuer, and import to
LinkedIn natively. Adopting the standard rather than inventing a scheme is the
obvious move if this is ever built — but it is a standard, and standards have
surface, so scope it only when a real org asks.

## Checking an applicant against Enhetsregisteret

**Status:** not built, and **the useful half may not be available.**

Manual approval exists because anyone could claim to be "Røde Kors Oslo".
Checking the organisasjonsnummer against Brønnøysund is the obvious defence.

What research found (2026-09, confirm before relying on it): organisation
identity and **roles** are public open data via
`data.brreg.no/enhetsregisteret/api`, but **signatur and prokura are
restricted** — machine searches are limited to public authorities and
enterprises licensed for credit-information services, and the
national-ID-linked role data sits behind the same gate. There is a separate
Fullmakttjenesten API under the same restriction.

So "is this person entitled to sign for the organisation" is probably out of
reach for this project. Confirm eligibility with Brønnøysund before designing
anything.

What open data alone supports, and is still worth having: look up the number
at approval, show the registered name beside the requested one (a mismatch is
the cheapest impersonation signal there is), and list role-holders by name so
the human already making the judgement has the relevant fact in front of them.

**Keep it a signal, not a gate.** Plenty of student societies and local
chapters are not registered at all, and they are exactly the audience. The
`orgNumber` field on `org_requests` is already optional and MOD11-validated
(`src/util/orgRequest.ts`) for this reason.

## (add the next idea below this line)

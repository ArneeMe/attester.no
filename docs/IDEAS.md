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

## (add the next idea below this line)

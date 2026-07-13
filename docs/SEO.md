# SEO playbook

How attester.no gets found for searches like «attest frivillig arbeid»,
«frivillighetsattest» and «attest mal frivillig organisasjon». Half of this
is code (shipped, see below); the other half is actions only the owner can
take — do those, they matter more.

## What the research showed (July 2026)

Searching the obvious Norwegian queries surfaces **no product** — only
generic guidance and one downloadable Word template:

- Frivillighet Norge's formalities pages (politiattest guidance, not
  attest issuance): https://www.frivillighetnorge.no/verktoy/ha-det-formelle-i-orden/politiattester/
- frivillig.no's FAQ pages about volunteering generally:
  https://om.frivillig.no/faq-om-frivillighet-og-frivilligno
- Arbeidstilsynet on frivillig arbeid (legal/employment angle):
  https://www.arbeidstilsynet.no/lonn-og-ansettelse/ansettelse/frivillig-arbeid/
- Diabetesforbundet's `.doc` attest template — literally a Word file:
  https://www.diabetes.no/globalassets/min-side/for-tillitsvalgte/skjema-og-maler/attest-for-tillitsvalgte/attestforfrivilligarbeid.doc

Conclusion: the niche is winnable. People searching these terms are org
admins looking for a **template or a process** — exactly what this product
replaces. Low competition means on-page correctness + a handful of relevant
backlinks can rank; there is no incumbent to displace.

## Shipped in code (this PR)

- `sitemap.xml` (app/sitemap.ts): static pages + every public org form,
  resilient to DB outage. `robots.txt` references it and now also blocks
  `/admin`.
- Canonical URLs + `hreflang` (nb-NO / en / x-default) on `/`, `/om`,
  `/personvern` via `publicPageMetadata` (`src/util/seo.ts`) — the `?lang=en`
  variants are declared alternates, not duplicate content.
- `metadataBase`, Open Graph and Twitter-card defaults; keyword-informed
  site title («digital attest for frivillige») and meta description
  containing the money phrases.
- Structured data (`src/components/JsonLd.tsx`): `WebSite` on the landing
  page, `FAQPage` on `/om` (built from the strings file, so it stays in
  sync with the visible content in both languages) — eligible for FAQ rich
  results.
- Already in place from earlier work and load-bearing for SEO: real
  server-rendered content on `/`, `/om`, `/personvern`; per-org page
  titles; `lang="no"`; fast edge rendering.

## Owner actions (in priority order — these move the needle most)

1. **Google Search Console + Bing Webmaster Tools**: verify the domain,
   submit `https://attester.no/sitemap.xml`, request indexing of `/`,
   `/om`, `/personvern`. This is the difference between "indexed this
   week" and "indexed whenever". Bing also feeds DuckDuckGo.
2. **Backlinks from member orgs**: every org using the platform should
   link their `/org/<slug>` page from their own site ("Be om attest").
   echo's site is the first. These are topically perfect links.
   Note: every issued PDF already carries "Verifiser på attester.no" —
   physical-world brand distribution comes free with usage.
3. **Get listed where orgs look**: Frivillighet Norge's verktøy pages,
   studentorganisasjon resource lists, ungdomsorganisasjon networks
   (LNU). One relevant directory link beats ten random ones.
4. **A content page that answers the template query directly** (future PR
   idea, high value): «Mal for attest til frivillige» — an article page
   with a worked example of what a good attest contains, that naturally
   ends in "or issue verifiable ones with attester.no". This targets the
   single most obvious query in the niche (people searching for the
   Diabetesforbundet-style .doc).
5. **Keep URLs stable.** Rankings accrue to URLs; don't rename `/om` or
   `/personvern` later without redirects.

## What NOT to do

- No keyword stuffing beyond what shipped — the copy reads naturally and
  must stay that way.
- No paid link schemes; the niche is small enough that legitimacy wins.
- Don't index the admin or verify URLs (verify URLs carry personal data in
  the query string — they're deliberately unlinked, and robots keeps admin
  surfaces out).

## Measuring

Search Console's "Performance" tab is the scoreboard: impressions for the
target queries should appear within weeks of submission, clicks follow
content + backlinks. Revisit this file when the first pilot org is live.

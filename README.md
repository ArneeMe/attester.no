# attester.no

En enkel løsning for å lage attester som kan verifiseres digitalt.

## Kort fortalt

Når noen trenger en attest, fyller de ut et skjema med navn, rolle og tidsperiode. Systemet lager en PDF, og lagrer en hash av innholdet i databasen. Attesten får en QR-kode som lenker til en verifiseringsside — der kan hvem som helst sjekke at attesten er ekte.

Admin-brukere kan logge inn for å godkjenne forespørsler, redigere maler og oppdatere signaturer.

## Tech

- Next.js + React (App Router)
- TypeScript
- Material UI
- Nhost (Postgres + Hasura + Auth)
- pdfme for PDF-generering i nettleseren
- Cloudflare Pages

## Datamodell i grove trekk

- `organizations` — identitet (slug, navn). Ingenting personlig.
- `org_assets` — per-org innholdsbibliotek (signaturer, logoer,
  tekstblokker, oppslagslister). Default-flagget styrer hva som
  hentes inn automatisk på nye attester.
- `templates` — uforanderlige PDF-maler. Hver mal har en pdfme-layout,
  et `form_schema` (skjemaet innsenderen ser), og `field_bindings`
  (hvor hvert PDF-felt henter sin verdi: skjema, system, asset,
  oppslag, sammensatt tekst, …).
- `submissions` — innsendte data, slettes automatisk når attesten
  utstedes (i samme transaksjon som hash-lagringen).
- `certificates` — kun id, hash, template-id, org-id, tidsstempel.
  Ingen personalia.

Se [CLAUDE.md](CLAUDE.md) for personvernsmodellen og hvorfor det er
viktig at strukturen forblir slik.

## Struktur

```
src/app/
  api/       — server-side API-ruter (DB-tilgang via Hasura admin)
  login/     — admin-innlogging og dashboard
  verify/    — gamle offentlige verifiseringssiden (legacy)
  org/       — per-org offentlig form og verifisering
  pdfinfo/   — bundlede pdfme-maler og startermaler
util/        — resolveBinding, validateTemplate, hashing, …
types/       — formSchema, fieldBindings, orgAssets, templateTypes
```

## Migrasjoner

SQL-filer i `scripts/migrations/` kjøres i Hasura SQL-konsollen, så
sporer du de nye/endrede tabellene i Hasura-grafQL-skjemaet.

Ny installasjon: kjør kun `0000-baseline-schema.sql` — den inneholder
hele skjemaet. `2026-05-*`-filene er historiske migrasjoner av den gamle
echo-databasen.

## Kjøre lokalt

Krever Nhost-miljøvariabler i `.env.local` — kopier fra `.env.example`.

```bash
cp .env.example .env.local
npm install
npm run dev
```

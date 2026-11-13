# attester.no

En enkel løsning for å lage attester som kan verifiseres digitalt.

## Kort fortalt

Når noen trenger en attest, fyller de ut et skjema med navn, rolle og tidsperiode. Systemet lager en PDF, og lagrer en hash av innholdet i databasen. Attesten får en QR-kode som lenker til en verifiseringsside — der kan hvem som helst sjekke at attesten er ekte.

Admin-brukere kan logge inn for å godkjenne forespørsler, redigere maler og oppdatere signaturer. En organisasjon kan også la den frivillige få attesten rett i Digipost.

`main` er MVP-en. `develop` har en ombygging som ikke er satt i drift ennå. Status og sjekklisten for overgangen står øverst i [docs/ROADMAP.md](docs/ROADMAP.md).

## Tech

- Next.js + React (App Router)
- TypeScript
- Material UI
- Nhost (Postgres + Hasura + Auth)
- pdfme for PDF-generering på serveren
- Cloudflare Pages for web, en container for API-et

## Datamodell i grove trekk

- `organizations` — identitet (slug, navn). Ingenting personlig.
- `org_assets` — per-org innholdsbibliotek (signaturer, logoer,
  tekstblokker, oppslagslister). Default-flagget styrer hva som
  hentes inn automatisk på nye attester.
- `templates` — uforanderlige PDF-maler. Hver mal har en pdfme-layout,
  et `form_schema` (skjemaet innsenderen ser), og `field_bindings`
  (hvor hvert PDF-felt henter sin verdi: skjema, system, asset,
  oppslag, sammensatt tekst, …).
- `submissions` — innsendte data. Slettes automatisk 24 timer etter at
  attesten er utstedt (`issued_at`). Ubehandlede innsendinger slettes
  ikke automatisk — de venter på administratoren (se CLAUDE.md).
- `certificates` — kun id, hash, template-id, org-id, tidsstempel.
  Ingen personalia.
- `notices` — utboks for e-postvarsler til admin. Bare org-id.
- `org_settings`, `submission_recipients`, `deliveries` — Digipost:
  om org-en har det, et kryptert fødselsnummer som slettes når brevet er
  sendt, og kø og kvittering for sendingen.
- `platform_errors` — systemets egne feil. Ingenting om brukeren.

Se [CLAUDE.md](CLAUDE.md) for personvernsmodellen og hvorfor det er
viktig at strukturen forblir slik. Utfyllende dokumentasjon ligger i
[docs/](docs/): arkitektur, utviklingsguide, API-referanse, roadmap, ideer
og SEO.

## Struktur

```
apps/web/src/app/
  api/       — videresender /api/v1/* til API-et, pluss den gamle
               verify-ruten
  login/     — admin-innlogging og dashboard
  verify/    — gamle offentlige verifiseringssiden (legacy)
  org/       — per-org offentlig form og verifisering
  pdfinfo/   — bundlede pdfme-maler og startermaler
apps/api/src/
             — API-et: ruter, utstedelse, varsler og Digipost
packages/shared/src/
             — hashing, resolveBinding, validering og typer som deles
               av web og backend
```

## Migrasjoner

SQL-filer i `scripts/migrations/` kjøres i Hasura SQL-konsollen, så
sporer du de nye/endrede tabellene i Hasura-grafQL-skjemaet.

Ny installasjon: kjør kun `0000-baseline-schema.sql` — den inneholder
hele skjemaet. `2026-05-*`-filene er historiske migrasjoner av den gamle
echo-databasen.

## Kjøre lokalt

Web-appen trenger miljøvariabler i `apps/web/.env.local`. Kopier fra
`apps/web/.env.example`. API-et trenger sine egne, se
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

```bash
npm install
npm run dev -w @attester/api   # API-et på :8787
npm run dev                    # web-appen på :3000
```

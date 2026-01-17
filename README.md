# attester.no

En enkel løsning for å lage attester som kan verifiseres digitalt.

## Kort fortalt

Når noen trenger en attest, fyller de ut et skjema med navn, rolle og tidsperiode. Systemet lager en PDF, og lagrer en hash av innholdet i databasen. Attesten får en QR-kode som lenker til en verifiseringsside — der kan hvem som helst sjekke at attesten er ekte.

Admin-brukere kan logge inn for å godkjenne forespørsler, redigere maler og oppdatere signaturer.

## Tech

- Next.js 16 + React 19 (App Router)
- TypeScript
- Material UI
- Firebase (Firestore + Auth)
- pdfme for PDF-generering i nettleseren

## Struktur
```
src/app/
  login/     — admin-innlogging og dashboard
  verify/    — offentlig verifiseringsside
  pdfinfo/   — PDF-maler og logikk
  util/      — hjelpefunksjoner (hashing, db, formatering)
```

## Kjøre lokalt
```bash
npm install
npm run dev
```
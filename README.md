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

Lag et eget Firebase-prosjekt for utvikling (ikke bruk produksjon):

1. Gå til [Firebase Console](https://console.firebase.google.com/) → **Add project**.
2. Aktiver **Authentication** (Email/Password) og **Firestore Database**.
3. Under **Project settings → General → Your apps**, registrer en web-app og kopier konfigurasjonen.

Sett opp env-variabler:

```bash
cp .env.example .env.local
# Fyll inn verdiene fra Firebase Console i .env.local
```

Start dev-serveren:

```bash
npm install
npm run dev
```

`.env.local` er gitignored. For produksjon settes de samme `NEXT_PUBLIC_FIREBASE_*`-variablene i deploy-miljøet.
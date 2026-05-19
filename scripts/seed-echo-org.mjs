// Populates the echo organization row with its default content.
// Safe to re-run — uses ON CONFLICT / update.
//
// Usage:
//   node --env-file=.env.local scripts/seed-echo-org.mjs

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;
const adminSecret = process.env.NHOST_ADMIN_SECRET;

if (!subdomain || !region || !adminSecret) {
    console.error("Missing NEXT_PUBLIC_NHOST_SUBDOMAIN, NEXT_PUBLIC_NHOST_REGION, or NHOST_ADMIN_SECRET in env.");
    process.exit(1);
}

const HASURA = `https://${subdomain}.hasura.${region}.nhost.run`;

async function hasura(query, variables) {
    const res = await fetch(`${HASURA}/v1/graphql`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-hasura-admin-secret": adminSecret,
        },
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data;
}

const genericText =
    "echo er linjeforeningen for informatikk ved Universitetet i Bergen, og består av over 100 frivillige studenter. " +
    "Foreningens hovedoppgave er å bidra positivt til det sosiale og akademiske miljøet for 1000 informatikkstudenter. " +
    "echo sitt mål er å fungere som et bindeledd mellom studentene og universitetet, og samtidig være en viktig arena for informatikkstudentenes sosiale liv. ";

const groups = {
    "Bedkom": "Bedriftskomitéen ved echo tilbyr hjelp med planlegging, markedsføring og organisering av ulike arrangement for bedrifter. Dette kan for eksempel være bedriftspresentasjoner eller workshops. Bedkom tilbyr rådgivning til bedrifter om hvordan de kan kommunisere effektivt og målrettet med våre studenter, og være en positiv faglig bidragsyter ved Institutt for Informatikk.",
    "ESC": "Undergruppen skal fungere som et bindeledd mellom flere idrettslag under echo, slik at det skal bli lettere å forme ulike idrettsgrupper på informatikk. De skal også være med å arrangere treninger, fikse hall-leie og holde kurs.",
    "Gnist": "Gnist er en undergruppe bestående av studenter underlagt echo, med fokus på rekruttering og fullføring. Gnist jobber tett sammen med instituttet og fakultetet om saker som angår frafallsproblematikk og rekruttering av nye studenter. Med støtte fra instituttet gjennomfører Gnist tiltak som er positivt for studentene på instituttet, både faglig og sosialt!",
    "Hyggkom": "Hyggkom er en undergruppe under echo med hovedfokus å skape trivsel på lesesalen. De arrangerer alt fra julekalender til påskegggjakt i løpet av semesteret. Målet er i hovedsak å gi informatikkstudenter et lite avbrekk i en tung og hektisk hverdag!",
    "Tilde": "Tilde er en arbeidsgruppe bestående av studenter underlagt echo, med fokus på å arrangere og gjennomføre sosiale arrangementer. Dette kan være turneringer, quiz, fester, lan og mye mer. Målet med Tilde er å styrke det sosiale miljøet på institutt for informatikk, og å lage arrangementer for alle våre studenter.",
    "Webkom": "Webkom er en undergruppe som drifter og videreutvikler echo sine webløsninger, blant annet denne nettsiden. Ved hjelp av prosjektarbeid og en arbeidsmåte som gjenspeiler arbeidslivet, dette gir våre medlemmer en smakebit på hvordan det er å være utvikler. Noe av det du kan være med å utvikle som medlem i Webkom, er blant annet publiseringssytemet til nettsiden, påmeldingsløsninger til bedriftspresentasjoner og arrangementer, eller design av ulike interne webapplikasjoner.",
    "Programmerbar": "Programmerbar er ei gruppe studentar som driv ein bar for studentane til echo. Me arrangerer mange ulike tilskipingar i løpet av semesteret, som festar, kvissar, spelekveldar og bedriftspresentasjonar.",
    "Hovedstyret": "Hovedstyret består av 14 studenter. 7 stykker er demokratisk valgt, og en fra hver undergruppe. Hovedstyret har et overordnet ansvar for organisasjonen echo, samt det sosiale miljøet for studentene og faglige studentsaker. Hovedstyret jobber utelukkende med å gjøre studiehverdagen for informatikere bedre, og er studentenes stemme opp mot instituttet, fakultetet og arbeidsmarkedet.",
};

// Photos omitted — update them via the admin UI (Rediger innhold → Signaturer).
const signatures = [
    { name: "Arne Natskår",  role: "Leder echo",    phone: "979 37 720", photo: "" },
    { name: "Gard Kalland",  role: "Nestleder echo", phone: "975 31 757", photo: "" },
];

console.log("Seeding echo organization…");

await hasura(
    `mutation SeedEchoOrg($genericText: String!, $groups: jsonb!, $signatures: jsonb!) {
        update_organizations(
            where: { slug: { _eq: "echo" } },
            _set: { generic_text: $genericText, groups: $groups, signatures: $signatures }
        ) { affected_rows }
    }`,
    { genericText, groups, signatures },
);

console.log("Done. Run: node --env-file=.env.local scripts/seed-echo-org.mjs");
console.log("Note: signature photos are blank — update them via the admin UI.");

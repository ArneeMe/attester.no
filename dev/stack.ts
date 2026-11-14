// The local test rig. `npm run stack:up` starts production's services on this
// machine with invented data; `npm run stack:down` removes them and the data.
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { STARTER_TEMPLATES } from "../apps/web/src/app/pdfinfo/starterTemplates";

const ROOT = path.resolve(__dirname, "..");
const STATE = path.join(ROOT, ".dev");
const ENV_FILE = path.join(STATE, "stack.env");
const COMPOSE = ["compose", "-f", path.join(ROOT, "dev", "docker-compose.yml"), "--env-file", ENV_FILE];

export const HASURA = "http://localhost:8080";
export const AUTH = "http://localhost:4000/v1";
export const API = "http://localhost:8787/v1";
export const MAILPIT = "http://localhost:8025";
export const DIGIPOST = "http://localhost:8090";
export const ADMIN_SECRET = "local-admin-secret";
export const PASSWORD = "attester-test-1";
export const USERS = {
    admin: "admin@attester.test",
    owner: "eier@attester.test",
    other: "annen@attester.test",
};
// Synthetic numbers (month + 80). The fake Digipost says the first has a mailbox.
export const WITH_DIGIPOST = "01818099912";

function writeKeys(): void {
    if (existsSync(ENV_FILE)) return;
    mkdirSync(STATE, { recursive: true });
    const pair = () => generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = (key: { export: (o: object) => string | Buffer }, type: string) => String(key.export({ type, format: "pem" }));
    const jwt = pair();
    const digipost = pair();
    const jwtSecret = JSON.stringify({
        type: "RS256",
        key: pem(jwt.publicKey, "spki"),
        signing_key: pem(jwt.privateKey, "pkcs8"),
        kid: "attester-test-rig",
    });
    writeFileSync(
        ENV_FILE,
        [
            `JWT_SECRET='${jwtSecret}'`,
            `AUTH_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`,
            `DELIVERY_KEY=${randomBytes(32).toString("base64")}`,
            `DIGIPOST_PRIVATE_KEY=${Buffer.from(pem(digipost.privateKey, "pkcs8")).toString("base64")}`,
            `DIGIPOST_PUBLIC_KEY=${Buffer.from(pem(digipost.publicKey, "spki")).toString("base64")}`,
            "",
        ].join("\n"),
    );
}

const docker = (...args: string[]) => execFileSync("docker", [...COMPOSE, ...args], { stdio: "inherit", cwd: ROOT });

async function hasura(pathname: string, body: unknown): Promise<any> {
    const res = await fetch(`${HASURA}${pathname}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || json.errors) throw new Error(`${pathname}: ${JSON.stringify(json).slice(0, 400)}`);
    return json;
}

export const sql = (statement: string) => hasura("/v2/query", { type: "run_sql", args: { source: "default", sql: statement } });
export const gql = async (query: string, variables?: object) => (await hasura("/v1/graphql", { query, variables })).data;

const TABLES = [
    "organizations", "user_organizations", "templates", "org_assets", "submissions", "certificates",
    "legacy_certificates", "invites", "org_requests", "notices", "org_settings", "submission_recipients",
    "deliveries", "platform_errors",
];

async function waitFor(url: string, what: string): Promise<void> {
    for (let i = 0; i < 90; i++) {
        if (await fetch(url).then((r) => r.ok).catch(() => false)) return;
        await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`${what} did not come up at ${url}`);
}

async function signUp(email: string): Promise<string> {
    await fetch(`${AUTH}/signup/email-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: PASSWORD }),
    });
    await sql(`UPDATE auth.users SET email_verified = true WHERE email = '${email}'`);
    const found = await gql(`query ($email: citext!) { users(where: { email: { _eq: $email } }) { id } }`, { email });
    if (!found.users[0]) throw new Error(`Could not create ${email}`);
    return found.users[0].id;
}

async function seed(): Promise<void> {
    const existing = await gql(`{ organizations(where: { slug: { _eq: "testorg" } }) { id } }`);
    if (existing.organizations.length > 0) return;

    const [admin, , other] = [await signUp(USERS.admin), await signUp(USERS.owner), await signUp(USERS.other)];
    const starter = STARTER_TEMPLATES[0];
    const orgs = await gql(
        `mutation ($objects: [organizations_insert_input!]!) { insert_organizations(objects: $objects) { returning { id slug } } }`,
        { objects: [{ slug: "testorg", name: "Testorganisasjonen" }, { slug: "annenorg", name: "En annen organisasjon" }] },
    );
    const id = (slug: string) => orgs.insert_organizations.returning.find((o: { slug: string }) => o.slug === slug).id;
    await gql(
        `mutation ($members: [user_organizations_insert_input!]!, $settings: org_settings_insert_input!, $template: templates_insert_input!) {
            insert_user_organizations(objects: $members) { affected_rows }
            insert_org_settings_one(object: $settings) { organization_id }
            insert_templates_one(object: $template) { id }
        }`,
        {
            members: [
                { user_id: admin, organization_id: id("testorg") },
                { user_id: other, organization_id: id("annenorg") },
            ],
            settings: { organization_id: id("testorg"), digipost_enabled: true },
            template: {
                organization_id: id("testorg"),
                name: starter.name,
                description: starter.description,
                base_pdf: starter.template.basePdf,
                schemas: starter.template.schemas,
                form_schema: starter.formSchema,
                field_bindings: starter.fieldBindings,
                is_offered: true,
            },
        },
    );
}

async function bootstrap(): Promise<void> {
    await waitFor("http://localhost:4000/healthz", "auth");
    await sql(readFileSync(path.join(ROOT, "scripts", "migrations", "0000-baseline-schema.sql"), "utf8"));
    for (const name of TABLES) {
        await hasura("/v1/metadata", { type: "pg_track_table", args: { source: "default", table: { schema: "public", name } } })
            .catch((e: Error) => { if (!e.message.includes("already")) throw e; });
    }
    await seed();
    await waitFor("http://localhost:8787/healthz", "api");
}

function webEnv(): string {
    const file = path.join(ROOT, "apps", "web", ".env.local");
    const lines = [
        "NEXT_PUBLIC_NHOST_SUBDOMAIN=local",
        "NEXT_PUBLIC_NHOST_REGION=local",
        `NEXT_PUBLIC_NHOST_AUTH_URL=${AUTH}`,
        `API_URL=${API}`,
    ].join("\n");
    if (existsSync(file)) return `apps/web/.env.local finnes fra før. Den må ha disse linjene for å bruke riggen:\n\n${lines}\n`;
    writeFileSync(file, `${lines}\n`);
    return "Skrev apps/web/.env.local for riggen.";
}

async function up(): Promise<void> {
    writeKeys();
    docker("up", "-d", "--build", "--wait");
    await bootstrap();
    console.log(`
Riggen kjører. Alt er lokalt, med oppdiktede data.

${webEnv()}

Start web-appen:   npm run dev          http://localhost:3000
Skjema:            http://localhost:3000/org/testorg
Logg inn:          http://localhost:3000/login

  Admin for testorg     ${USERS.admin}
  Plattformeier         ${USERS.owner}      (ser /admin)
  Admin for annenorg    ${USERS.other}
  Passord for alle      ${PASSWORD}

E-post som sendes:    ${MAILPIT}
Brev til Digipost:    ${DIGIPOST}     (fødselsnummer ${WITH_DIGIPOST} har postkasse her)
Databasen (Hasura):   ${HASURA}/console     admin secret: ${ADMIN_SECRET}

Sjekk alt på én gang:   npm run stack:smoke
Stopp og slett alt:     npm run stack:down
`);
}

const command = process.argv[2];
if (command === "up") up().catch((e) => { console.error(e.message); process.exit(1); });
else if (command === "down") { writeKeys(); docker("down", "-v"); }
else if (command === "logs") { writeKeys(); docker("logs", "--tail", "60", "api", "auth", "digipost"); }
else if (command) { console.error("Bruk: up | down | logs"); process.exit(1); }

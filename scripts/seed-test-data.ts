/**
 * Seeds test submissions + certificates across multiple orgs.
 * Auto-seeds a default template (from bundled customTemplate) if an org has none.
 *
 * Run from the repo root:
 *   npx tsx --env-file=.env.local scripts/seed-test-data.ts
 */
import { customTemplate } from "../src/app/pdfinfo/customTemplate";
import { echoFieldBindings } from "../src/app/pdfinfo/echoFieldBindings";
import { buildCertParams } from "../src/util/certParams";
import { VOLUNTEER_FORM_SCHEMA } from "../src/types/formSchema";

const SUBDOMAIN = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const REGION = process.env.NEXT_PUBLIC_NHOST_REGION;
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;

if (!SUBDOMAIN || !REGION || !ADMIN_SECRET) {
    console.error("Missing env vars: NEXT_PUBLIC_NHOST_SUBDOMAIN, NEXT_PUBLIC_NHOST_REGION, NHOST_ADMIN_SECRET");
    process.exit(1);
}

const HASURA = `https://${SUBDOMAIN}.hasura.${REGION}.nhost.run/v1/graphql`;
const ORGS_TO_SEED = ["echo", "brodkokeri", "melbod"];
const SUBMISSIONS_PER_ORG = 5;

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(HASURA, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET! },
        body: JSON.stringify({ query, variables }),
    });
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data as T;
}

async function canonicalHash(params: URLSearchParams): Promise<string> {
    const copy = new URLSearchParams(params);
    copy.delete("t");
    const sorted = [...copy.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
    const buf = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(sorted));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const FIRST_NAMES = ["Ola", "Kari", "Per", "Anne", "Lars", "Ingrid", "Erik", "Liv", "Henrik", "Maria", "Sondre", "Astrid"];
const LAST_NAMES = ["Nordmann", "Hansen", "Berg", "Olsen", "Larsen", "Andersen", "Johansen", "Pedersen", "Eriksen"];
const GROUPS = ["Bedkom", "Hovedstyret", "Webkom", "Sosialkom", "Bokkom", "Tilflyttingskom"];
const ROLES = ["Leder", "Nestleder", "Medlem", "Kasserer", "PR-ansvarlig", "Webansvarlig"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pad(n: number): string { return n.toString().padStart(2, "0"); }
function randomDate(year: number): string { return `${year}-${pad(rand(1, 12))}-${pad(rand(1, 28))}`; }

function makeSubmissionData(): Record<string, string> {
    const startYear = rand(2018, 2022);
    return {
        name: `[TEST] ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        group: pick(GROUPS),
        start: randomDate(startYear),
        end: randomDate(startYear + 1),
        role: pick(ROLES),
    };
}

async function ensureDefaultTemplate(organizationId: string, orgSlug: string): Promise<{ id: string; name: string }> {
    const existing = await gql<{ templates: { id: string; name: string }[] }>(
        `query GetDefault($organizationId: uuid!) {
            templates(where: { organization_id: { _eq: $organizationId }, is_default: { _eq: true } }, limit: 1) { id name }
        }`,
        { organizationId },
    );
    if (existing.templates[0]) return existing.templates[0];

    console.log(`  no default template for ${orgSlug}, seeding one...`);
    const created = await gql<{ insert_templates_one: { id: string; name: string } }>(
        `mutation Insert($organizationId: uuid!, $name: String!, $basePdf: String!, $schemas: jsonb!, $formSchema: jsonb!, $fieldBindings: jsonb!) {
            insert_templates_one(object: {
                organization_id: $organizationId,
                name: $name,
                description: "Auto-seeded test template",
                base_pdf: $basePdf,
                schemas: $schemas,
                form_schema: $formSchema,
                field_bindings: $fieldBindings,
                is_default: true
            }) { id name }
        }`,
        {
            organizationId,
            name: `${orgSlug} attest v1`,
            basePdf: customTemplate.basePdf,
            schemas: customTemplate.schemas,
            formSchema: VOLUNTEER_FORM_SCHEMA,
            // The test template uses the echo pdfme schema. Bind by name only;
            // missing group_info lookup is fine for test data (will be blank).
            fieldBindings: echoFieldBindings,
        },
    );
    return created.insert_templates_one;
}

async function seedOrg(slug: string): Promise<void> {
    console.log(`\n=== ${slug} ===`);
    const orgData = await gql<{ organizations: { id: string }[] }>(
        `query GetOrg($slug: String!) { organizations(where: { slug: { _eq: $slug } }, limit: 1) { id } }`,
        { slug },
    );
    const org = orgData.organizations[0];
    if (!org) {
        console.log(`  skipping: org "${slug}" not found in DB`);
        return;
    }

    const tmpl = await ensureDefaultTemplate(org.id, slug);
    console.log(`  using template: ${tmpl.name} (${tmpl.id})`);

    for (let i = 0; i < SUBMISSIONS_PER_ORG; i++) {
        const data = makeSubmissionData();

        const inserted = await gql<{ insert_submissions_one: { id: string } }>(
            `mutation InsertSubmission($organizationId: uuid!, $templateId: uuid!, $data: jsonb!) {
                insert_submissions_one(object: {
                    organization_id: $organizationId,
                    template_id: $templateId,
                    data: $data
                }) { id }
            }`,
            { organizationId: org.id, templateId: tmpl.id, data },
        );
        const submissionId = inserted.insert_submissions_one.id;

        const params = buildCertParams(tmpl.id, submissionId, data);
        const hash = await canonicalHash(params);
        await gql(
            `mutation InsertCert($organizationId: uuid!, $submissionId: String!, $hash: String!, $templateId: uuid!) {
                insert_certificates_one(object: {
                    organization_id: $organizationId,
                    submission_id: $submissionId,
                    hash: $hash,
                    template_id: $templateId
                }) { id }
            }`,
            { organizationId: org.id, submissionId, hash, templateId: tmpl.id },
        );

        console.log(`  + ${data.name.padEnd(28)} ${data.group.padEnd(18)} ${data.role}`);
        console.log(`      http://localhost:3000/org/${slug}/verify?${params.toString()}`);
    }
}

async function main() {
    for (const slug of ORGS_TO_SEED) {
        await seedOrg(slug);
    }
    console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });

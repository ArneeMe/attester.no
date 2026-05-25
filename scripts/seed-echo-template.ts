/**
 * Seeds the bundled echo template into the DB as echo's default template.
 * Run from the repo root:
 *   npx tsx --env-file=.env.local scripts/seed-echo-template.ts
 *
 * Also resolves echo's lookup-list (Undergrupper) by name to plug its id into
 * the `group_info` field binding. Run the org_assets migration first so the
 * list exists.
 */
import { customTemplate } from "../src/app/pdfinfo/customTemplate";
import {
    echoFieldBindings,
    ECHO_UNDERGRUPPER_LIST_NAME,
} from "../src/app/pdfinfo/echoFieldBindings";
import { VOLUNTEER_FORM_SCHEMA } from "../src/types/formSchema";

const SUBDOMAIN = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const REGION = process.env.NEXT_PUBLIC_NHOST_REGION;
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;

if (!SUBDOMAIN || !REGION || !ADMIN_SECRET) {
    console.error("Missing env vars: NEXT_PUBLIC_NHOST_SUBDOMAIN, NEXT_PUBLIC_NHOST_REGION, NHOST_ADMIN_SECRET");
    process.exit(1);
}

const HASURA = `https://${SUBDOMAIN}.hasura.${REGION}.nhost.run/v1/graphql`;

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(HASURA, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET! },
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json() as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data as T;
}

async function main() {
    const orgData = await gql<{ organizations: { id: string }[] }>(
        `query { organizations(where: { slug: { _eq: "echo" } }, limit: 1) { id } }`
    );

    const orgId = orgData.organizations[0]?.id;
    if (!orgId) {
        console.error("echo org not found in DB");
        process.exit(1);
    }

    const listData = await gql<{ org_assets: { id: string }[] }>(
        `query GetList($organizationId: uuid!, $name: String!) {
            org_assets(where: {
                organization_id: { _eq: $organizationId },
                kind: { _eq: "lookup_list" },
                name: { _eq: $name }
            }, limit: 1) { id }
        }`,
        { organizationId: orgId, name: ECHO_UNDERGRUPPER_LIST_NAME },
    );
    const undergrupperId = listData.org_assets[0]?.id ?? null;
    if (!undergrupperId) {
        console.warn(`Warning: no "${ECHO_UNDERGRUPPER_LIST_NAME}" lookup list. group_info won't render.`);
    }

    const fieldBindings = {
        ...echoFieldBindings,
        ...(undergrupperId
            ? {
                group_info: {
                    source: "lookup",
                    assetId: undergrupperId,
                    byKey: "group",
                    subField: "description",
                },
            }
            : {}),
    };

    await gql(
        `mutation ClearDefaults($orgId: uuid!) {
            update_templates(where: { organization_id: { _eq: $orgId } }, _set: { is_default: false }) { affected_rows }
        }`,
        { orgId }
    );

    const result = await gql<{ insert_templates_one: { id: string } }>(
        `mutation Insert($orgId: uuid!, $basePdf: String!, $schemas: jsonb!, $formSchema: jsonb!, $fieldBindings: jsonb!) {
            insert_templates_one(object: {
                organization_id: $orgId,
                name: "echo attest v1",
                description: "Opprinnelig echo-attest (migrert fra kode)",
                base_pdf: $basePdf,
                schemas: $schemas,
                form_schema: $formSchema,
                field_bindings: $fieldBindings,
                is_default: true
            }) { id }
        }`,
        {
            orgId,
            basePdf: customTemplate.basePdf,
            schemas: customTemplate.schemas,
            formSchema: VOLUNTEER_FORM_SCHEMA,
            fieldBindings,
        }
    );

    console.log("Template seeded, id:", result.insert_templates_one.id);
}

main().catch((e) => { console.error(e); process.exit(1); });

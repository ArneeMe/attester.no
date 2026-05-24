/**
 * One-shot migration: writes echo's signatures, groups, and generic_text
 * from the static pdfinfo files into the organizations table in the DB.
 *
 * Safe to re-run — overwrites with the same data each time.
 *
 * Run from repo root:
 *   npx tsx --env-file=.env.local scripts/migrate-echo-to-db.ts
 *
 * After running, verify in Hasura console:
 *   - organizations row for echo has non-null signatures (array of 2)
 *   - organizations row for echo has non-null groups (object with 8+ keys)
 *   - organizations row for echo has non-null generic_text
 *
 * Once verified, the static fallback in fetchInfo.ts can be removed.
 */
import { signaturePerson1, signaturePerson2 } from "../src/app/pdfinfo/signatureInfo";
import { generic_echo, undergrupper } from "../src/app/pdfinfo/echoInfo";

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
    const orgData = await gql<{ organizations: { id: string; signatures: unknown; groups: unknown; generic_text: string | null }[] }>(
        `query {
            organizations(where: { slug: { _eq: "echo" } }, limit: 1) {
                id signatures groups generic_text
            }
        }`
    );

    const org = orgData.organizations[0];
    if (!org) {
        console.error("echo org not found in DB");
        process.exit(1);
    }

    console.log("Current DB state for echo:");
    console.log("  signatures:", org.signatures ? `${(org.signatures as unknown[]).length} entries` : "NULL");
    console.log("  groups:", org.groups ? `${Object.keys(org.groups as object).length} keys` : "NULL");
    console.log("  generic_text:", org.generic_text ? `${org.generic_text.length} chars` : "NULL");
    console.log();

    const result = await gql<{ update_organizations: { affected_rows: number } }>(
        `mutation UpdateEcho($id: uuid!, $signatures: jsonb!, $groups: jsonb!, $genericText: String!) {
            update_organizations(
                where: { id: { _eq: $id } },
                _set: {
                    signatures: $signatures,
                    groups: $groups,
                    generic_text: $genericText
                }
            ) { affected_rows }
        }`,
        {
            id: org.id,
            signatures: [signaturePerson1, signaturePerson2],
            groups: undergrupper,
            genericText: generic_echo,
        }
    );

    if (result.update_organizations.affected_rows !== 1) {
        console.error("Update affected unexpected rows:", result.update_organizations.affected_rows);
        process.exit(1);
    }

    console.log("Migration complete. Updated echo organization with:");
    console.log(`  signatures: ${[signaturePerson1, signaturePerson2].length} signatories`);
    console.log(`    - ${signaturePerson1.name} (${signaturePerson1.role})`);
    console.log(`    - ${signaturePerson2.name} (${signaturePerson2.role})`);
    console.log(`  groups: ${Object.keys(undergrupper).length} groups`);
    console.log(`    ${Object.keys(undergrupper).join(", ")}`);
    console.log(`  generic_text: ${generic_echo.length} chars`);
    console.log();
    console.log("Next step: open /login/adminpage/echo/rediger and confirm all three fields show the correct data from DB.");
}

main().catch((e) => { console.error(e); process.exit(1); });

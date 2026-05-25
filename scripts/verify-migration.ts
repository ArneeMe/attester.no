/**
 * Diagnostic: probes the live Hasura GraphQL endpoint to verify the
 * org_assets migration is fully wired up.
 *
 *   npx tsx --env-file=.env.local scripts/verify-migration.ts
 *
 * Reports each check as ✓/✗ and exits non-zero if anything is wrong, so
 * you can see at a glance whether the migration SQL was run AND whether
 * Hasura is exposing the new shape via GraphQL.
 *
 * It tests via GraphQL on purpose: "the SQL ran but Hasura wasn't
 * re-tracked" is the most common failure mode and it can ONLY be caught
 * at the GraphQL layer.
 */
const SUBDOMAIN = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const REGION = process.env.NEXT_PUBLIC_NHOST_REGION;
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;

if (!SUBDOMAIN || !REGION || !ADMIN_SECRET) {
    console.error("Missing env vars: NEXT_PUBLIC_NHOST_SUBDOMAIN, NEXT_PUBLIC_NHOST_REGION, NHOST_ADMIN_SECRET");
    process.exit(1);
}

const HASURA = `https://${SUBDOMAIN}.hasura.${REGION}.nhost.run/v1/graphql`;

type GqlResult<T> = { data?: T; errors?: { message: string }[] };

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<GqlResult<T>> {
    const res = await fetch(HASURA, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET! },
        body: JSON.stringify({ query, variables }),
    });
    return (await res.json()) as GqlResult<T>;
}

let failures = 0;
function pass(msg: string) { console.log(`✓ ${msg}`); }
function fail(msg: string, hint?: string) {
    failures++;
    console.log(`✗ ${msg}`);
    if (hint) console.log(`    → ${hint}`);
}

async function main() {
    console.log(`Probing ${HASURA}\n`);

    // 1. org_assets table is tracked.
    {
        const r = await gql<{ org_assets_aggregate: { aggregate: { count: number } } }>(
            `query { org_assets_aggregate { aggregate { count } } }`,
        );
        if (r.errors) {
            fail("org_assets table is NOT tracked in Hasura",
                "Open Hasura console → Data → Untracked tables → track `org_assets`. Then add its relationship: organization_id → organizations.id");
            console.log(`    Hasura said: ${r.errors[0].message}`);
        } else {
            const n = r.data!.org_assets_aggregate.aggregate.count;
            pass(`org_assets table is tracked (${n} row${n === 1 ? '' : 's'})`);
        }
    }

    // 2. templates.field_bindings column is exposed.
    {
        const r = await gql<{ templates: Array<{ id: string; field_bindings: Record<string, unknown> | null }> }>(
            `query { templates(limit: 1) { id field_bindings } }`,
        );
        if (r.errors) {
            fail("templates.field_bindings column is NOT tracked",
                "Re-track templates in Hasura: Data → templates → Modify → Untrack, then Track again. The field_bindings column needs to appear in the GraphQL schema.");
            console.log(`    Hasura said: ${r.errors[0].message}`);
        } else {
            pass("templates.field_bindings column is exposed via GraphQL");
        }
    }

    // 3. organizations no longer has signatures/groups/generic_text.
    {
        const r = await gql<unknown>(
            `query { organizations(limit: 1) { id signatures } }`,
        );
        if (!r.errors) {
            fail("organizations.signatures column STILL exists in Hasura schema",
                "Either the migration didn't drop the column, or Hasura is caching the old schema. Re-track organizations to refresh.");
        } else if (/signatures/.test(r.errors[0].message)) {
            pass("organizations.signatures is correctly gone from the schema");
        } else {
            fail("organizations query failed for an unexpected reason: " + r.errors[0].message);
        }
    }

    // 4. Echo exists.
    const echo = await gql<{ organizations: Array<{ id: string }> }>(
        `query { organizations(where: { slug: { _eq: "echo" } }) { id } }`,
    );
    if (echo.errors || !echo.data?.organizations[0]) {
        fail("echo organization not found");
        console.log(`\n${failures} check(s) failed.`);
        process.exit(1);
    }
    const echoId = echo.data.organizations[0].id;
    pass(`echo organization found (${echoId})`);

    // 5. Echo has migrated org_assets.
    {
        const r = await gql<{ org_assets: Array<{ kind: string; name: string }> }>(
            `query GetAssets($orgId: uuid!) {
                org_assets(where: { organization_id: { _eq: $orgId } }) { kind name }
            }`,
            { orgId: echoId },
        );
        if (r.errors) {
            fail("Cannot read echo's org_assets: " + r.errors[0].message);
        } else {
            const byKind = new Map<string, number>();
            for (const a of r.data!.org_assets) {
                byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + 1);
            }
            const sigs = byKind.get("signature") ?? 0;
            const txts = byKind.get("body_text") ?? 0;
            const lists = byKind.get("lookup_list") ?? 0;
            if (sigs === 0) fail("Echo has 0 signature assets — migration step 3 didn't backfill",
                "If echo.signatures used to have data, check that the JSON array migration ran. Inspect with: SELECT * FROM org_assets WHERE organization_id = (SELECT id FROM organizations WHERE slug='echo');");
            else pass(`Echo has ${sigs} signature asset(s)`);
            if (txts === 0) fail("Echo has 0 body_text assets — migration step 4 didn't run");
            else pass(`Echo has ${txts} body_text asset(s)`);
            if (lists === 0) fail("Echo has 0 lookup_list assets — migration step 5 didn't run");
            else pass(`Echo has ${lists} lookup_list asset(s)`);
        }
    }

    // 6. Echo's templates exist and have populated field_bindings.
    {
        const r = await gql<{ templates: Array<{ id: string; name: string; field_bindings: Record<string, unknown> | null }> }>(
            `query GetTmpls($orgId: uuid!) {
                templates(where: { organization_id: { _eq: $orgId } }) { id name field_bindings }
            }`,
            { orgId: echoId },
        );
        if (r.errors) {
            fail("Cannot read echo's templates: " + r.errors[0].message);
        } else if (r.data!.templates.length === 0) {
            fail("Echo has 0 templates — has the seed script ever run?",
                "Run: npx tsx --env-file=.env.local scripts/seed-echo-template.ts");
        } else {
            for (const t of r.data!.templates) {
                const n = Object.keys(t.field_bindings ?? {}).length;
                if (n === 0) fail(`Template "${t.name}" has empty field_bindings`,
                    "Migration step 6 should populate echo's bindings. Re-run the UPDATE block from 2026-05-org-assets.sql section 6.");
                else pass(`Template "${t.name}" has ${n} field binding(s)`);
            }
        }
    }

    // 7. organizations row is queryable via the API shape used in the app.
    {
        const r = await gql<{ organizations: Array<{ id: string; slug: string; name: string }> }>(
            `query { organizations(where: { slug: { _eq: "echo" } }) { id slug name } }`,
        );
        if (r.errors) {
            fail("Basic organizations query failed: " + r.errors[0].message);
        } else {
            pass("organizations { id slug name } query works");
        }
    }

    console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed — see hints above.`}`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * Creates a new organization and links its first admin member.
 * Assisted onboarding until a super-admin UI exists — everything after
 * this (templates, assets, form) is self-serve in the app.
 *
 * The admin must already have a user account (create it in the Nhost
 * dashboard under Auth → Users, or have them sign in once via an
 * invite flow when one exists).
 *
 * Run from the repo root:
 *   npx tsx --env-file=.env.local scripts/create-org.ts <slug> "<Org name>" <admin-email>
 *
 * Example:
 *   npx tsx --env-file=.env.local scripts/create-org.ts kjelleren "Kjelleren Studentkro" styret@kjelleren.no
 */

export {}; // module scope — keeps top-level names from colliding with the other scripts

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

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

async function main() {
    const [slug, name, adminEmail] = process.argv.slice(2);
    if (!slug || !name || !adminEmail) {
        console.error('Usage: npx tsx --env-file=.env.local scripts/create-org.ts <slug> "<Org name>" <admin-email>');
        process.exit(1);
    }
    if (!SLUG_RE.test(slug)) {
        console.error(`Invalid slug "${slug}" — lowercase letters, digits and hyphens only.`);
        process.exit(1);
    }

    const existing = await gql<{ organizations: { id: string }[] }>(
        `query OrgExists($slug: String!) {
            organizations(where: { slug: { _eq: $slug } }, limit: 1) { id }
        }`,
        { slug },
    );
    if (existing.organizations.length > 0) {
        console.error(`Org "${slug}" already exists (${existing.organizations[0].id}).`);
        process.exit(1);
    }

    const userData = await gql<{ users: { id: string; email: string }[] }>(
        `query GetUser($email: citext!) {
            users(where: { email: { _eq: $email } }, limit: 1) { id email }
        }`,
        { email: adminEmail.toLowerCase() },
    );
    const user = userData.users[0];
    if (!user) {
        console.error(`No user account for "${adminEmail}". Create it in the Nhost dashboard (Auth → Users) first.`);
        process.exit(1);
    }

    const created = await gql<{ insert_organizations_one: { id: string } }>(
        `mutation CreateOrg($slug: String!, $name: String!) {
            insert_organizations_one(object: { slug: $slug, name: $name }) { id }
        }`,
        { slug, name },
    );
    await gql(
        `mutation AddMember($userId: uuid!, $organizationId: uuid!) {
            insert_user_organizations_one(object: {
                user_id: $userId,
                organization_id: $organizationId
            }) { user_id }
        }`,
        { userId: user.id, organizationId: created.insert_organizations_one.id },
    );

    console.log(`Created org "${name}" (${created.insert_organizations_one.id})`);
    console.log(`  slug:   ${slug}`);
    console.log(`  admin:  ${user.email}`);
    console.log("");
    console.log("Next steps for the org admin:");
    console.log(`  1. Log in at /login and open the org.`);
    console.log(`  2. Create a PDF template ("PDF-mal" → starter gallery).`);
    console.log(`  3. Add signatures/logos under "Innhold".`);
    console.log(`  4. Share the public form: /org/${slug}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

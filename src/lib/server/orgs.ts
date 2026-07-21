import { hasuraAdmin } from "@/lib/server/hasura";

// organizations carries identity only (id, slug, name) — everything here
// is public information, safe to render on unauthenticated pages.

export type PublicOrg = { slug: string; name: string };

export async function listPublicOrgs(): Promise<PublicOrg[]> {
    const data = await hasuraAdmin<{ organizations: PublicOrg[] }>(
        `query ListOrgs {
            organizations(order_by: { name: asc }) { slug name }
        }`,
    );
    return data.organizations;
}

export async function getOrgNameBySlug(slug: string): Promise<string | null> {
    const data = await hasuraAdmin<{ organizations: Array<{ name: string }> }>(
        `query GetOrgName($slug: String!) {
            organizations(where: { slug: { _eq: $slug } }, limit: 1) { name }
        }`,
        { slug },
    );
    return data.organizations[0]?.name ?? null;
}

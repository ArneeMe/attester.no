import { hasuraAdmin } from "@/lib/server/hasura";
import { parseUnlistedSlugs, withoutUnlisted } from "@/util/orgVisibility";

// organizations carries identity only (id, slug, name) — everything here
// is public information, safe to render on unauthenticated pages.

export type PublicOrg = { slug: string; name: string };

/**
 * Organizations for the public discovery surfaces: the front-page picker and
 * the sitemap. Orgs named in UNLISTED_ORG_SLUGS are filtered out so test and
 * staging orgs stay usable without being advertised — they remain reachable
 * at /org/<slug>. Platform admins list orgs through /api/admin/orgs, which
 * queries separately and is deliberately unfiltered.
 */
export async function listPublicOrgs(): Promise<PublicOrg[]> {
    const data = await hasuraAdmin<{ organizations: PublicOrg[] }>(
        `query ListOrgs {
            organizations(order_by: { name: asc }) { slug name }
        }`,
    );
    return withoutUnlisted(
        data.organizations,
        parseUnlistedSlugs(process.env.UNLISTED_ORG_SLUGS),
    );
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

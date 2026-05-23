import { createClient } from "@nhost/nhost-js";

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN ?? '';
const region = process.env.NEXT_PUBLIC_NHOST_REGION ?? '';

export const nhost = createClient({ subdomain, region });

type SessionUser = NonNullable<NonNullable<ReturnType<typeof nhost.getUserSession>>["user"]>;
export type { SessionUser as NhostUser };

export type OrgSummary = {
    id: string;
    slug: string;
    name: string;
};

const _orgCache = new Map<string, OrgSummary>();

export async function getOrgBySlug(slug: string): Promise<OrgSummary> {
    const cached = _orgCache.get(slug);
    if (cached) return cached;
    const res = await fetch(`/api/organizations?slug=${encodeURIComponent(slug)}`);
    const json = await res.json();
    if (!res.ok || !json.organization?.id) {
        throw new Error(`Organization "${slug}" not found`);
    }
    const org: OrgSummary = {
        id: json.organization.id,
        slug: json.organization.slug,
        name: json.organization.name,
    };
    _orgCache.set(slug, org);
    return org;
}

export function authHeader(): Record<string, string> {
    const accessToken = nhost.getUserSession()?.accessToken;
    return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

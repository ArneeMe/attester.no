import { createClient } from "@nhost/nhost-js";

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;

if (!subdomain || !region) {
    throw new Error(
        "Missing NEXT_PUBLIC_NHOST_SUBDOMAIN or NEXT_PUBLIC_NHOST_REGION. " +
        "Copy .env.example to .env.local and fill in your Nhost project values."
    );
}

export const nhost = createClient({ subdomain, region });

type SessionUser = NonNullable<NonNullable<ReturnType<typeof nhost.getUserSession>>["user"]>;
export type { SessionUser as NhostUser };

let _defaultOrgId: string | null = null;

export async function getDefaultOrgId(): Promise<string> {
    if (_defaultOrgId) return _defaultOrgId;
    const res = await nhost.graphql.request<{ organizations: { id: string }[] }>({
        query: `query { organizations(where: { slug: { _eq: "echo" } }, limit: 1) { id } }`,
    });
    const id = res.body.data?.organizations?.[0]?.id;
    if (!id) throw new Error("Default organization not found");
    _defaultOrgId = id;
    return id;
}

import { createClient } from "@nhost/nhost-js";

const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN ?? '';
const region = process.env.NEXT_PUBLIC_NHOST_REGION ?? '';

export const nhost = createClient({ subdomain, region });

type SessionUser = NonNullable<NonNullable<ReturnType<typeof nhost.getUserSession>>["user"]>;
export type { SessionUser as NhostUser };

let _defaultOrgId: string | null = null;

export async function getDefaultOrgId(): Promise<string> {
    if (_defaultOrgId) return _defaultOrgId;
    const res = await fetch("/api/organizations?slug=echo");
    const json = await res.json();
    if (!res.ok || !json.organization?.id) throw new Error("Default organization not found");
    _defaultOrgId = json.organization.id;
    return _defaultOrgId!;
}

export function authHeader(): Record<string, string> {
    const accessToken = nhost.getUserSession()?.accessToken;
    return accessToken ? { authorization: `Bearer ${accessToken}` } : {};
}

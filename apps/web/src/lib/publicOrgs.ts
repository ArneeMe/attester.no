import { apiGet, apiUrl } from "@/lib/apiUrl";

export type PublicOrg = { slug: string; name: string };

export async function listPublicOrgs(): Promise<PublicOrg[]> {
    return (await apiGet<{ organizations: PublicOrg[] }>("/orgs")).organizations;
}

export async function getOrgNameBySlug(slug: string): Promise<string | null> {
    const res = await fetch(apiUrl(`/org/${encodeURIComponent(slug)}`), { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API org lookup failed with ${res.status}`);
    return ((await res.json()) as { organization: { name: string } }).organization.name;
}

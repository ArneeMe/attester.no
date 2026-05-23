import { authHeader } from '@/lib/nhost';
import { GroupInfo, OrganizationInfo, SignatureInfo } from '@/types/pdfTypes';

async function updateOrg(
    slug: string,
    set: { genericText?: string; groups?: GroupInfo; signatures?: SignatureInfo[] },
): Promise<void> {
    const res = await fetch(`/api/org/${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeader() },
        body: JSON.stringify(set),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to update organization');
    }
}

export const updateGroupInfo = (slug: string, groups: GroupInfo) =>
    updateOrg(slug, { groups });

export const updateSignatureInfo = (slug: string, signatures: SignatureInfo[]) =>
    updateOrg(slug, { signatures });

export const updateOrganizationInfo = (slug: string, organization: OrganizationInfo) =>
    updateOrg(slug, { genericText: organization.generic_text });

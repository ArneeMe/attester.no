import { authHeader } from '@/lib/nhost';
import { GroupInfo, OrganizationInfo, SignatureInfo } from '@/types/pdfTypes';

const ORG_SLUG = 'echo';

async function updateOrg(set: { genericText?: string; groups?: GroupInfo; signatures?: SignatureInfo[] }): Promise<void> {
    const res = await fetch('/api/organizations', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...authHeader() },
        body: JSON.stringify({ slug: ORG_SLUG, ...set }),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to update organization');
    }
}

export const updateGroupInfo = (groups: GroupInfo) => updateOrg({ groups });
export const updateSignatureInfo = (signatures: SignatureInfo[]) => updateOrg({ signatures });
export const updateOrganizationInfo = (organization: OrganizationInfo) =>
    updateOrg({ genericText: organization.generic_text });

import { GroupInfo, OrganizationInfo, SignatureInfo } from '@/types/pdfTypes';

type OrgRow = {
    id: string;
    name: string;
    generic_text: string | null;
    groups: GroupInfo | null;
    signatures: SignatureInfo[] | null;
};

async function fetchOrgContent(slug: string): Promise<OrgRow | null> {
    const res = await fetch(`/api/org/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.organization ?? null;
}

export const getGroupInfo = async (slug: string): Promise<GroupInfo> => {
    try {
        const org = await fetchOrgContent(slug);
        return org?.groups ?? {};
    } catch (error) {
        console.error('Error fetching group info:', error);
        return {};
    }
};

export const getSignatureInfo = async (slug: string): Promise<SignatureInfo[]> => {
    try {
        const org = await fetchOrgContent(slug);
        return org?.signatures ?? [];
    } catch (error) {
        console.error('Error fetching signature info:', error);
        return [];
    }
};

export const getOrganizationInfo = async (slug: string): Promise<OrganizationInfo> => {
    try {
        const org = await fetchOrgContent(slug);
        return { generic_text: org?.generic_text ?? '' };
    } catch (error) {
        console.error('Error fetching organization info:', error);
        return { generic_text: '' };
    }
};

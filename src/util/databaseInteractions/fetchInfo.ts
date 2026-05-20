import { GroupInfo, OrganizationInfo, SignatureInfo } from '@/types/pdfTypes';
import { generic_echo, undergrupper } from '@/app/pdfinfo/echoInfo';
import { signaturePerson1, signaturePerson2 } from '@/app/pdfinfo/signatureInfo';

type OrgRow = {
    id: string;
    name: string;
    generic_text: string | null;
    groups: GroupInfo | null;
    signatures: SignatureInfo[] | null;
};

async function fetchOrgContent(slug: string): Promise<OrgRow | null> {
    const res = await fetch(`/api/organizations?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.organization ?? null;
}

const ECHO_FALLBACK = {
    groups: undergrupper,
    organization: { generic_text: generic_echo },
    signatures: [signaturePerson1, signaturePerson2],
};

const EMPTY_FALLBACK = {
    groups: {} as GroupInfo,
    organization: { generic_text: '' },
    signatures: [] as SignatureInfo[],
};

function fallbackFor(slug: string) {
    return slug === 'echo' ? ECHO_FALLBACK : EMPTY_FALLBACK;
}

export const getGroupInfo = async (slug: string): Promise<GroupInfo> => {
    try {
        const org = await fetchOrgContent(slug);
        if (org?.groups && Object.keys(org.groups).length > 0) return org.groups;
    } catch (error) {
        console.error('Error fetching group info:', error);
    }
    return fallbackFor(slug).groups;
};

export const getSignatureInfo = async (slug: string): Promise<SignatureInfo[]> => {
    try {
        const org = await fetchOrgContent(slug);
        if (org?.signatures && org.signatures.length > 0) return org.signatures;
    } catch (error) {
        console.error('Error fetching signature info:', error);
    }
    return fallbackFor(slug).signatures;
};

export const getOrganizationInfo = async (slug: string): Promise<OrganizationInfo> => {
    try {
        const org = await fetchOrgContent(slug);
        if (org?.generic_text) return { generic_text: org.generic_text };
    } catch (error) {
        console.error('Error fetching organization info:', error);
    }
    return fallbackFor(slug).organization;
};

export const fallbackValues = ECHO_FALLBACK;

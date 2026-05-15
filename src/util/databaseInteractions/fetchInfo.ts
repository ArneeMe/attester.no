import { nhost } from '@/lib/nhost';
import { GroupInfo, OrganizationInfo, SignatureInfo } from '@/types/pdfTypes';
import { generic_echo, undergrupper } from '@/app/pdfinfo/echoInfo';
import { signaturePerson1, signaturePerson2 } from '@/app/pdfinfo/signatureInfo';

const ORG_SLUG = 'echo';

const GET_ORG_CONTENT = `
    query GetOrgContent($slug: String!) {
        organizations(where: { slug: { _eq: $slug } }, limit: 1) {
            id
            generic_text
            groups
            signatures
        }
    }
`;

type OrgRow = {
    id: string;
    generic_text: string | null;
    groups: GroupInfo | null;
    signatures: SignatureInfo[] | null;
};

async function fetchOrgContent(): Promise<OrgRow | null> {
    const res = await nhost.graphql.request<{ organizations: OrgRow[] }>({
        query: GET_ORG_CONTENT,
        variables: { slug: ORG_SLUG },
    });
    return res.body.data?.organizations?.[0] ?? null;
}

export const getGroupInfo = async (): Promise<GroupInfo> => {
    try {
        const org = await fetchOrgContent();
        if (org?.groups && Object.keys(org.groups).length > 0) return org.groups;
    } catch (error) {
        console.error('Error fetching group info:', error);
    }
    return fallbackValues.groups;
};

export const getSignatureInfo = async (): Promise<SignatureInfo[]> => {
    try {
        const org = await fetchOrgContent();
        if (org?.signatures && org.signatures.length > 0) return org.signatures;
    } catch (error) {
        console.error('Error fetching signature info:', error);
    }
    return fallbackValues.signatures;
};

export const getOrganizationInfo = async (): Promise<OrganizationInfo> => {
    try {
        const org = await fetchOrgContent();
        if (org?.generic_text) return { generic_text: org.generic_text };
    } catch (error) {
        console.error('Error fetching organization info:', error);
    }
    return fallbackValues.organization;
};

export const fallbackValues: {
    groups: { [key: string]: string };
    organization: { generic_text: string };
    signatures: Array<{ photo: string; name: string; role: string; phone: string }>;
} = {
    groups: undergrupper,
    organization: { generic_text: generic_echo },
    signatures: [signaturePerson1, signaturePerson2],
};

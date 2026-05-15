import { nhost } from '@/lib/nhost';
import { GroupInfo, OrganizationInfo, SignatureInfo } from '@/types/pdfTypes';

const ORG_SLUG = 'echo';

const UPDATE_ORG_CONTENT = `
    mutation UpdateOrgContent($slug: String!, $genericText: String, $groups: jsonb, $signatures: jsonb) {
        update_organizations(
            where: { slug: { _eq: $slug } },
            _set: { generic_text: $genericText, groups: $groups, signatures: $signatures }
        ) { affected_rows }
    }
`;

export const updateGroupInfo = async (groups: GroupInfo): Promise<void> => {
    const res = await nhost.graphql.request({
        query: UPDATE_ORG_CONTENT,
        variables: { slug: ORG_SLUG, groups },
    });
    if (res.body.errors?.length) throw new Error(res.body.errors[0].message);
};

export const updateSignatureInfo = async (signatures: SignatureInfo[]): Promise<void> => {
    const res = await nhost.graphql.request({
        query: UPDATE_ORG_CONTENT,
        variables: { slug: ORG_SLUG, signatures },
    });
    if (res.body.errors?.length) throw new Error(res.body.errors[0].message);
};

export const updateOrganizationInfo = async (organization: OrganizationInfo): Promise<void> => {
    const res = await nhost.graphql.request({
        query: UPDATE_ORG_CONTENT,
        variables: { slug: ORG_SLUG, genericText: organization.generic_text },
    });
    if (res.body.errors?.length) throw new Error(res.body.errors[0].message);
};

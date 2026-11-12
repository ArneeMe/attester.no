import { hasuraAdmin } from "@/lib/server/hasura";

export async function slugIsTaken(slug: string): Promise<boolean> {
    const data = await hasuraAdmin<{ organizations: Array<{ id: string }> }>(
        `query OrgExists($slug: String!) {
            organizations(where: { slug: { _eq: $slug } }, limit: 1) { id }
        }`,
        { slug },
    );
    return data.organizations.length > 0;
}

export async function createOrganization(slug: string, name: string): Promise<string> {
    const organizationId = crypto.randomUUID();
    await hasuraAdmin(
        `mutation CreateOrg($id: uuid!, $slug: String!, $name: String!) {
            insert_organizations_one(object: { id: $id, slug: $slug, name: $name }) { id }
        }`,
        { id: organizationId, slug, name },
    );
    return organizationId;
}

// One mutation, so Hasura's single transaction rules out a memberless org.
export async function createOrganizationWithMember(
    slug: string,
    name: string,
    userId: string,
): Promise<string> {
    const organizationId = crypto.randomUUID();
    await hasuraAdmin(
        `mutation CreateOrgWithMember($orgId: uuid!, $slug: String!, $name: String!, $userId: uuid!) {
            insert_organizations_one(object: { id: $orgId, slug: $slug, name: $name }) { id }
            insert_user_organizations_one(object: { user_id: $userId, organization_id: $orgId }) { user_id }
        }`,
        { orgId: organizationId, slug, name, userId },
    );
    return organizationId;
}

// Approval invites rather than attaching a member, because the applicant has
// no account yet.
export async function createInvite(
    organizationId: string,
    email: string,
    createdBy: string | null,
): Promise<string> {
    const data = await hasuraAdmin<{ insert_invites_one: { token: string } }>(
        `mutation CreateInvite($organizationId: uuid!, $email: String!, $createdBy: uuid) {
            insert_invites_one(object: {
                organization_id: $organizationId,
                email: $email,
                created_by: $createdBy
            }) { token }
        }`,
        { organizationId, email, createdBy },
    );
    return data.insert_invites_one.token;
}

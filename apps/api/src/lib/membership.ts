import { hasuraAdmin } from "./hasura";

export type UserOrg = {
    id: string;
    slug: string;
    name: string;
    role: string;
    // Submissions waiting for someone to look at them.
    pending: number;
};

// A count that fails must not take the organisation list down with it.
async function pendingCount(organizationId: string): Promise<number> {
    try {
        const data = await hasuraAdmin<{ submissions_aggregate: { aggregate: { count: number } } }>(
            `query PendingSubmissions($organizationId: uuid!) {
                submissions_aggregate(where: { organization_id: { _eq: $organizationId }, issued_at: { _is_null: true } }) {
                    aggregate { count }
                }
            }`,
            { organizationId },
        );
        return data.submissions_aggregate.aggregate.count;
    } catch {
        return 0;
    }
}

export async function getUserOrgs(userId: string): Promise<UserOrg[]> {
    const data = await hasuraAdmin<{
        user_organizations: Array<{ organization_id: string; role: string }>;
    }>(
        `query GetUserOrgs($userId: uuid!) {
            user_organizations(where: { user_id: { _eq: $userId } }) {
                organization_id role
            }
        }`,
        { userId },
    );
    if (data.user_organizations.length === 0) return [];

    const ids = data.user_organizations.map((r) => r.organization_id);
    const orgs = await hasuraAdmin<{
        organizations: Array<{ id: string; slug: string; name: string }>;
    }>(
        `query GetOrgsByIds($ids: [uuid!]!) {
            organizations(where: { id: { _in: $ids } }, order_by: { slug: asc }) {
                id slug name
            }
        }`,
        { ids },
    );
    const byId = new Map(orgs.organizations.map((o) => [o.id, o]));
    const pending = new Map(await Promise.all(ids.map(async (id) => [id, await pendingCount(id)] as const)));
    return data.user_organizations
        .map((r) => {
            const org = byId.get(r.organization_id);
            if (!org) return null;
            return { id: org.id, slug: org.slug, name: org.name, role: r.role, pending: pending.get(org.id) ?? 0 };
        })
        .filter((x): x is UserOrg => x !== null);
}

export async function userBelongsToOrg(userId: string, organizationId: string): Promise<boolean> {
    const data = await hasuraAdmin<{ user_organizations: Array<{ user_id: string }> }>(
        `query CheckMembership($userId: uuid!, $organizationId: uuid!) {
            user_organizations(
                where: {
                    user_id: { _eq: $userId },
                    organization_id: { _eq: $organizationId }
                },
                limit: 1
            ) { user_id }
        }`,
        { userId, organizationId },
    );
    return data.user_organizations.length > 0;
}

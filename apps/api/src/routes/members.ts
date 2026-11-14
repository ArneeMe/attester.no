import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { getUsersByIds } from "../lib/authUsers";
import { serverError } from "../lib/apiError";
import { isUuid } from "../lib/input";

type MembershipRow = { user_id: string; role: string };

const LAST_MEMBER = "Kan ikke fjerne det siste medlemmet i organisasjonen";

async function listMemberships(organizationId: string): Promise<MembershipRow[]> {
    const data = await hasuraAdmin<{ user_organizations: MembershipRow[] }>(
        `query GetMembers($organizationId: uuid!) {
            user_organizations(where: { organization_id: { _eq: $organizationId } }) {
                user_id role
            }
        }`,
        { organizationId },
    );
    return data.user_organizations;
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    try {
        const memberships = await listMemberships(auth.organizationId);
        const users = await getUsersByIds(memberships.map((m) => m.user_id));
        const byId = new Map(users.map((u) => [u.id, u]));
        const members = memberships.map((m) => ({
            userId: m.user_id,
            role: m.role,
            email: byId.get(m.user_id)?.email ?? null,
            displayName: byId.get(m.user_id)?.displayName ?? null,
            isSelf: m.user_id === auth.userId,
        }));
        return json({ members });
    } catch (e) {
        return serverError(e, "api/org/[slug]/members");
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    const { userId } = await req.json().catch(() => ({} as { userId?: unknown }));
    if (!isUuid(userId)) {
        return json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        const memberships = await listMemberships(auth.organizationId);
        const target = memberships.find((m) => m.user_id === userId);
        if (!target) {
            return json({ error: "Brukeren er ikke medlem" }, { status: 404 });
        }
        if (memberships.length <= 1) {
            return json({ error: LAST_MEMBER }, { status: 400 });
        }

        const vars = { userId, organizationId: auth.organizationId };
        await hasuraAdmin(
            `mutation RemoveMember($userId: uuid!, $organizationId: uuid!) {
                delete_user_organizations(where: {
                    user_id: { _eq: $userId },
                    organization_id: { _eq: $organizationId }
                }) { affected_rows }
            }`,
            vars,
        );

        // Two members removing each other both pass the check above. Whoever
        // finds the organisation empty afterwards puts their removal back.
        if ((await listMemberships(auth.organizationId)).length === 0) {
            await hasuraAdmin(
                `mutation RestoreMember($userId: uuid!, $organizationId: uuid!, $role: String!) {
                    insert_user_organizations_one(object: {
                        user_id: $userId,
                        organization_id: $organizationId,
                        role: $role
                    }) { user_id }
                }`,
                { ...vars, role: target.role },
            );
            return json({ error: LAST_MEMBER }, { status: 409 });
        }

        // Their open invites go too. Otherwise a member on the way out invites
        // a second address of their own and walks back in.
        await hasuraAdmin(
            `mutation RemoveMemberInvites($userId: uuid!, $organizationId: uuid!) {
                delete_invites(where: {
                    organization_id: { _eq: $organizationId },
                    created_by: { _eq: $userId },
                    redeemed_at: { _is_null: true }
                }) { affected_rows }
            }`,
            vars,
        );
        return json({ ok: true });
    } catch (e) {
        return serverError(e, "api/org/[slug]/members");
    }
}

import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireSession } from "../lib/apiAuth";
import { getUsersByIds } from "../lib/authUsers";
import { serverError } from "../lib/apiError";

type InviteRow = {
    id: string;
    organization_id: string;
    email: string;
    expires_at: string;
    redeemed_at: string | null;
};

/**
 * Redeem an invite token: the CALLER's session email must match the invited
 * address, so a leaked link alone grants nothing — you also need to control
 * the invited mailbox (Nhost verifies emails at signup).
 */
export async function POST(req: Request) {
    const session = await requireSession(req);
    if (session instanceof Response) return session;

    const { token } = await req.json().catch(() => ({} as { token?: unknown }));
    // The token variable is typed uuid! in the GraphQL query — validate the
    // shape here so a malformed token is a clean 404, not a Hasura error.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof token !== "string" || !UUID_RE.test(token)) {
        return json({ error: "Invitasjonen er ugyldig eller utløpt" }, { status: 404 });
    }

    try {
        const data = await hasuraAdmin<{ invites: InviteRow[] }>(
            `query GetInvite($token: uuid!) {
                invites(where: { token: { _eq: $token } }, limit: 1) {
                    id organization_id email expires_at redeemed_at
                }
            }`,
            { token },
        );
        const invite = data.invites[0];
        if (!invite || invite.redeemed_at || Date.parse(invite.expires_at) < Date.now()) {
            return json({ error: "Invitasjonen er ugyldig eller utløpt" }, { status: 404 });
        }

        const [user] = await getUsersByIds([session.userId]);
        if (!user?.email || user.email.toLowerCase() !== invite.email.toLowerCase()) {
            return json(
                { error: "Invitasjonen gjelder en annen e-postadresse enn kontoen din" },
                { status: 403 },
            );
        }

        const existing = await hasuraAdmin<{ user_organizations: Array<{ user_id: string }> }>(
            `query AlreadyMember($userId: uuid!, $organizationId: uuid!) {
                user_organizations(where: {
                    user_id: { _eq: $userId },
                    organization_id: { _eq: $organizationId }
                }, limit: 1) { user_id }
            }`,
            { userId: session.userId, organizationId: invite.organization_id },
        );
        if (existing.user_organizations.length === 0) {
            await hasuraAdmin(
                `mutation Join($userId: uuid!, $organizationId: uuid!) {
                    insert_user_organizations_one(object: {
                        user_id: $userId,
                        organization_id: $organizationId
                    }) { user_id }
                }`,
                { userId: session.userId, organizationId: invite.organization_id },
            );
        }
        await hasuraAdmin(
            `mutation MarkRedeemed($id: uuid!) {
                update_invites_by_pk(pk_columns: { id: $id }, _set: { redeemed_at: "now()" }) { id }
            }`,
            { id: invite.id },
        );

        const org = await hasuraAdmin<{ organizations: Array<{ slug: string; name: string }> }>(
            `query OrgById($id: uuid!) {
                organizations(where: { id: { _eq: $id } }, limit: 1) { slug name }
            }`,
            { id: invite.organization_id },
        );
        return json({ organization: org.organizations[0] ?? null });
    } catch (e) {
        return serverError(e, "api/invites/redeem");
    }
}

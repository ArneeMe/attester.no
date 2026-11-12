import { json, publicOrigin } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { sendInviteEmail } from "../lib/notify";
import { serverError } from "../lib/apiError";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    const { email } = await req.json().catch(() => ({} as { email?: unknown }));
    if (typeof email !== "string" || !email.includes("@")) {
        return json({ error: "Ugyldig e-postadresse" }, { status: 400 });
    }
    const normalized = email.trim().toLowerCase();

    try {
        const [invite, org] = await Promise.all([
            hasuraAdmin<{ insert_invites_one: { token: string } }>(
                `mutation CreateInvite($organizationId: uuid!, $email: String!, $createdBy: uuid!) {
                    insert_invites_one(object: {
                        organization_id: $organizationId,
                        email: $email,
                        created_by: $createdBy
                    }) { token }
                }`,
                { organizationId: auth.organizationId, email: normalized, createdBy: auth.userId },
            ),
            hasuraAdmin<{ organizations: Array<{ name: string }> }>(
                `query OrgName($id: uuid!) {
                    organizations(where: { id: { _eq: $id } }, limit: 1) { name }
                }`,
                { id: auth.organizationId },
            ),
        ]);
        const token = invite.insert_invites_one.token;
        const origin = publicOrigin(req);
        const link = `${origin}/registrer?invite=${encodeURIComponent(token)}`;
        const orgName = org.organizations[0]?.name ?? slug;
        const emailed = await sendInviteEmail(normalized, orgName, link);
        return json({ link, emailed });
    } catch (e) {
        return serverError(e, "api/org/[slug]/invites");
    }
}

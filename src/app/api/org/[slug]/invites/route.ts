import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";
import { sendInviteEmail } from "@/lib/server/notify";

export const runtime = "edge";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    const { email } = await req.json().catch(() => ({} as { email?: unknown }));
    if (typeof email !== "string" || !email.includes("@")) {
        return NextResponse.json({ error: "Ugyldig e-postadresse" }, { status: 400 });
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
        const origin = req.nextUrl.origin;
        const link = `${origin}/registrer?invite=${encodeURIComponent(token)}`;
        const orgName = org.organizations[0]?.name ?? slug;
        const emailed = await sendInviteEmail(normalized, orgName, link);
        return NextResponse.json({ link, emailed });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

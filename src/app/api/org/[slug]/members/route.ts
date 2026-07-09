import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";
import { getUserByEmail, getUsersByIds } from "@/lib/server/authUsers";

export const runtime = "edge";

type MembershipRow = { user_id: string; role: string };

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
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

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
        return NextResponse.json({ members });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

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

    try {
        const user = await getUserByEmail(email.trim().toLowerCase());
        if (!user) {
            return NextResponse.json(
                { error: "Fant ingen bruker med denne e-posten. Brukeren må ha en konto i systemet først." },
                { status: 404 },
            );
        }

        const existing = await listMemberships(auth.organizationId);
        if (existing.some((m) => m.user_id === user.id)) {
            return NextResponse.json({ error: "Brukeren er allerede medlem" }, { status: 409 });
        }

        await hasuraAdmin(
            `mutation AddMember($userId: uuid!, $organizationId: uuid!) {
                insert_user_organizations_one(object: {
                    user_id: $userId,
                    organization_id: $organizationId
                }) { user_id }
            }`,
            { userId: user.id, organizationId: auth.organizationId },
        );
        return NextResponse.json({
            member: { userId: user.id, email: user.email, displayName: user.displayName, role: "admin", isSelf: false },
        });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    const { userId } = await req.json().catch(() => ({} as { userId?: unknown }));
    if (typeof userId !== "string" || !userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        // Lockout guard: an org must always keep at least one member —
        // there is no super-admin UI to re-add one.
        const memberships = await listMemberships(auth.organizationId);
        if (!memberships.some((m) => m.user_id === userId)) {
            return NextResponse.json({ error: "Brukeren er ikke medlem" }, { status: 404 });
        }
        if (memberships.length <= 1) {
            return NextResponse.json(
                { error: "Kan ikke fjerne det siste medlemmet i organisasjonen" },
                { status: 400 },
            );
        }

        await hasuraAdmin(
            `mutation RemoveMember($userId: uuid!, $organizationId: uuid!) {
                delete_user_organizations(where: {
                    user_id: { _eq: $userId },
                    organization_id: { _eq: $organizationId }
                }) { affected_rows }
            }`,
            { userId, organizationId: auth.organizationId },
        );
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

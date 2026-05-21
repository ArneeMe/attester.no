import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { verifyJwt } from "@/lib/server/auth";
import { userBelongsToOrg } from "@/lib/server/membership";

export const runtime = "edge";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const claims = await verifyJwt(req.headers.get("authorization"));
    if (!claims) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { id } = await params;
    try {
        const lookup = await hasuraAdmin<{
            volunteers_by_pk: { organization_id: string } | null;
        }>(
            `query GetVolOrg($id: uuid!) {
                volunteers_by_pk(id: $id) { organization_id }
            }`,
            { id },
        );
        const vol = lookup.volunteers_by_pk;
        if (!vol) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (!(await userBelongsToOrg(claims.userId, vol.organization_id))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await hasuraAdmin(
            `mutation DeleteVolunteer($id: uuid!) {
                delete_volunteers_by_pk(id: $id) { id }
            }`,
            { id },
        );
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

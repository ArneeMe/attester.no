import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberById } from "@/lib/server/apiAuth";

export const runtime = "edge";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

        const auth = await requireOrgMemberById(req, vol.organization_id);
        if (auth instanceof NextResponse) return auth;

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

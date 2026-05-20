import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { verifyJwt } from "@/lib/server/auth";

export const runtime = "edge";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await verifyJwt(req.headers.get("authorization")))) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { id } = await params;
    try {
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

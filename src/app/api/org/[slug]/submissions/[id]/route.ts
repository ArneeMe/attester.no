import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";

export const runtime = "edge";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{ delete_submissions: { affected_rows: number } }>(
            `mutation DeleteSubmission($id: uuid!, $organizationId: uuid!) {
                delete_submissions(where: { id: { _eq: $id }, organization_id: { _eq: $organizationId } }) {
                    affected_rows
                }
            }`,
            { id, organizationId: auth.organizationId },
        );
        if (data.delete_submissions.affected_rows === 0) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

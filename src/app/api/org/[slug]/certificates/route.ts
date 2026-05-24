import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";

export const runtime = "edge";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    const { submissionId, hash, templateId } = await req.json();
    if (!submissionId || !hash || !templateId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const data = await hasuraAdmin<{ insert_certificates_one: { id: string } }>(
            `mutation InsertCertificate($organizationId: uuid!, $submissionId: String!, $hash: String!, $templateId: uuid!) {
                insert_certificates_one(object: {
                    organization_id: $organizationId,
                    submission_id: $submissionId,
                    hash: $hash,
                    template_id: $templateId
                }) { id }
            }`,
            { organizationId: auth.organizationId, submissionId, hash, templateId },
        );
        return NextResponse.json({ id: data.insert_certificates_one.id });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";
import { submissionBelongsToOrg, templateBelongsToOrg } from "@/lib/server/ownership";

export const runtime = "edge";

// SHA-512 hex digest is 128 chars. Reject anything else early so we don't
// stash junk strings in the hash column.
const HASH_HEX_LEN = 128;
const HEX_RE = /^[0-9a-f]+$/;

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    const { submissionId, hash, templateId } = await req.json();
    if (typeof submissionId !== "string" || !submissionId) {
        return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
    }
    if (typeof templateId !== "string" || !templateId) {
        return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
    }
    if (typeof hash !== "string" || hash.length !== HASH_HEX_LEN || !HEX_RE.test(hash)) {
        return NextResponse.json({ error: "Hash must be a 128-char hex SHA-512 digest" }, { status: 400 });
    }

    // The admin is authed for this org via requireOrgMemberBySlug, but the
    // submission_id and template_id come from their client. Verify both
    // belong to this same org so a logged-in admin can't mint a cert
    // referencing another org's data.
    if (!(await templateBelongsToOrg(templateId, auth.organizationId))) {
        return NextResponse.json({ error: "Template does not belong to this organization" }, { status: 400 });
    }
    if (!(await submissionBelongsToOrg(submissionId, auth.organizationId))) {
        return NextResponse.json({ error: "Submission does not belong to this organization" }, { status: 400 });
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

import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";
import { submissionBelongsToOrg, templateBelongsToOrg } from "@/lib/server/ownership";
import { getUsersByIds } from "@/lib/server/authUsers";

export const runtime = "edge";

type CertRow = {
    id: string;
    template_id: string | null;
    issued_by: string | null;
    created_at: string;
};

/**
 * List issued certificates for the org. Contains NO personal data by
 * construction — the rows only carry ids, timestamps, and the issuing
 * admin (resolved to email for display). The hash is deliberately not
 * returned; nothing in the admin UI needs it.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{ certificates: CertRow[] }>(
            `query GetCertificates($organizationId: uuid!) {
                certificates(
                    where: { organization_id: { _eq: $organizationId } },
                    order_by: { created_at: desc }
                ) { id template_id issued_by created_at }
            }`,
            { organizationId: auth.organizationId },
        );
        const issuerIds = [...new Set(data.certificates.map((c) => c.issued_by).filter((x): x is string => !!x))];
        const users = await getUsersByIds(issuerIds);
        const emailById = new Map(users.map((u) => [u.id, u.email]));
        const certificates = data.certificates.map((c) => ({
            id: c.id,
            templateId: c.template_id,
            issuedBy: c.issued_by ? emailById.get(c.issued_by) ?? null : null,
            createdAt: c.created_at,
        }));
        return NextResponse.json({ certificates });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

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
        // Insert the cert and delete the submission in ONE mutation. Hasura
        // runs both root fields in a single transaction, so the volunteer's
        // personal data is gone the moment the cert exists — the privacy
        // guarantee no longer depends on an admin remembering to click delete.
        // certificates.submission_id is a String column; submissions.id is
        // uuid — same value, two GraphQL types.
        const data = await hasuraAdmin<{
            insert_certificates_one: { id: string };
            delete_submissions_by_pk: { id: string } | null;
        }>(
            `mutation InsertCertificateDeleteSubmission($organizationId: uuid!, $submissionId: String!, $submissionUuid: uuid!, $hash: String!, $templateId: uuid!, $issuedBy: uuid!) {
                insert_certificates_one(object: {
                    organization_id: $organizationId,
                    submission_id: $submissionId,
                    hash: $hash,
                    template_id: $templateId,
                    issued_by: $issuedBy
                }) { id }
                delete_submissions_by_pk(id: $submissionUuid) { id }
            }`,
            { organizationId: auth.organizationId, submissionId, submissionUuid: submissionId, hash, templateId, issuedBy: auth.userId },
        );
        return NextResponse.json({ id: data.insert_certificates_one.id });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

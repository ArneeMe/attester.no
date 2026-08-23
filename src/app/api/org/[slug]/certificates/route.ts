import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";
import { submissionBelongsToOrg, templateBelongsToOrg } from "@/lib/server/ownership";
import { getUsersByIds } from "@/lib/server/authUsers";

export const runtime = "edge";

type CertRow = {
    id: string;
    submission_id: string;
    template_id: string | null;
    issued_by: string | null;
    created_at: string;
};

/**
 * List issued certificates for the org. Contains NO personal data by
 * construction — the rows only carry ids, timestamps, and the issuing
 * admin (resolved to email for display). The hash is deliberately not
 * returned; nothing in the admin UI needs it. `submissionId` IS returned —
 * it's a random id, not personal data, and the dashboard needs it to know
 * which still-present submissions have already been issued (see the
 * "Volunteer deletion" note in CLAUDE.md: issuance no longer deletes the
 * submission, so a submission and its cert coexist until the sweep).
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
                ) { id submission_id template_id issued_by created_at }
            }`,
            { organizationId: auth.organizationId },
        );
        const issuerIds = [...new Set(data.certificates.map((c) => c.issued_by).filter((x): x is string => !!x))];
        const users = await getUsersByIds(issuerIds);
        const emailById = new Map(users.map((u) => [u.id, u.email]));
        const certificates = data.certificates.map((c) => ({
            id: c.id,
            submissionId: c.submission_id,
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
        // Idempotent issuance: a submission is NOT deleted when its cert is
        // issued — issuance stamps `issued_at`, which starts the retention
        // window the sweep enforces (see CLAUDE.md "Volunteer deletion").
        // So "Generer PDF" can legitimately be clicked again for the same
        // submission, e.g. to regenerate a lost or misprinted PDF. Check for
        // an existing cert first and return it instead of minting a
        // duplicate. Re-issuing deliberately does NOT re-stamp issued_at:
        // the window runs from the FIRST issuance, so regenerating can't be
        // used to hold volunteer data indefinitely.
        //
        // This check-then-insert has a small race window under concurrent
        // double-clicks; a DB-enforced unique constraint on
        // (organization_id, submission_id) closes it and is tracked as
        // follow-up hardening.
        const existing = await hasuraAdmin<{ certificates: { id: string }[] }>(
            `query ExistingCertificate($organizationId: uuid!, $submissionId: String!) {
                certificates(
                    where: { organization_id: { _eq: $organizationId }, submission_id: { _eq: $submissionId } },
                    limit: 1
                ) { id }
            }`,
            { organizationId: auth.organizationId, submissionId },
        );
        if (existing.certificates.length > 0) {
            return NextResponse.json({ id: existing.certificates[0].id, alreadyIssued: true });
        }

        // Insert the cert AND stamp the submission's issued_at in one
        // mutation — Hasura runs both root fields in a single transaction,
        // so a cert can never exist without its deletion clock started.
        // certificates.submission_id is a String column while submissions.id
        // is uuid: same value, two GraphQL types.
        try {
            const data = await hasuraAdmin<{
                insert_certificates_one: { id: string };
                update_submissions_by_pk: { id: string } | null;
            }>(
                `mutation InsertCertificate($organizationId: uuid!, $submissionId: String!, $submissionUuid: uuid!, $hash: String!, $templateId: uuid!, $issuedBy: uuid!) {
                    insert_certificates_one(object: {
                        organization_id: $organizationId,
                        submission_id: $submissionId,
                        hash: $hash,
                        template_id: $templateId,
                        issued_by: $issuedBy
                    }) { id }
                    update_submissions_by_pk(
                        pk_columns: { id: $submissionUuid },
                        _set: { issued_at: "now()" }
                    ) { id }
                }`,
                {
                    organizationId: auth.organizationId,
                    submissionId,
                    submissionUuid: submissionId,
                    hash,
                    templateId,
                    issuedBy: auth.userId,
                },
            );
            return NextResponse.json({ id: data.insert_certificates_one.id });
        } catch (e) {
            // Concurrent double-click race: the check above found nothing,
            // but another request inserted first, and the unique index on
            // (organization_id, submission_id) rejects this one. The whole
            // mutation rolls back — including this request's issued_at stamp
            // — but the winner already set it, so the row is correct. Return
            // the winner: same submission, same data, therefore same hash.
            if ((e as Error).message.includes('certificates_org_submission_unique')) {
                const winner = await hasuraAdmin<{ certificates: Array<{ id: string }> }>(
                    `query ExistingCert($submissionId: String!, $organizationId: uuid!) {
                        certificates(where: {
                            submission_id: { _eq: $submissionId },
                            organization_id: { _eq: $organizationId }
                        }, limit: 1) { id }
                    }`,
                    { submissionId, organizationId: auth.organizationId },
                );
                if (winner.certificates.length > 0) {
                    return NextResponse.json({ id: winner.certificates[0].id, alreadyIssued: true });
                }
            }
            throw e;
        }
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

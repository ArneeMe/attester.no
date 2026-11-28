import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { getUsersByIds } from "../lib/authUsers";
import { serverError } from "../lib/apiError";

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
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

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
        return json({ certificates });
    } catch (e) {
        return serverError(e, "api/org/[slug]/certificates");
    }
}

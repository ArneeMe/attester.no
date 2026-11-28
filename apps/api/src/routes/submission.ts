import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { serverError } from "../lib/apiError";
import { isUuid } from "../lib/input";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;
    if (!isUuid(id)) return json({ error: "Not found" }, { status: 404 });

    try {
        const data = await hasuraAdmin<{ delete_submissions: { affected_rows: number } }>(
            `mutation DeleteSubmission($id: uuid!, $submissionId: String!, $organizationId: uuid!) {
                delete_submissions(where: { id: { _eq: $id }, organization_id: { _eq: $organizationId } }) {
                    affected_rows
                }
                update_deliveries(
                    where: {
                        submission_id: { _eq: $submissionId },
                        organization_id: { _eq: $organizationId },
                        status: { _eq: "queued" }
                    },
                    _set: { status: "failed", payload: null }
                ) {
                    affected_rows
                }
            }`,
            { id, submissionId: id, organizationId: auth.organizationId },
        );
        if (data.delete_submissions.affected_rows === 0) {
            return json({ error: "Not found" }, { status: 404 });
        }
        return json({ ok: true });
    } catch (e) {
        return serverError(e, "api/org/[slug]/submissions/[id]");
    }
}

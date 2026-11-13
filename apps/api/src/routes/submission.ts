import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { serverError } from "../lib/apiError";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

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
            return json({ error: "Not found" }, { status: 404 });
        }
        return json({ ok: true });
    } catch (e) {
        return serverError(e, "api/org/[slug]/submissions/[id]");
    }
}

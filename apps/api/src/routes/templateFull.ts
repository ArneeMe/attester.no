import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { serverError } from "../lib/apiError";
import { isUuid } from "../lib/input";

/**
 * One template with its PDF and layout, for the designer. The list leaves
 * those two out: every revision carries megabytes, and the list grows with
 * every save.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;
    if (!isUuid(id)) return json({ error: "Not found" }, { status: 404 });

    try {
        const data = await hasuraAdmin<{ templates: unknown[] }>(
            `query GetFullTemplate($id: uuid!, $organizationId: uuid!) {
                templates(where: { id: { _eq: $id }, organization_id: { _eq: $organizationId } }, limit: 1) {
                    id organization_id name description base_pdf schemas form_schema field_bindings is_offered created_at updated_at
                }
            }`,
            { id, organizationId: auth.organizationId },
        );
        if (!data.templates[0]) return json({ error: "Not found" }, { status: 404 });
        return json({ template: data.templates[0] });
    } catch (e) {
        return serverError(e, "api/org/[slug]/templates/[id]/full");
    }
}

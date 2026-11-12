import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { resolveOrgIdBySlug } from "../lib/apiAuth";
import { selectOfferedTemplates, type OfferableTemplate } from "../../../_shared/src/offeredTemplates";
import { serverError } from "../lib/apiError";

/**
 * Public: the attest types an org currently offers to volunteers, for the
 * chooser on /org/<slug>. Returns id, name and description only — never
 * base_pdf, pdfme schemas, field_bindings or form_schema. The form fetches
 * the chosen template's schema from templates/[id], which does its own
 * narrowing.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return json({ error: "Organization not found" }, { status: 404 });
        }

        const data = await hasuraAdmin<{ templates: OfferableTemplate[] }>(
            `query OfferedTemplates($organizationId: uuid!) {
                templates(where: { organization_id: { _eq: $organizationId } }) {
                    id name description is_offered
                }
            }`,
            { organizationId },
        );

        return json({ templates: selectOfferedTemplates(data.templates) });
    } catch (e) {
        return serverError(e, "api/org/[slug]/offered-templates");
    }
}

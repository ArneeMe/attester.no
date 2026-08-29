import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { resolveOrgIdBySlug } from "@/lib/server/apiAuth";
import { selectOfferedTemplates, type OfferableTemplate } from "@/util/offeredTemplates";

export const runtime = "edge";

/**
 * Public: the attest types an org currently offers to volunteers, for the
 * chooser on /org/<slug>. Returns id, name and description only — never
 * base_pdf, pdfme schemas, field_bindings or form_schema. The form fetches
 * the chosen template's schema from templates/[id], which does its own
 * narrowing.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const data = await hasuraAdmin<{ templates: OfferableTemplate[] }>(
            `query OfferedTemplates($organizationId: uuid!) {
                templates(where: { organization_id: { _eq: $organizationId } }) {
                    id name description is_offered
                }
            }`,
            { organizationId },
        );

        return NextResponse.json({ templates: selectOfferedTemplates(data.templates) });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

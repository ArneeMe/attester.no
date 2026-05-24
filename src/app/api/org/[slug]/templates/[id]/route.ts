import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { resolveOrgIdBySlug } from "@/lib/server/apiAuth";
import type { FormSchema } from "@/types/formSchema";

export const runtime = "edge";

/**
 * Public lookup of a template's display metadata. The verify page calls this
 * with `t=<id>` from the URL to render fields with proper labels. Does NOT
 * expose base_pdf, pdfme schemas, or anything else internal.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const data = await hasuraAdmin<{
            templates: Array<{ id: string; name: string; form_schema: FormSchema }>;
        }>(
            `query GetTemplatePublic($id: uuid!, $organizationId: uuid!) {
                templates(
                    where: { id: { _eq: $id }, organization_id: { _eq: $organizationId } },
                    limit: 1
                ) { id name form_schema }
            }`,
            { id, organizationId },
        );

        const tmpl = data.templates[0];
        if (!tmpl) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }
        return NextResponse.json({ template: tmpl });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

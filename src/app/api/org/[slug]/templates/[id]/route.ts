import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { resolveOrgIdBySlug } from "@/lib/server/apiAuth";
import type { FormFieldSchema, FormSchema } from "@/types/formSchema";
import type { LookupListContent } from "@/types/orgAssets";

export const runtime = "edge";

/**
 * Public lookup of a template's display metadata. The verify page calls this
 * with `t=<id>` from the URL to render fields with proper labels, and the
 * public submission form calls it for the default template.
 *
 * Resolves `optionsFromAsset` on dropdown fields by fetching the named lookup
 * list and replacing it with a flat `options` array of item names. The
 * volunteer never sees the asset id (or the item descriptions, which are for
 * PDF rendering only).
 *
 * Does NOT expose base_pdf, pdfme schemas, field_bindings, or anything else
 * internal.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const data = await hasuraAdmin<{
            templates: Array<{ id: string; name: string; form_schema: FormSchema | null }>;
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

        const form_schema = tmpl.form_schema
            ? await resolveSchemaOptions(tmpl.form_schema, organizationId)
            : null;

        return NextResponse.json({ template: { id: tmpl.id, name: tmpl.name, form_schema } });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

async function resolveSchemaOptions(
    schema: FormSchema,
    organizationId: string,
): Promise<FormSchema> {
    const assetIds = [
        ...new Set(
            schema
                .filter((f) => f.type === 'dropdown' && f.optionsFromAsset)
                .map((f) => f.optionsFromAsset as string),
        ),
    ];
    if (assetIds.length === 0) return schema;

    const data = await hasuraAdmin<{
        org_assets: Array<{ id: string; content: LookupListContent }>;
    }>(
        `query GetLookupLists($ids: [uuid!]!, $organizationId: uuid!) {
            org_assets(where: {
                id: { _in: $ids },
                organization_id: { _eq: $organizationId },
                kind: { _eq: "lookup_list" }
            }) { id content }
        }`,
        { ids: assetIds, organizationId },
    );

    const byId = new Map(data.org_assets.map((a) => [a.id, a.content.items?.map((i) => i.name) ?? []]));

    return schema.map((f): FormFieldSchema => {
        if (f.type !== 'dropdown' || !f.optionsFromAsset) return f;
        const opts = byId.get(f.optionsFromAsset);
        if (!opts) return { ...f, options: f.options ?? [] };
        const { optionsFromAsset: _unused, ...rest } = f;
        void _unused;
        return { ...rest, options: opts };
    });
}

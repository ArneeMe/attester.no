import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { resolveOrgIdBySlug, requireOrgMemberBySlug } from "@/lib/server/apiAuth";
import { templateBelongsToOrg } from "@/lib/server/ownership";
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

/**
 * Toggle is_default on a template. Templates are otherwise immutable
 * (editing creates a new row), but is_default is metadata about which one
 * the admin UI auto-loads — not part of the cert rendering — so flipping it
 * is safe and doesn't break previously-issued certs.
 *
 * Setting is_default=true clears it on all other templates in the same org,
 * matching the POST route's behaviour.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    if (!(await templateBelongsToOrg(id, auth.organizationId))) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await req.json();
    if (typeof body.isDefault !== "boolean") {
        return NextResponse.json({ error: "isDefault (boolean) is required" }, { status: 400 });
    }

    try {
        if (body.isDefault) {
            await hasuraAdmin(
                `mutation ClearDefaults($organizationId: uuid!) {
                    update_templates(
                        where: { organization_id: { _eq: $organizationId } }
                        _set: { is_default: false }
                    ) { affected_rows }
                }`,
                { organizationId: auth.organizationId },
            );
        }
        const data = await hasuraAdmin<{ update_templates_by_pk: { id: string; is_default: boolean } }>(
            `mutation SetDefault($id: uuid!, $isDefault: Boolean!) {
                update_templates_by_pk(pk_columns: { id: $id }, _set: { is_default: $isDefault }) {
                    id is_default
                }
            }`,
            { id, isDefault: body.isDefault },
        );
        return NextResponse.json({ template: data.update_templates_by_pk });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

/**
 * Delete a template. Refused if any certificate still references it, because
 * the verify URL embeds template_id and a verifier might need to fetch the
 * template for field labels (the hash itself doesn't depend on the template).
 *
 * Soft-delete (archive) is the future improvement here; for now we just
 * surface the count so the admin knows why.
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    if (!(await templateBelongsToOrg(id, auth.organizationId))) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    try {
        const certCount = await hasuraAdmin<{
            certificates_aggregate: { aggregate: { count: number } };
        }>(
            `query CountCerts($templateId: uuid!) {
                certificates_aggregate(where: { template_id: { _eq: $templateId } }) {
                    aggregate { count }
                }
            }`,
            { templateId: id },
        );
        const n = certCount.certificates_aggregate.aggregate.count;
        if (n > 0) {
            return NextResponse.json(
                {
                    error: `Kan ikke slette malen: ${n} sertifikat${n === 1 ? '' : 'er'} referer til den. Slett sertifikatene først eller arkiver malen.`,
                    referencingCerts: n,
                },
                { status: 409 },
            );
        }
        await hasuraAdmin(
            `mutation DeleteTemplate($id: uuid!) {
                delete_templates_by_pk(id: $id) { id }
            }`,
            { id },
        );
        return NextResponse.json({ ok: true });
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

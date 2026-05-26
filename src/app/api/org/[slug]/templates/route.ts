import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";
import type { FormSchema } from "@/types/formSchema";
import type { FieldBindings } from "@/types/fieldBindings";

export const runtime = "edge";

type TemplateRow = {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    base_pdf: string;
    schemas: unknown;
    form_schema: FormSchema;
    field_bindings: FieldBindings;
    is_default: boolean;
    created_at: string;
    updated_at: string;
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{ templates: TemplateRow[] }>(
            `query GetTemplates($organizationId: uuid!) {
                templates(where: { organization_id: { _eq: $organizationId } }, order_by: { created_at: asc }) {
                    id organization_id name description base_pdf schemas form_schema field_bindings is_default created_at updated_at
                }
            }`,
            { organizationId: auth.organizationId },
        );
        return NextResponse.json({ templates: data.templates });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

// Base PDFs are stored inline as base64 data URLs. Cap at ~5MB to keep one
// template row from filling the page. The pdfme designer typically produces
// templates well below this.
const MAX_BASE_PDF_LEN = 5 * 1024 * 1024;
const MAX_TEMPLATE_NAME_LEN = 200;
const MAX_TEMPLATE_DESC_LEN = 2000;
const MAX_SCHEMAS_JSON_LEN = 2 * 1024 * 1024;

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    const { name, description, basePdf, schemas, formSchema, fieldBindings, isDefault } = await req.json();
    if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Missing or invalid name" }, { status: 400 });
    }
    if (name.length > MAX_TEMPLATE_NAME_LEN) {
        return NextResponse.json({ error: "Template name too long" }, { status: 400 });
    }
    if (description !== undefined && description !== null) {
        if (typeof description !== "string") {
            return NextResponse.json({ error: "description must be a string" }, { status: 400 });
        }
        if (description.length > MAX_TEMPLATE_DESC_LEN) {
            return NextResponse.json({ error: "Description too long" }, { status: 400 });
        }
    }
    if (typeof basePdf !== "string" || !basePdf) {
        return NextResponse.json({ error: "Missing basePdf" }, { status: 400 });
    }
    if (basePdf.length > MAX_BASE_PDF_LEN) {
        return NextResponse.json({ error: "Base PDF too large (max ~5MB)" }, { status: 413 });
    }
    if (!Array.isArray(schemas)) {
        return NextResponse.json({ error: "schemas must be a 2D array" }, { status: 400 });
    }
    if (JSON.stringify(schemas).length > MAX_SCHEMAS_JSON_LEN) {
        return NextResponse.json({ error: "schemas payload too large" }, { status: 413 });
    }
    if (formSchema !== undefined && formSchema !== null && !Array.isArray(formSchema)) {
        return NextResponse.json({ error: "formSchema must be an array if provided" }, { status: 400 });
    }
    if (fieldBindings !== undefined && fieldBindings !== null) {
        if (typeof fieldBindings !== "object" || Array.isArray(fieldBindings)) {
            return NextResponse.json({ error: "fieldBindings must be an object" }, { status: 400 });
        }
    }

    try {
        if (isDefault) {
            await hasuraAdmin<{ update_templates: { affected_rows: number } }>(
                `mutation ClearDefaults($organizationId: uuid!) {
                    update_templates(
                        where: { organization_id: { _eq: $organizationId } }
                        _set: { is_default: false }
                    ) { affected_rows }
                }`,
                { organizationId: auth.organizationId },
            );
        }

        const data = await hasuraAdmin<{
            insert_templates_one: { id: string; created_at: string; updated_at: string };
        }>(
            `mutation InsertTemplate(
                $organizationId: uuid!, $name: String!, $description: String,
                $basePdf: String!, $schemas: jsonb!, $formSchema: jsonb,
                $fieldBindings: jsonb!, $isDefault: Boolean!
            ) {
                insert_templates_one(object: {
                    organization_id: $organizationId, name: $name, description: $description,
                    base_pdf: $basePdf, schemas: $schemas, form_schema: $formSchema,
                    field_bindings: $fieldBindings, is_default: $isDefault
                }) { id created_at updated_at }
            }`,
            {
                organizationId: auth.organizationId,
                name,
                description,
                basePdf,
                schemas,
                formSchema: formSchema ?? null,
                fieldBindings: fieldBindings ?? {},
                isDefault: isDefault ?? false,
            },
        );
        return NextResponse.json({ template: data.insert_templates_one });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

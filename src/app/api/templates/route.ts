import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";

export const runtime = "edge";

type TemplateRow = {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    base_pdf: string;
    schemas: unknown;
    is_default: boolean;
    created_at: string;
    updated_at: string;
};

export async function GET(req: NextRequest) {
    const slug = req.nextUrl.searchParams.get("slug");
    if (!slug) {
        return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{ templates: TemplateRow[] }>(
            `query GetTemplates($organizationId: uuid!) {
                templates(where: { organization_id: { _eq: $organizationId } }, order_by: { created_at: asc }) {
                    id organization_id name description base_pdf schemas is_default created_at updated_at
                }
            }`,
            { organizationId: auth.organizationId },
        );
        return NextResponse.json({ templates: data.templates });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { slug, name, description, basePdf, schemas, isDefault } = await req.json();
    if (!slug || !name || !basePdf || !schemas) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{
            insert_templates_one: { id: string; created_at: string; updated_at: string };
        }>(
            `mutation InsertTemplate(
                $organizationId: uuid!, $name: String!, $description: String,
                $basePdf: String!, $schemas: jsonb!, $isDefault: Boolean!
            ) {
                insert_templates_one(object: {
                    organization_id: $organizationId, name: $name, description: $description,
                    base_pdf: $basePdf, schemas: $schemas, is_default: $isDefault
                }) { id created_at updated_at }
            }`,
            { organizationId: auth.organizationId, name, description, basePdf, schemas, isDefault: isDefault ?? false },
        );
        return NextResponse.json({ template: data.insert_templates_one });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

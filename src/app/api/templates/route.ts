import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { verifyJwt } from "@/lib/server/auth";

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
    if (!(await verifyJwt(req.headers.get("authorization")))) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const organizationId = req.nextUrl.searchParams.get("organizationId");
    if (!organizationId) {
        return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });
    }

    try {
        const data = await hasuraAdmin<{ templates: TemplateRow[] }>(
            `query GetTemplates($organizationId: uuid!) {
                templates(where: { organization_id: { _eq: $organizationId } }, order_by: { created_at: asc }) {
                    id organization_id name description base_pdf schemas is_default created_at updated_at
                }
            }`,
            { organizationId },
        );
        return NextResponse.json({ templates: data.templates });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await verifyJwt(req.headers.get("authorization")))) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { organizationId, name, description, basePdf, schemas, isDefault } = await req.json();
    if (!organizationId || !name || !basePdf || !schemas) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

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
            { organizationId, name, description, basePdf, schemas, isDefault: isDefault ?? false },
        );
        return NextResponse.json({ template: data.insert_templates_one });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

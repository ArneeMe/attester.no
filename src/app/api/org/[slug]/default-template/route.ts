import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { resolveOrgIdBySlug } from "@/lib/server/apiAuth";
import type { FormSchema } from "@/types/formSchema";

export const runtime = "edge";

type DefaultTemplateRow = {
    id: string;
    name: string;
    form_schema: FormSchema | null;
};

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

        const data = await hasuraAdmin<{ templates: DefaultTemplateRow[] }>(
            `query GetDefaultTemplate($organizationId: uuid!) {
                templates(
                    where: { organization_id: { _eq: $organizationId }, is_default: { _eq: true } },
                    limit: 1
                ) { id name form_schema }
            }`,
            { organizationId },
        );

        return NextResponse.json({ template: data.templates[0] ?? null });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

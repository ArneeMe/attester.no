import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug, resolveOrgIdBySlug } from "@/lib/server/apiAuth";

export const runtime = "edge";

type SubmissionRow = {
    id: string;
    organization_id: string;
    template_id: string;
    data: Record<string, string>;
    created_at: string;
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{ submissions: SubmissionRow[] }>(
            `query GetSubmissions($organizationId: uuid!) {
                submissions(
                    where: { organization_id: { _eq: $organizationId } },
                    order_by: { created_at: asc }
                ) {
                    id organization_id template_id data created_at
                }
            }`,
            { organizationId: auth.organizationId },
        );
        return NextResponse.json({ submissions: data.submissions });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const { templateId, data } = await req.json();
    if (!templateId || !data || typeof data !== "object") {
        return NextResponse.json({ error: "Missing templateId or data" }, { status: 400 });
    }

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const result = await hasuraAdmin<{
            insert_submissions_one: { id: string; created_at: string };
        }>(
            `mutation InsertSubmission(
                $organizationId: uuid!, $templateId: uuid!, $data: jsonb!
            ) {
                insert_submissions_one(object: {
                    organization_id: $organizationId,
                    template_id: $templateId,
                    data: $data
                }) { id created_at }
            }`,
            { organizationId, templateId, data },
        );
        return NextResponse.json({ submission: result.insert_submissions_one });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { resolveOrgIdBySlug } from "@/lib/server/apiAuth";

export const runtime = "edge";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const volunteerId = req.nextUrl.searchParams.get("volunteerId");
    if (!volunteerId) {
        return NextResponse.json({ error: "Missing volunteerId" }, { status: 400 });
    }

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const data = await hasuraAdmin<{
            certificates: Array<{ hash: string; template_id: string | null }>;
        }>(
            `query VerifyCertificate($volunteerId: String!, $organizationId: uuid!) {
                certificates(
                    where: {
                        volunteer_id: { _eq: $volunteerId },
                        organization_id: { _eq: $organizationId }
                    },
                    limit: 1
                ) { hash template_id }
            }`,
            { volunteerId, organizationId },
        );
        const cert = data.certificates[0] ?? null;
        return NextResponse.json({ hash: cert?.hash ?? null, template_id: cert?.template_id ?? null });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

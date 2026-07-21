import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { resolveOrgIdBySlug } from "@/lib/server/apiAuth";

export const runtime = "edge";

/**
 * Public branding for an org's pages: name + the first default logo.
 * Unauthenticated by design — the logo already appears on every issued
 * PDF, so it is not sensitive. Never exposes other asset kinds.
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
        const data = await hasuraAdmin<{
            organizations: Array<{ name: string }>;
            org_assets: Array<{ content: { image?: string } }>;
        }>(
            `query Branding($organizationId: uuid!) {
                organizations(where: { id: { _eq: $organizationId } }, limit: 1) { name }
                org_assets(
                    where: {
                        organization_id: { _eq: $organizationId },
                        kind: { _eq: "logo" },
                        is_default: { _eq: true }
                    },
                    order_by: { sort_order: asc },
                    limit: 1
                ) { content }
            }`,
            { organizationId },
        );
        return NextResponse.json({
            name: data.organizations[0]?.name ?? slug,
            logo: data.org_assets[0]?.content?.image ?? null,
        });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

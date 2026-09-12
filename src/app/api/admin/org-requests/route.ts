import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requirePlatformAdmin } from "@/lib/server/platformAdmin";
import { serverError } from "@/lib/server/apiError";

export const runtime = "edge";

type RequestRow = {
    id: string;
    requested_slug: string;
    organization_name: string;
    org_number: string | null;
    contact_email: string;
    contact_name: string | null;
    message: string | null;
    status: string;
    organization_id: string | null;
    created_at: string;
    handled_at: string | null;
};

export async function GET(req: NextRequest) {
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{ org_requests: RequestRow[] }>(
            `query AdminListOrgRequests {
                org_requests(order_by: { created_at: desc }) {
                    id requested_slug organization_name org_number
                    contact_email contact_name message
                    status organization_id created_at handled_at
                }
            }`,
        );
        return NextResponse.json({
            requests: data.org_requests.map((r) => ({
                id: r.id,
                requestedSlug: r.requested_slug,
                organizationName: r.organization_name,
                orgNumber: r.org_number,
                contactEmail: r.contact_email,
                contactName: r.contact_name,
                message: r.message,
                status: r.status,
                organizationId: r.organization_id,
                createdAt: r.created_at,
                handledAt: r.handled_at,
            })),
        });
    } catch (e) {
        return serverError(e, "api/admin/org-requests");
    }
}

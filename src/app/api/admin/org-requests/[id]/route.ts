import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requirePlatformAdmin } from "@/lib/server/platformAdmin";
import { createInvite, createOrganization, slugIsTaken } from "@/lib/server/createOrg";
import { MAX_NAME_LEN, MAX_SLUG_LEN, SLUG_RE } from "@/util/orgRequest";
import { serverError } from "@/lib/server/apiError";

export const runtime = "edge";

type RequestRow = {
    id: string;
    requested_slug: string;
    organization_name: string;
    contact_email: string;
    status: string;
};

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const { action, slug: slugOverride, organizationName: nameOverride } = await req
        .json()
        .catch(() => ({} as Record<string, unknown>));
    if (action !== "approve" && action !== "reject") {
        return NextResponse.json({ error: "Ugyldig handling" }, { status: 400 });
    }

    try {
        const found = await hasuraAdmin<{ org_requests: RequestRow[] }>(
            `query GetOrgRequest($id: uuid!) {
                org_requests(where: { id: { _eq: $id } }, limit: 1) {
                    id requested_slug organization_name contact_email status
                }
            }`,
            { id },
        );
        const request = found.org_requests[0];
        if (!request) {
            return NextResponse.json({ error: "Forespørselen finnes ikke" }, { status: 404 });
        }
        if (request.status !== "pending") {
            return NextResponse.json({ error: "Forespørselen er allerede behandlet" }, { status: 409 });
        }

        if (action === "reject") {
            await hasuraAdmin(
                `mutation RejectOrgRequest($id: uuid!, $handledBy: uuid!) {
                    update_org_requests_by_pk(
                        pk_columns: { id: $id },
                        _set: { status: "rejected", handled_at: "now()", handled_by: $handledBy }
                    ) { id }
                }`,
                { id, handledBy: auth.userId },
            );
            return NextResponse.json({ status: "rejected" });
        }

        const slug = (typeof slugOverride === "string" ? slugOverride : request.requested_slug)
            .trim()
            .toLowerCase();
        const organizationName = (
            typeof nameOverride === "string" ? nameOverride : request.organization_name
        ).trim();
        if (!SLUG_RE.test(slug) || slug.length > MAX_SLUG_LEN) {
            return NextResponse.json(
                { error: "Ugyldig slug. Bruk små bokstaver, tall og bindestrek" },
                { status: 400 },
            );
        }
        if (!organizationName || organizationName.length > MAX_NAME_LEN) {
            return NextResponse.json({ error: "Ugyldig navn" }, { status: 400 });
        }
        if (await slugIsTaken(slug)) {
            return NextResponse.json({ error: `Organisasjonen "${slug}" finnes allerede` }, { status: 409 });
        }

        const organizationId = await createOrganization(slug, organizationName);
        const token = await createInvite(organizationId, request.contact_email, auth.userId);

        await hasuraAdmin(
            `mutation ApproveOrgRequest($id: uuid!, $organizationId: uuid!, $handledBy: uuid!) {
                update_org_requests_by_pk(
                    pk_columns: { id: $id },
                    _set: {
                        status: "approved",
                        handled_at: "now()",
                        handled_by: $handledBy,
                        organization_id: $organizationId
                    }
                ) { id }
            }`,
            { id, organizationId, handledBy: auth.userId },
        );

        return NextResponse.json({
            status: "approved",
            organization: { id: organizationId, slug, name: organizationName },
            inviteLink: `${req.nextUrl.origin}/registrer?invite=${encodeURIComponent(token)}`,
            inviteEmail: request.contact_email,
        });
    } catch (e) {
        return serverError(e, "api/admin/org-requests/[id]");
    }
}

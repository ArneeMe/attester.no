import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { slugIsTaken } from "@/lib/server/createOrg";
import { validateOrgRequest } from "@/util/orgRequest";
import { serverError } from "@/lib/server/apiError";
import { notifyPlatformOwner } from "@/lib/server/notifyOwner";

export const runtime = "edge";

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(req: NextRequest) {
    const body = await req.text();
    if (body.length > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const result = validateOrgRequest(parsed);
    if (!result.ok) {
        if (result.error === "honeypot") return NextResponse.json({ received: true });
        return NextResponse.json({ error: result.error, field: result.field }, { status: 400 });
    }
    const { slug, organizationName, orgNumber, contactEmail, contactName, message } = result.value;

    try {
        if (await slugIsTaken(slug)) {
            return NextResponse.json({ error: "slug_taken", field: "slug" }, { status: 409 });
        }

        const pending = await hasuraAdmin<{ org_requests: Array<{ id: string }> }>(
            `query PendingForSlug($slug: String!) {
                org_requests(where: {
                    requested_slug: { _eq: $slug },
                    status: { _eq: "pending" }
                }, limit: 1) { id }
            }`,
            { slug },
        );
        if (pending.org_requests.length > 0) {
            return NextResponse.json({ error: "slug_pending", field: "slug" }, { status: 409 });
        }

        await hasuraAdmin(
            `mutation CreateOrgRequest(
                $slug: String!, $organizationName: String!, $orgNumber: String,
                $contactEmail: String!, $contactName: String, $message: String
            ) {
                insert_org_requests_one(object: {
                    requested_slug: $slug,
                    organization_name: $organizationName,
                    org_number: $orgNumber,
                    contact_email: $contactEmail,
                    contact_name: $contactName,
                    message: $message
                }) { id }
            }`,
            { slug, organizationName, orgNumber, contactEmail, contactName, message },
        );

        await notifyPlatformOwner(
            "Ny organisasjonsforespørsel",
            "En organisasjon venter på godkjenning på attester.no.",
            `${req.nextUrl.origin}/admin`,
        );
        return NextResponse.json({ received: true });
    } catch (e) {
        return serverError(e, "api/org-requests");
    }
}

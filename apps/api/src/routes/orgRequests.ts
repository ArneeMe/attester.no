import { json, appOrigin } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { slugIsTaken } from "../lib/createOrg";
import { validateOrgRequest } from "@attester/shared/orgRequest";
import { serverError } from "../lib/apiError";
import { notifyPlatformOwner } from "../lib/notifyOwner";

const MAX_BODY_BYTES = 8 * 1024;

const MAX_PENDING_REQUESTS = 100;

export async function POST(req: Request) {
    const body = await req.text();
    if (body.length > MAX_BODY_BYTES) {
        return json({ error: "Request too large" }, { status: 413 });
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return json({ error: "Malformed JSON" }, { status: 400 });
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return json({ error: "Invalid body" }, { status: 400 });
    }

    const result = validateOrgRequest(parsed);
    if (!result.ok) {
        if (result.error === "honeypot") return json({ received: true });
        return json({ error: result.error, field: result.field }, { status: 400 });
    }
    const { slug, organizationName, orgNumber, contactEmail, contactName, message } = result.value;

    try {
        if (await slugIsTaken(slug)) {
            return json({ error: "slug_taken", field: "slug" }, { status: 409 });
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
            return json({ error: "slug_pending", field: "slug" }, { status: 409 });
        }

        // Each pending request pings the owner and holds its slug. A script
        // must not be able to do either without limit.
        const waiting = await hasuraAdmin<{ org_requests_aggregate: { aggregate: { count: number } } }>(
            `query PendingRequestCount {
                org_requests_aggregate(where: { status: { _eq: "pending" } }) { aggregate { count } }
            }`,
        );
        if (waiting.org_requests_aggregate.aggregate.count >= MAX_PENDING_REQUESTS) {
            return json({ error: "too_many_pending" }, { status: 429 });
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
            `${appOrigin()}/admin`,
        );
        return json({ received: true });
    } catch (e) {
        return serverError(e, "api/org-requests");
    }
}

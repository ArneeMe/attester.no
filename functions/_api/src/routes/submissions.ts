import { json, publicOrigin } from "../http";
import { dispatchNotices, queueSubmissionNotice } from "../notices/submissionWaiting";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug, resolveOrgIdBySlug } from "../lib/apiAuth";
import { templateBelongsToOrg } from "../lib/ownership";
import { sweepExpiredSubmissions } from "../lib/retention";
import { serverError } from "../lib/apiError";
import { certificateChannel } from "../channels";
import { toView, type DeliveryStatus } from "../delivery/deliveries";
import { digipostEnabled, storeRecipient } from "../delivery/recipients";
import { isValidNationalId, normalizeNationalId } from "../../../_shared/src/nationalId";

// Hard cap on how much volunteer data we accept in one submission, so an
// anonymous poster can't flood the DB with megabytes per request. Plenty
// of headroom for any realistic form.
const MAX_SUBMISSION_BYTES = 64 * 1024;
const MAX_FIELD_VALUE_LEN = 8 * 1024;

type SubmissionRow = {
    id: string;
    organization_id: string;
    template_id: string;
    data: Record<string, string>;
    created_at: string;
    issued_at: string | null;
};

type DeliveryRow = { submission_id: string; status: DeliveryStatus; sent_at: string | null };

export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    // Enforce the retention TTL before reading, so the admin never sees
    // (and the response never contains) rows that should already be gone.
    await sweepExpiredSubmissions();

    try {
        const data = await hasuraAdmin<{ submissions: SubmissionRow[]; deliveries: DeliveryRow[] }>(
            `query GetSubmissions($organizationId: uuid!) {
                submissions(
                    where: { organization_id: { _eq: $organizationId } },
                    order_by: { created_at: asc }
                ) {
                    id organization_id template_id data created_at issued_at
                }
                deliveries(where: { organization_id: { _eq: $organizationId } }) {
                    submission_id status sent_at
                }
            }`,
            { organizationId: auth.organizationId },
        );
        // The admin learns that a recipient exists, never the number itself.
        const recipients = await hasuraAdmin<{ submission_recipients: Array<{ submission_id: string }> }>(
            `query GetRecipientFlags($ids: [uuid!]!) {
                submission_recipients(where: { submission_id: { _in: $ids } }) { submission_id }
            }`,
            { ids: data.submissions.map((s) => s.id) },
        );
        const withRecipient = new Set(recipients.submission_recipients.map((r) => r.submission_id));
        const deliveryBySubmission = new Map(data.deliveries.map((d) => [d.submission_id, toView(d)]));
        return json({
            submissions: data.submissions.map((s) => ({
                ...s,
                has_recipient: withRecipient.has(s.id),
                delivery: deliveryBySubmission.get(s.id) ?? null,
            })),
        });
    } catch (e) {
        return serverError(e, "api/org/[slug]/submissions");
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const body = await req.text();
    if (body.length > MAX_SUBMISSION_BYTES) {
        return json({ error: "Submission too large" }, { status: 413 });
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        return json({ error: "Malformed JSON" }, { status: 400 });
    }
    const { templateId, data, nationalId } = parsed as { templateId?: unknown; data?: unknown; nationalId?: unknown };
    if (nationalId !== undefined && (typeof nationalId !== "string" || !isValidNationalId(nationalId))) {
        return json({ error: "Invalid national identity number", field: "nationalId" }, { status: 400 });
    }
    if (typeof templateId !== "string" || !templateId) {
        return json({ error: "Missing templateId" }, { status: 400 });
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return json({ error: "Missing or invalid data" }, { status: 400 });
    }
    // Strict shape: data is a flat string→string map. Reject anything else
    // (arrays, nested objects) so we don't end up serialising "[object Object]"
    // into a cert URL.
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (typeof v !== "string") {
            return json({ error: `Field "${k}" must be a string` }, { status: 400 });
        }
        if (v.length > MAX_FIELD_VALUE_LEN) {
            return json({ error: `Field "${k}" is too long` }, { status: 413 });
        }
    }

    // Piggyback the retention sweep on the anonymous write path too, so
    // expired rows are purged even if no admin logs in for days.
    await sweepExpiredSubmissions();

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return json({ error: "Organization not found" }, { status: 404 });
        }

        // Cross-org guard: the templateId in the body MUST belong to the org
        // in the URL slug. Without this check, anyone could submit using a
        // different org's template id, breaking cert rendering later.
        if (!(await templateBelongsToOrg(templateId, organizationId))) {
            return json({ error: "Template does not belong to this organization" }, { status: 400 });
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

        // Kept only when the organisation offers Digipost and the platform can
        // deliver there. Otherwise the number is dropped, not stored unused.
        // The submission is already saved. Failing here would make the
        // volunteer send it again, so they lose Digipost, not the request.
        if (typeof nationalId === "string") {
            try {
                if (certificateChannel() && (await digipostEnabled(organizationId))) {
                    await storeRecipient(result.insert_submissions_one.id, normalizeNationalId(nationalId));
                }
            } catch (e) {
                console.error("Storing recipient failed:", (e as Error).name);
            }
        }

        await queueSubmissionNotice(organizationId);
        await dispatchNotices(publicOrigin(req));

        return json({ submission: result.insert_submissions_one });
    } catch (e) {
        return serverError(e, "api/org/[slug]/submissions");
    }
}

import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { resolveOrgIdBySlug } from "../lib/apiAuth";
import { serverError } from "../lib/apiError";
import { readJsonObject } from "../lib/input";
import { noticeChannel } from "../channels";
import { hashStatusToken, reminderState } from "../status/status";
import { ISSUED_RETENTION_HOURS } from "@attester/shared/retention";

type Row = {
    id: string;
    created_at: string;
    issued_at: string | null;
    reminded_at: string | null;
    reminder_count: number;
};

const NOT_FOUND = { error: "Not found" };

// One answer for "never existed", "deleted" and "wrong organisation", so the
// page cannot be used to learn which it was.
async function find(slug: string, token: unknown): Promise<{ organizationId: string; row: Row } | null> {
    const hash = hashStatusToken(token);
    if (!hash) return null;
    const organizationId = await resolveOrgIdBySlug(slug);
    if (!organizationId) return null;
    const data = await hasuraAdmin<{ submissions: Row[] }>(
        `query SubmissionStatus($hash: String!, $organizationId: uuid!) {
            submissions(where: { status_token_hash: { _eq: $hash }, organization_id: { _eq: $organizationId } }, limit: 1) {
                id created_at issued_at reminded_at reminder_count
            }
        }`,
        { hash, organizationId },
    );
    const row = data.submissions[0];
    return row ? { organizationId, row } : null;
}

async function view(organizationId: string, row: Row) {
    const delivery = await hasuraAdmin<{ deliveries: Array<{ status: string; sent_at: string | null }> }>(
        `query StatusDelivery($organizationId: uuid!, $submissionId: String!) {
            deliveries(where: { organization_id: { _eq: $organizationId }, submission_id: { _eq: $submissionId } }, limit: 1) {
                status sent_at
            }
        }`,
        { organizationId, submissionId: row.id },
    );
    const sent = delivery.deliveries[0];
    const issued = row.issued_at !== null;
    return {
        // Dates and nothing else. The page never gets a name or a field back.
        status: issued ? "issued" : "waiting",
        submittedAt: row.created_at,
        issuedAt: row.issued_at,
        deletedAt: issued
            ? new Date(Date.parse(row.issued_at!) + ISSUED_RETENTION_HOURS * 3600_000).toISOString()
            : null,
        digipost: sent ? { status: sent.status, sentAt: sent.sent_at } : null,
        reminder: !issued && noticeChannel() ? reminderState(row) : null,
    };
}

/** The volunteer's own view of their request. The secret travels in the body, never in the address. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const body = await readJsonObject(req);
    try {
        const found = await find(slug, body.token);
        if (!found) return json(NOT_FOUND, { status: 404 });
        return json(await view(found.organizationId, found.row));
    } catch (e) {
        return serverError(e, "api/org/[slug]/status");
    }
}

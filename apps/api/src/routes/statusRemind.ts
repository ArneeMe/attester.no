import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { resolveOrgIdBySlug } from "../lib/apiAuth";
import { serverError } from "../lib/apiError";
import { readJsonObject } from "../lib/input";
import { noticeChannel } from "../channels";
import { dispatchNotices, queueSubmissionNotice } from "../notices/submissionWaiting";
import { hashStatusToken, reminderState } from "../status/status";

type Row = { id: string; created_at: string; issued_at: string | null; reminded_at: string | null; reminder_count: number };

/**
 * The volunteer nudges the organisation. It queues the same notice a new
 * submission does: "something is waiting", never who. Bounded three ways:
 * not before the request has waited a while, not more often than weekly, and
 * a few times in all. The outbox adds its own limit per organisation.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const body = await readJsonObject(req);
    const hash = hashStatusToken(body.token);
    try {
        const organizationId = hash ? await resolveOrgIdBySlug(slug) : null;
        if (!hash || !organizationId) return json({ error: "Not found" }, { status: 404 });

        const data = await hasuraAdmin<{ submissions: Row[] }>(
            `query SubmissionForReminder($hash: String!, $organizationId: uuid!) {
                submissions(where: { status_token_hash: { _eq: $hash }, organization_id: { _eq: $organizationId } }, limit: 1) {
                    id created_at issued_at reminded_at reminder_count
                }
            }`,
            { hash, organizationId },
        );
        const row = data.submissions[0];
        if (!row) return json({ error: "Not found" }, { status: 404 });
        if (row.issued_at || !noticeChannel()) {
            return json({ error: "A reminder is not possible for this request" }, { status: 409 });
        }

        const state = reminderState(row);
        const now = new Date();
        if (!state.canRemindAt || Date.parse(state.canRemindAt) > now.getTime()) {
            return json({ error: "Too early for a reminder", reminder: state }, { status: 429 });
        }

        // The count in the condition makes two clicks at once count as one.
        const updated = await hasuraAdmin<{ update_submissions: { affected_rows: number } }>(
            `mutation RecordReminder($id: uuid!, $count: Int!, $now: timestamptz!) {
                update_submissions(
                    where: { id: { _eq: $id }, reminder_count: { _eq: $count }, issued_at: { _is_null: true } },
                    _set: { reminded_at: $now },
                    _inc: { reminder_count: 1 }
                ) { affected_rows }
            }`,
            { id: row.id, count: row.reminder_count, now: now.toISOString() },
        );
        if (updated.update_submissions.affected_rows > 0) {
            await queueSubmissionNotice(organizationId);
            void dispatchNotices();
        }
        return json({
            reminder: reminderState({
                created_at: row.created_at,
                reminded_at: now.toISOString(),
                reminder_count: row.reminder_count + 1,
            }),
        });
    } catch (e) {
        return serverError(e, "api/org/[slug]/status/remind");
    }
}

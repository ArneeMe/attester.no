import { hasuraAdmin } from "../lib/hasura";
import { getUsersByIds } from "../lib/authUsers";
import { noticeChannel } from "../channels";
import { appOrigin } from "../http";
import { reportError } from "../errors/report";

// One email per organisation per window, however many submissions arrive.
export const NOTICE_QUIET_HOURS = 6;
const MAX_ATTEMPTS = 5;
const BATCH = 50;

/**
 * Record that an organisation has a submission waiting. Stores the
 * organisation and nothing about the submission. Never throws: a notice
 * must not cost the volunteer their submission.
 */
export async function queueSubmissionNotice(organizationId: string): Promise<void> {
    if (!noticeChannel()) return;
    try {
        const pending = await hasuraAdmin<{ notices: Array<{ id: string }> }>(
            `query PendingNotice($organizationId: uuid!) {
                notices(where: {
                    organization_id: { _eq: $organizationId },
                    kind: { _eq: "submission_waiting" },
                    sent_at: { _is_null: true }
                }, limit: 1) { id }
            }`,
            { organizationId },
        );
        if (pending.notices.length > 0) return;
        await hasuraAdmin(
            `mutation QueueNotice($organizationId: uuid!) {
                insert_notices_one(object: { organization_id: $organizationId, kind: "submission_waiting" }) { id }
            }`,
            { organizationId },
        );
    } catch (e) {
        reportError(e, "job", "notice-queue");
    }
}

type Pending = { organization_id: string };

async function recipients(
    organizationId: string,
): Promise<{ name: string; slug: string; emails: string[]; waiting: boolean } | null> {
    const data = await hasuraAdmin<{
        organizations: Array<{ name: string; slug: string }>;
        user_organizations: Array<{ user_id: string }>;
        submissions: Array<{ id: string }>;
    }>(
        `query NoticeRecipients($organizationId: uuid!) {
            organizations(where: { id: { _eq: $organizationId } }, limit: 1) { name slug }
            user_organizations(where: { organization_id: { _eq: $organizationId } }) { user_id }
            submissions(
                where: { organization_id: { _eq: $organizationId }, issued_at: { _is_null: true } },
                limit: 1
            ) { id }
        }`,
        { organizationId },
    );
    const org = data.organizations[0];
    if (!org) return null;
    const users = await getUsersByIds(data.user_organizations.map((m) => m.user_id));
    return { ...org, emails: users.map((u) => u.email).filter(Boolean), waiting: data.submissions.length > 0 };
}

async function recentlyNotified(organizationId: string, now: Date): Promise<boolean> {
    const since = new Date(now.getTime() - NOTICE_QUIET_HOURS * 3600_000).toISOString();
    const data = await hasuraAdmin<{ notices: Array<{ id: string }> }>(
        `query RecentNotice($organizationId: uuid!, $since: timestamptz!) {
            notices(where: {
                organization_id: { _eq: $organizationId },
                kind: { _eq: "submission_waiting" },
                sent_at: { _gte: $since }
            }, limit: 1) { id }
        }`,
        { organizationId, since },
    );
    return data.notices.length > 0;
}

/**
 * Send what is queued. Safe to call often and from several places: after a
 * submission, on a schedule, or when an admin touches the API. Never throws.
 * Returns how many organisations were notified.
 */
export async function dispatchNotices(now: Date = new Date()): Promise<number> {
    const channel = noticeChannel();
    if (!channel) return 0;
    let sent = 0;
    try {
        const origin = appOrigin();
        const data = await hasuraAdmin<{ notices: Pending[] }>(
            `query UnsentNotices($maxAttempts: Int!, $limit: Int!) {
                notices(
                    where: { sent_at: { _is_null: true }, attempts: { _lt: $maxAttempts }, kind: { _eq: "submission_waiting" } },
                    order_by: { created_at: asc },
                    limit: $limit
                ) { organization_id }
            }`,
            { maxAttempts: MAX_ATTEMPTS, limit: BATCH },
        );
        const orgIds = [...new Set(data.notices.map((n) => n.organization_id))];
        for (const organizationId of orgIds) {
            try {
                if (await recentlyNotified(organizationId, now)) continue;
                const org = await recipients(organizationId);
                // The queue may have been cleared since the notice was queued.
                if (org && org.waiting && org.emails.length > 0) {
                    await channel.send({
                        to: org.emails,
                        subject: `Forespørsler om attest venter hos ${org.name}`,
                        text:
                            `Det ligger forespørsler om attest og venter hos ${org.name} på attester.no.\n\n`
                            + `Logg inn for å behandle dem:\n${origin}/login/adminpage/${encodeURIComponent(org.slug)}\n`,
                    });
                    sent++;
                }
                await hasuraAdmin(
                    `mutation MarkNoticesSent($organizationId: uuid!, $now: timestamptz!) {
                        delete_notices(where: { organization_id: { _eq: $organizationId }, sent_at: { _is_null: false } }) { affected_rows }
                        update_notices(
                            where: { organization_id: { _eq: $organizationId }, sent_at: { _is_null: true } },
                            _set: { sent_at: $now }
                        ) { affected_rows }
                    }`,
                    { organizationId, now: now.toISOString() },
                );
            } catch (e) {
                reportError(e, "job", "notice-send");
                await hasuraAdmin(
                    `mutation NoticeAttempt($organizationId: uuid!) {
                        update_notices(
                            where: { organization_id: { _eq: $organizationId }, sent_at: { _is_null: true } },
                            _inc: { attempts: 1 }
                        ) { affected_rows }
                    }`,
                    { organizationId },
                ).catch(() => undefined);
            }
        }
    } catch (e) {
        reportError(e, "job", "notices");
    }
    return sent;
}

import { hasuraAdmin } from "./hasura";
import { retentionCutoffIso } from "@attester/shared/retention";

/**
 * Delete every ISSUED submission whose regeneration window has elapsed,
 * across all orgs. Runs lazily whenever the submissions API is touched — no
 * scheduler exists on the edge runtime, and none is needed here: the window
 * only starts when an admin issues a certificate, and admin activity is
 * exactly what triggers this sweep.
 *
 * Unissued submissions are NEVER swept. The `issued_at IS NOT NULL` guard is
 * load-bearing, not defensive: without it an org that reviews its queue
 * weekly would lose applications before anyone read them, and the volunteer
 * would wait for a certificate that had been silently deleted. Clearing
 * unissued rows is the admin's explicit action ("Slett data"). Do not
 * "simplify" this back to a created_at comparison.
 *
 * The same pass erases the sealed PDF and recipient of any delivery that has
 * waited past its time limit, so that limit holds even when the scheduler
 * is off or the process has been asleep.
 *
 * Deliberately org-UNscoped: this is a platform privacy guarantee, not a
 * tenant feature, and it only ever deletes. Never throws — an expired-row
 * sweep must not break the request that triggered it.
 */
export async function sweepExpiredSubmissions(): Promise<void> {
    try {
        await hasuraAdmin(
            `mutation SweepExpired($cutoff: timestamptz!, $now: timestamptz!) {
                delete_submissions(where: {
                    _and: [
                        { issued_at: { _is_null: false } },
                        { issued_at: { _lt: $cutoff } }
                    ]
                }) {
                    affected_rows
                }
                update_deliveries(
                    where: { status: { _eq: "queued" }, expires_at: { _lt: $now } },
                    _set: { status: "failed", payload: null }
                ) {
                    affected_rows
                }
            }`,
            { cutoff: retentionCutoffIso(), now: new Date().toISOString() },
        );
    } catch (e) {
        console.error("Retention sweep failed:", (e as Error).message);
    }
}

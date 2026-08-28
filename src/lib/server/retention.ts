import { hasuraAdmin } from "@/lib/server/hasura";
import { retentionCutoffIso } from "@/util/retention";

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
 * Deliberately org-UNscoped: this is a platform privacy guarantee, not a
 * tenant feature, and it only ever deletes. Never throws — an expired-row
 * sweep must not break the request that triggered it.
 */
export async function sweepExpiredSubmissions(): Promise<void> {
    try {
        await hasuraAdmin(
            `mutation SweepExpired($cutoff: timestamptz!) {
                delete_submissions(where: {
                    _and: [
                        { issued_at: { _is_null: false } },
                        { issued_at: { _lt: $cutoff } }
                    ]
                }) {
                    affected_rows
                }
            }`,
            { cutoff: retentionCutoffIso() },
        );
    } catch (e) {
        console.error("Retention sweep failed:", (e as Error).message);
    }
}

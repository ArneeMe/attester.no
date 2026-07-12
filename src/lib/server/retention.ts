import { hasuraAdmin } from "@/lib/server/hasura";
import { retentionCutoffIso } from "@/util/retention";

/**
 * Delete every submission older than the TTL, across all orgs. Runs lazily
 * whenever the submissions API is touched — no scheduler needed on the edge
 * runtime, and if nothing ever triggers it, nothing is reading the data
 * either; the next interaction cleans up.
 *
 * Deliberately org-UNscoped: this is a platform privacy guarantee, not a
 * tenant feature, and it only ever deletes. Never throws — an expired-row
 * sweep must not break the request that triggered it.
 */
export async function sweepExpiredSubmissions(): Promise<void> {
    try {
        await hasuraAdmin(
            `mutation SweepExpired($cutoff: timestamptz!) {
                delete_submissions(where: { created_at: { _lt: $cutoff } }) {
                    affected_rows
                }
            }`,
            { cutoff: retentionCutoffIso() },
        );
    } catch (e) {
        console.error("Retention sweep failed:", (e as Error).message);
    }
}

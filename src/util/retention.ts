// Submission time-to-live. A submission that is never processed is deleted
// automatically this many hours after creation — the safety net that makes
// "volunteer data never lives long in the database" true even when no admin
// ever touches the queue. Enforced lazily by the submissions API (see
// src/lib/server/retention.ts); shown to admins on the dashboard and to
// volunteers on the confirmation screen.
//
// Isomorphic module: imported by both server routes and client components.
export const SUBMISSION_TTL_HOURS = 24;

/** ISO timestamp for "TTL ago" — rows created before this are expired. */
export function retentionCutoffIso(now: number = Date.now()): string {
    return new Date(now - SUBMISSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

/** Whole hours until a submission created at `createdAt` is deleted (min 0). */
export function hoursUntilDeletion(createdAt: Date, now: number = Date.now()): number {
    const deleteAt = createdAt.getTime() + SUBMISSION_TTL_HOURS * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((deleteAt - now) / (60 * 60 * 1000)));
}

// Post-issuance retention window.
//
// A submission is deleted this many hours after the certificate was ISSUED
// — not after it was submitted. That gives admins a regeneration window (a
// lost PDF, a misprint, a mistake spotted late) while guaranteeing the
// volunteer's personal data doesn't outlive the paperwork.
//
// Submissions that have NOT been issued are never swept: they wait for the
// admin indefinitely. An org that checks its queue weekly would otherwise
// lose applications before anyone saw them, and the volunteer would be left
// waiting for a certificate that was silently deleted (product decision,
// 2026-08). Clearing those is the admin's job — "Slett data" per submission
// or the batch button — and the volunteer can ask them to at any time.
//
// Isomorphic module: imported by both server routes and client components.
export const ISSUED_RETENTION_HOURS = 24;

/**
 * ISO timestamp for "the window ago". A submission whose `issued_at` is
 * older than this has used up its regeneration window and is due for
 * deletion. Unissued rows (`issued_at IS NULL`) never match.
 */
export function retentionCutoffIso(now: number = Date.now()): string {
    return new Date(now - ISSUED_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
}

/**
 * Whole hours until an issued submission is deleted (min 0), counted from
 * `issuedAt`. Returns null for a submission that hasn't been issued — there
 * is no deletion clock to show, by design.
 */
export function hoursUntilDeletion(
    issuedAt: Date | null,
    now: number = Date.now(),
): number | null {
    if (!issuedAt) return null;
    const deleteAt = issuedAt.getTime() + ISSUED_RETENTION_HOURS * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((deleteAt - now) / (60 * 60 * 1000)));
}

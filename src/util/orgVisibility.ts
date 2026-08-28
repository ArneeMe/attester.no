// Which organizations appear on the public discovery surfaces — the
// front-page picker and the sitemap.
//
// Test and staging orgs need to exist and stay usable end-to-end without
// advertising themselves to the world. The list below is the whole
// mechanism: edit it, commit, deploy.
//
// Deliberately a constant rather than a database column, because
// `organizations` carries identity only (see CLAUDE.md, "Do NOT re-add
// per-org columns"), and rather than an env var, because a handful of
// slugs reviewed in a diff beats config that drifts between Cloudflare and
// localhost with nothing to compare against.
//
// Unlisting hides an org from DISCOVERY only. /org/<slug> keeps working,
// the form keeps accepting submissions, and certificates keep verifying —
// otherwise you could not test with an unlisted org, which is the whole
// point. This is not an access control mechanism and must never be used as
// one: an unlisted slug is guessable, and anyone who has the link can still
// reach the org.

/**
 * Org slugs hidden from the front page and the sitemap. Lowercase, matching
 * the slug column. Empty means every org is listed.
 */
export const UNLISTED_ORG_SLUGS: readonly string[] = [
    'brodkokeri', // Arnes Brødkokeri AS — test org
    'melbod', // Arnes Melbod OY — test org
    'test', // Test Organisation
];

/** Normalize a slug list into a lookup set: trimmed, lowercased, blanks dropped. */
export function normalizeSlugs(slugs: readonly string[]): Set<string> {
    return new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean));
}

const defaultUnlisted = normalizeSlugs(UNLISTED_ORG_SLUGS);

/**
 * Drop unlisted orgs from a list destined for a public surface. Order is
 * preserved, so the caller's `order_by` still holds. Comparison is
 * case-insensitive so a stray capital in either place cannot silently
 * un-hide an org.
 *
 * `unlisted` defaults to the constant above; tests pass their own set so the
 * filtering logic stays covered no matter what the shipped list contains.
 */
export function withoutUnlisted<T extends { slug: string }>(
    orgs: T[],
    unlisted: Set<string> = defaultUnlisted,
): T[] {
    if (unlisted.size === 0) return orgs;
    return orgs.filter((org) => !unlisted.has(org.slug.trim().toLowerCase()));
}

/** Whether a given slug is hidden from the public surfaces. */
export function isUnlisted(slug: string): boolean {
    return defaultUnlisted.has(slug.trim().toLowerCase());
}

// Which organizations appear on the public front page and in the sitemap.
//
// Test and staging orgs need to exist and stay usable end-to-end without
// advertising themselves to the world. The unlisted set is an env-var
// denylist of slugs (comma-separated), mirroring PLATFORM_ADMIN_EMAILS:
// deliberately config rather than a database column, because
// `organizations` carries identity only (see CLAUDE.md, "Do NOT re-add
// per-org columns").
//
// Unlisting hides an org from DISCOVERY only. /org/<slug> keeps working,
// the form keeps accepting submissions, and certificates keep verifying —
// otherwise you could not test with an unlisted org, which is the whole
// point. This is not an access control mechanism and must never be used as
// one: an unlisted slug is guessable.

/**
 * Parse a comma-separated slug denylist into a lookup set. Entries are
 * trimmed and lowercased (slugs are lowercase by construction); blanks are
 * dropped, so `"a,,b, "` yields {a, b} and unset yields an empty set.
 */
export function parseUnlistedSlugs(raw: string | undefined | null): Set<string> {
    return new Set(
        (raw ?? "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
    );
}

/**
 * Drop unlisted orgs from a list destined for a public surface. Order is
 * preserved, so the caller's `order_by` still holds.
 */
export function withoutUnlisted<T extends { slug: string }>(
    orgs: T[],
    unlisted: Set<string>,
): T[] {
    if (unlisted.size === 0) return orgs;
    return orgs.filter((org) => !unlisted.has(org.slug.toLowerCase()));
}

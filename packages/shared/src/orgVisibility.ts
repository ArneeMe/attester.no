// Unlisting hides an org from DISCOVERY only — /org/<slug>, submissions and
// verification all keep working, which is the point: you cannot test with an
// org you cannot reach. Never treat this as access control; the slug is
// guessable and anyone with the link still gets in.

export const UNLISTED_ORG_SLUGS: readonly string[] = [
    'brodkokeri', // Arnes Brødkokeri AS — test org
    'melbod', // Arnes Melbod OY — test org
    'test', // Test Organisation
];

export function normalizeSlugs(slugs: readonly string[]): Set<string> {
    return new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean));
}

const defaultUnlisted = normalizeSlugs(UNLISTED_ORG_SLUGS);

// `unlisted` is injectable so the tests cover the filtering regardless of what
// the shipped list happens to contain.
export function withoutUnlisted<T extends { slug: string }>(
    orgs: T[],
    unlisted: Set<string> = defaultUnlisted,
): T[] {
    if (unlisted.size === 0) return orgs;
    return orgs.filter((org) => !unlisted.has(org.slug.trim().toLowerCase()));
}

export function isUnlisted(slug: string): boolean {
    return defaultUnlisted.has(slug.trim().toLowerCase());
}

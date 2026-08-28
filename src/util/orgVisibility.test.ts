import { describe, it, expect } from 'vitest';
import {
    UNLISTED_ORG_SLUGS,
    isUnlisted,
    normalizeSlugs,
    withoutUnlisted,
} from './orgVisibility';

describe('normalizeSlugs', () => {
    it('trims and lowercases so casing in the constant does not matter', () => {
        expect([...normalizeSlugs([' Test-Org ', 'DEMO'])].sort()).toEqual(['demo', 'test-org']);
    });

    it('drops blank entries', () => {
        expect([...normalizeSlugs(['a', '', '  ', 'b'])].sort()).toEqual(['a', 'b']);
    });

    it('returns an empty set for an empty list', () => {
        expect(normalizeSlugs([]).size).toBe(0);
    });
});

describe('withoutUnlisted', () => {
    const orgs = [
        { slug: 'echo', name: 'echo' },
        { slug: 'test-org', name: 'Test' },
        { slug: 'brodkokeri', name: 'Brødkokeri' },
    ];

    it('returns the same array instance when nothing is unlisted', () => {
        expect(withoutUnlisted(orgs, new Set())).toBe(orgs);
    });

    it('removes only the named slugs', () => {
        const result = withoutUnlisted(orgs, normalizeSlugs(['test-org']));
        expect(result.map((o) => o.slug)).toEqual(['echo', 'brodkokeri']);
    });

    it('preserves the incoming order so the query order_by still holds', () => {
        const result = withoutUnlisted(orgs, normalizeSlugs(['echo']));
        expect(result.map((o) => o.slug)).toEqual(['test-org', 'brodkokeri']);
    });

    it('matches case-insensitively against the org slug', () => {
        const result = withoutUnlisted(
            [{ slug: 'Test-Org', name: 'Test' }],
            normalizeSlugs(['test-org']),
        );
        expect(result).toEqual([]);
    });

    it('ignores unlisted slugs that match no org', () => {
        expect(withoutUnlisted(orgs, normalizeSlugs(['nope'])).length).toBe(3);
    });

    it('can empty the list entirely', () => {
        expect(withoutUnlisted(orgs, normalizeSlugs(orgs.map((o) => o.slug)))).toEqual([]);
    });

    it('does not mutate the input', () => {
        const input = [...orgs];
        withoutUnlisted(input, normalizeSlugs(['echo']));
        expect(input).toEqual(orgs);
    });
});

describe('the shipped UNLISTED_ORG_SLUGS constant', () => {
    it('holds only lowercase, trimmed, non-empty slugs', () => {
        // Guards the one failure mode a constant has: an entry that looks
        // right in the diff but never matches, silently leaving a test org
        // on the front page.
        for (const slug of UNLISTED_ORG_SLUGS) {
            expect(slug).toBe(slug.trim().toLowerCase());
            expect(slug.length).toBeGreaterThan(0);
        }
    });

    it('has no duplicates', () => {
        expect(new Set(UNLISTED_ORG_SLUGS).size).toBe(UNLISTED_ORG_SLUGS.length);
    });

    it('agrees with isUnlisted for every entry', () => {
        for (const slug of UNLISTED_ORG_SLUGS) {
            expect(isUnlisted(slug)).toBe(true);
        }
    });

    it('does not hide an org that is not in the list', () => {
        expect(isUnlisted('an-org-that-is-not-listed-anywhere')).toBe(false);
    });

    it('hides the three known test orgs and nothing else', () => {
        // Regression guard: if one of these is dropped from the constant by
        // accident, a test org reappears on the front page and in the sitemap.
        const orgs = [
            { slug: 'brodkokeri', name: 'Arnes Brødkokeri AS' },
            { slug: 'melbod', name: 'Arnes Melbod OY' },
            { slug: 'test', name: 'Test Organisation' },
            { slug: 'echo', name: 'echo' },
        ];
        expect(withoutUnlisted(orgs).map((o) => o.slug)).toEqual(['echo']);
    });
});

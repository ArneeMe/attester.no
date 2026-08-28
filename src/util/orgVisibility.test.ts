import { describe, it, expect } from 'vitest';
import { parseUnlistedSlugs, withoutUnlisted } from './orgVisibility';

describe('parseUnlistedSlugs', () => {
    it('returns an empty set when the variable is unset', () => {
        expect(parseUnlistedSlugs(undefined).size).toBe(0);
        expect(parseUnlistedSlugs(null).size).toBe(0);
        expect(parseUnlistedSlugs('').size).toBe(0);
    });

    it('splits on commas and trims surrounding whitespace', () => {
        const set = parseUnlistedSlugs('test-org, staging-org ,demo');
        expect([...set].sort()).toEqual(['demo', 'staging-org', 'test-org']);
    });

    it('drops blank entries from sloppy input', () => {
        expect([...parseUnlistedSlugs('a,,b, ,')].sort()).toEqual(['a', 'b']);
    });

    it('lowercases entries so casing in the env var does not matter', () => {
        expect(parseUnlistedSlugs('Test-Org').has('test-org')).toBe(true);
    });
});

describe('withoutUnlisted', () => {
    const orgs = [
        { slug: 'echo', name: 'echo' },
        { slug: 'test-org', name: 'Test' },
        { slug: 'brodkokeri', name: 'Brødkokeri' },
    ];

    it('returns the list untouched when nothing is unlisted', () => {
        expect(withoutUnlisted(orgs, new Set())).toBe(orgs);
    });

    it('removes only the named slugs', () => {
        const result = withoutUnlisted(orgs, new Set(['test-org']));
        expect(result.map((o) => o.slug)).toEqual(['echo', 'brodkokeri']);
    });

    it('preserves the incoming order so order_by still holds', () => {
        const result = withoutUnlisted(orgs, new Set(['echo']));
        expect(result.map((o) => o.slug)).toEqual(['test-org', 'brodkokeri']);
    });

    it('matches case-insensitively against the org slug', () => {
        const result = withoutUnlisted([{ slug: 'Test-Org', name: 'Test' }], new Set(['test-org']));
        expect(result).toEqual([]);
    });

    it('ignores slugs in the denylist that match no org', () => {
        expect(withoutUnlisted(orgs, new Set(['nope'])).length).toBe(3);
    });

    it('can empty the list entirely', () => {
        const all = new Set(orgs.map((o) => o.slug));
        expect(withoutUnlisted(orgs, all)).toEqual([]);
    });
});

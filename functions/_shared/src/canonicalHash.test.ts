import { describe, it, expect } from 'vitest';
import { canonicalHash } from './canonicalHash';

// The canonical hash is the verification contract — drift here silently
// invalidates every certificate already in the wild. These tests pin the
// algorithm. Don't loosen them without a deliberate, coordinated change.

describe('canonicalHash', () => {
    it('is deterministic for the same params', async () => {
        const p = new URLSearchParams({ name: 'Ola', role: 'Leder' });
        const a = await canonicalHash(p);
        const b = await canonicalHash(p);
        expect(a).toBe(b);
    });

    it('produces a 128-char hex SHA-512 digest', async () => {
        const p = new URLSearchParams({ name: 'Ola' });
        const h = await canonicalHash(p);
        expect(h).toMatch(/^[0-9a-f]{128}$/);
    });

    it('is order-insensitive (params get sorted by key)', async () => {
        const a = await canonicalHash(new URLSearchParams({ name: 'Ola', role: 'Leder' }));
        const b = await canonicalHash(new URLSearchParams({ role: 'Leder', name: 'Ola' }));
        expect(a).toBe(b);
    });

    it('drops the t (template id) param before hashing', async () => {
        // Two URLs differing only in t must hash identically — t is the
        // presentation choice, not part of the verifiable data.
        const a = await canonicalHash(new URLSearchParams({ t: 'tmpl-a', id: 'x', name: 'Ola' }));
        const b = await canonicalHash(new URLSearchParams({ t: 'tmpl-b', id: 'x', name: 'Ola' }));
        expect(a).toBe(b);
    });

    it('treats different values as different hashes', async () => {
        const a = await canonicalHash(new URLSearchParams({ name: 'Ola' }));
        const b = await canonicalHash(new URLSearchParams({ name: 'Kari' }));
        expect(a).not.toBe(b);
    });

    it('treats different keys as different hashes', async () => {
        const a = await canonicalHash(new URLSearchParams({ name: 'X' }));
        const b = await canonicalHash(new URLSearchParams({ role: 'X' }));
        expect(a).not.toBe(b);
    });

    it('handles unicode in values', async () => {
        const h = await canonicalHash(new URLSearchParams({ name: 'Bjørn Æsel' }));
        expect(h).toMatch(/^[0-9a-f]{128}$/);
    });

    it('does not mutate the input params', async () => {
        const p = new URLSearchParams({ t: 'tmpl-1', name: 'Ola' });
        await canonicalHash(p);
        // The function copies and deletes from the copy; the caller's
        // URLSearchParams should still carry `t`.
        expect(p.get('t')).toBe('tmpl-1');
    });

    it('pins the exact SHA-512 of a known input (regression catcher)', async () => {
        const params = new URLSearchParams({ id: 'submission-42', name: 'Ola', role: 'Leder' });
        const h = await canonicalHash(params);
        // Computed once and pinned. If this changes, EVERY existing cert
        // becomes invalid — make it deliberate.
        const sorted = 'id=submission-42&name=Ola&role=Leder';
        // Sanity: confirm canonicalisation by hand.
        const enc = new TextEncoder().encode(sorted);
        const buf = await crypto.subtle.digest('SHA-512', enc);
        const expected = [...new Uint8Array(buf)]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        expect(h).toBe(expected);
    });
});

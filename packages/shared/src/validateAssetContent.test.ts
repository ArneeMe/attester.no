import { describe, it, expect } from 'vitest';
import { validateAssetContent } from './validateAssetContent';

describe('validateAssetContent', () => {
    describe('signature', () => {
        it('accepts a valid signature with all fields', () => {
            const r = validateAssetContent('signature', {
                photo: 'data:image/png;base64,abc',
                role: 'Leder',
                phone: '99887766',
            });
            expect(r.ok).toBe(true);
        });

        it('accepts a signature with no photo', () => {
            const r = validateAssetContent('signature', { role: 'Leder', phone: '' });
            expect(r.ok).toBe(true);
        });

        it('rejects non-string fields', () => {
            const r = validateAssetContent('signature', { role: 42 });
            expect(r.ok).toBe(false);
        });

        it('rejects a non-data: URL photo', () => {
            const r = validateAssetContent('signature', { photo: 'http://example.com/x.png' });
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.error).toMatch(/data:image/);
        });

        it('rejects an oversize photo', () => {
            const big = 'data:image/png;base64,' + 'A'.repeat(2_000_000);
            const r = validateAssetContent('signature', { photo: big });
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.error).toMatch(/too large/);
        });
    });

    describe('logo', () => {
        it('accepts a valid logo', () => {
            expect(
                validateAssetContent('logo', { image: 'data:image/png;base64,abc' }).ok,
            ).toBe(true);
        });

        it('rejects a non-string image', () => {
            expect(validateAssetContent('logo', { image: 42 }).ok).toBe(false);
        });

        it('rejects an oversize image', () => {
            const big = 'data:image/png;base64,' + 'A'.repeat(2_000_000);
            expect(validateAssetContent('logo', { image: big }).ok).toBe(false);
        });
    });

    describe('body_text', () => {
        it('accepts a normal text block', () => {
            expect(validateAssetContent('body_text', { text: 'Hello' }).ok).toBe(true);
        });

        it('rejects non-string text', () => {
            expect(validateAssetContent('body_text', { text: 42 }).ok).toBe(false);
        });

        it('rejects text over the cap', () => {
            expect(validateAssetContent('body_text', { text: 'a'.repeat(20_000) }).ok).toBe(false);
        });
    });

    describe('lookup_list', () => {
        it('accepts a list with valid items', () => {
            const r = validateAssetContent('lookup_list', {
                items: [{ name: 'webkom', description: 'Web folk' }],
            });
            expect(r.ok).toBe(true);
        });

        it('rejects when items is not an array', () => {
            expect(validateAssetContent('lookup_list', { items: 'nope' }).ok).toBe(false);
        });

        it('rejects items without a string name', () => {
            expect(
                validateAssetContent('lookup_list', { items: [{ description: 'no name' }] }).ok,
            ).toBe(false);
        });

        it('rejects items with non-string sub-fields', () => {
            expect(
                validateAssetContent('lookup_list', {
                    items: [{ name: 'a', description: { nested: 'bad' } }],
                }).ok,
            ).toBe(false);
        });

        it('rejects too many items', () => {
            const items = Array.from({ length: 600 }, (_, i) => ({ name: String(i) }));
            expect(validateAssetContent('lookup_list', { items }).ok).toBe(false);
        });
    });

    it('rejects a non-object content', () => {
        expect(validateAssetContent('signature', null).ok).toBe(false);
        expect(validateAssetContent('signature', 'string').ok).toBe(false);
        expect(validateAssetContent('signature', [1, 2, 3]).ok).toBe(false);
    });
});

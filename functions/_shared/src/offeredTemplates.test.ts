import { describe, it, expect } from 'vitest';
import { selectOfferedTemplates, type OfferableTemplate } from './offeredTemplates';

const row = (over: Partial<OfferableTemplate>): OfferableTemplate => ({
    id: 'id',
    name: 'Attest',
    description: null,
    is_offered: false,
    ...over,
});

describe('selectOfferedTemplates', () => {
    it('returns only the offered templates', () => {
        const rows = [row({ id: 'a', is_offered: true }), row({ id: 'b' })];
        expect(selectOfferedTemplates(rows).map((t) => t.id)).toEqual(['a']);
    });

    it('hides historical revisions, which is the whole point', () => {
        const rows = [
            row({ id: 'v1', name: 'Kursbevis' }),
            row({ id: 'v2', name: 'Kursbevis' }),
            row({ id: 'v3', name: 'Kursbevis', is_offered: true }),
        ];
        expect(selectOfferedTemplates(rows).map((t) => t.id)).toEqual(['v3']);
    });

    it('returns several when an org offers several attest types', () => {
        const rows = [
            row({ id: 'a', name: 'Kursbevis', is_offered: true }),
            row({ id: 'b', name: 'Frivilligattest', is_offered: true }),
            row({ id: 'c', name: 'Gammel revisjon' }),
        ];
        expect(selectOfferedTemplates(rows).map((t) => t.id)).toEqual(['b', 'a']);
    });

    it('returns nothing when an org has no templates at all', () => {
        expect(selectOfferedTemplates([])).toEqual([]);
    });

    it('returns nothing when every template is a superseded revision', () => {
        expect(selectOfferedTemplates([row({ id: 'a' }), row({ id: 'b' })])).toEqual([]);
    });

    it('sorts by name with Norwegian collation so ae/oe/aa land after z', () => {
        const rows = [
            row({ id: 'aa', name: 'Årsattest', is_offered: true }),
            row({ id: 'bb', name: 'Kursbevis', is_offered: true }),
        ];
        expect(selectOfferedTemplates(rows).map((t) => t.name)).toEqual(['Kursbevis', 'Årsattest']);
    });

    it('normalises a missing description to null', () => {
        const rows = [row({ id: 'a', is_offered: true, description: undefined as unknown as null })];
        expect(selectOfferedTemplates(rows)[0].description).toBeNull();
    });

    it('exposes only id, name and description', () => {
        const rows = [row({ id: 'a', is_offered: true })];
        expect(Object.keys(selectOfferedTemplates(rows)[0]).sort()).toEqual(['description', 'id', 'name']);
    });
});

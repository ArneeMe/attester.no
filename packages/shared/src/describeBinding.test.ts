import { describe, expect, it } from 'vitest';
import { placeholderKeys, summarizeBinding } from './describeBinding';

describe('summarizeBinding', () => {
    it('reads an unbound field as the form field of the same name', () => {
        expect(summarizeBinding('name', undefined)).toEqual({ kind: 'form', key: 'name', asDate: false });
    });

    it('reads an unbound QR field as automatic', () => {
        expect(summarizeBinding('qr_code', undefined)).toEqual({ kind: 'automatic', system: 'qr_code' });
    });

    it('reads text without placeholders as fixed text', () => {
        expect(summarizeBinding('title', { source: 'composite', template: 'Kursbevis' }))
            .toEqual({ kind: 'fixed', text: 'Kursbevis' });
    });

    it('reads a lone placeholder as that form field, noting a date format', () => {
        expect(summarizeBinding('recipient', { source: 'composite', template: '{name}' }))
            .toEqual({ kind: 'form', key: 'name', asDate: false });
        expect(summarizeBinding('when', { source: 'composite', template: ' {date:date} ' }))
            .toEqual({ kind: 'form', key: 'date', asDate: true });
    });

    it('reads text around placeholders as mixed', () => {
        expect(summarizeBinding('line', { source: 'composite', template: 'den {date:date} i {place}' }))
            .toEqual({ kind: 'mixed', template: 'den {date:date} i {place}', keys: ['date', 'place'] });
    });

    it('counts library items from one, as people do', () => {
        expect(summarizeBinding('sig', { source: 'asset_default', kind: 'signature', position: 0, subField: 'photo' }))
            .toEqual({ kind: 'library', assetKind: 'signature', number: 1, part: 'photo' });
        expect(summarizeBinding('sig2', { source: 'asset_default', kind: 'signature', position: 1 }))
            .toEqual({ kind: 'library', assetKind: 'signature', number: 2, part: null });
    });

    it('covers the remaining sources', () => {
        expect(summarizeBinding('x', { source: 'system', system: 'today' })).toEqual({ kind: 'automatic', system: 'today' });
        expect(summarizeBinding('x', { source: 'submission', key: 'role' })).toEqual({ kind: 'form', key: 'role', asDate: false });
        expect(summarizeBinding('x', { source: 'asset', assetId: 'a', subField: 'image' }))
            .toEqual({ kind: 'library', assetKind: null, number: null, part: 'image' });
        expect(summarizeBinding('x', { source: 'lookup', assetId: 'a', byKey: 'group', subField: 'description' }))
            .toEqual({ kind: 'lookup', byKey: 'group', part: 'description' });
    });
});

describe('placeholderKeys', () => {
    it('lists each key once, without its format', () => {
        expect(placeholderKeys('{a} {b:date} {a}')).toEqual(['a', 'b']);
        expect(placeholderKeys('ingen')).toEqual([]);
    });
});

import { describe, it, expect } from 'vitest';
import type { Schema } from '@pdfme/common';
import { resolveBinding, buildPdfInput, type ResolveContext } from './resolveBinding';
import type { FieldBinding } from '@/types/fieldBindings';
import type { OrgAsset } from '@/types/orgAssets';

function makeCtx(over: Partial<ResolveContext> = {}): ResolveContext {
    return {
        submission: {},
        assets: [],
        system: {
            today: '01.01.2026',
            qr_code: 'https://attester.no/verify',
            qr_info: 'Scan',
            qr_page: 'https://attester.no',
        },
        ...over,
    };
}

function asset(over: Partial<OrgAsset>): OrgAsset {
    return {
        id: 'asset-1',
        organizationId: 'org-1',
        kind: 'signature',
        name: 'Bjørn',
        content: { photo: 'data:image/png;base64,xxx', role: 'Leder', phone: '99887766' },
        isDefault: true,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...over,
    };
}

describe('resolveBinding', () => {
    it('system → returns the matching system slot', () => {
        const b: FieldBinding = { source: 'system', system: 'today' };
        expect(resolveBinding(b, makeCtx())).toBe('01.01.2026');
    });

    it('submission → returns the matching submission key', () => {
        const b: FieldBinding = { source: 'submission', key: 'name' };
        const ctx = makeCtx({ submission: { name: 'Ola' } });
        expect(resolveBinding(b, ctx)).toBe('Ola');
    });

    it('submission → returns empty for a missing key (no throw)', () => {
        const b: FieldBinding = { source: 'submission', key: 'missing' };
        expect(resolveBinding(b, makeCtx())).toBe('');
    });

    it('composite → interpolates {key}', () => {
        const b: FieldBinding = { source: 'composite', template: 'Hei {name}' };
        const ctx = makeCtx({ submission: { name: 'Ola' } });
        expect(resolveBinding(b, ctx)).toBe('Hei Ola');
    });

    it('composite → leaves placeholders empty if the key is missing', () => {
        const b: FieldBinding = { source: 'composite', template: 'Hei {name}' };
        expect(resolveBinding(b, makeCtx())).toBe('Hei ');
    });

    it('composite + requireAll → blanks out when any key is missing', () => {
        const b: FieldBinding = {
            source: 'composite',
            template: '{name} har vært {role}',
            requireAll: ['name', 'role'],
        };
        const ctx = makeCtx({ submission: { name: 'Ola' } }); // role missing
        expect(resolveBinding(b, ctx)).toBe('');
    });

    it('composite + requireAll → renders when all keys are present', () => {
        const b: FieldBinding = {
            source: 'composite',
            template: '{name} har vært {role}',
            requireAll: ['name', 'role'],
        };
        const ctx = makeCtx({ submission: { name: 'Ola', role: 'Leder' } });
        expect(resolveBinding(b, ctx)).toBe('Ola har vært Leder');
    });

    it('composite with :date formatter applies Norwegian date format', () => {
        const b: FieldBinding = { source: 'composite', template: 'Dato: {d:date}' };
        const ctx = makeCtx({ submission: { d: '2024-03-15' } });
        // formatDate uses 'no-NO' locale, month: long, year: numeric
        // Result format: "mars 2024" (locale-dependent but consistent)
        const result = resolveBinding(b, ctx);
        expect(result).toMatch(/^Dato: \w+ 2024$/);
    });

    it('asset → returns the named subField from content', () => {
        const a = asset({ id: 'sig-1' });
        const b: FieldBinding = { source: 'asset', assetId: 'sig-1', subField: 'role' };
        expect(resolveBinding(b, makeCtx({ assets: [a] }))).toBe('Leder');
    });

    it('asset → subField "name" returns the asset row name', () => {
        const a = asset({ id: 'sig-1', name: 'Bjørn' });
        const b: FieldBinding = { source: 'asset', assetId: 'sig-1', subField: 'name' };
        expect(resolveBinding(b, makeCtx({ assets: [a] }))).toBe('Bjørn');
    });

    it('asset → empty string when assetId does not match', () => {
        const a = asset({ id: 'sig-1' });
        const b: FieldBinding = { source: 'asset', assetId: 'missing', subField: 'role' };
        expect(resolveBinding(b, makeCtx({ assets: [a] }))).toBe('');
    });

    it('asset_default → picks the Nth default asset of a kind', () => {
        const a1 = asset({ id: 's1', kind: 'signature', name: 'First', isDefault: true, sortOrder: 0 });
        const a2 = asset({ id: 's2', kind: 'signature', name: 'Second', isDefault: true, sortOrder: 1 });
        const b: FieldBinding = { source: 'asset_default', kind: 'signature', position: 1, subField: 'name' };
        expect(resolveBinding(b, makeCtx({ assets: [a1, a2] }))).toBe('Second');
    });

    it('asset_default → respects sort_order for ordering', () => {
        const a1 = asset({ id: 's1', kind: 'signature', name: 'B', isDefault: true, sortOrder: 5 });
        const a2 = asset({ id: 's2', kind: 'signature', name: 'A', isDefault: true, sortOrder: 0 });
        const b: FieldBinding = { source: 'asset_default', kind: 'signature', position: 0, subField: 'name' };
        // sort_order 0 < 5, so 'A' is picked
        expect(resolveBinding(b, makeCtx({ assets: [a1, a2] }))).toBe('A');
    });

    it('asset_default → ignores non-default assets', () => {
        const a1 = asset({ id: 's1', kind: 'signature', name: 'NotDefault', isDefault: false });
        const a2 = asset({ id: 's2', kind: 'signature', name: 'YesDefault', isDefault: true });
        const b: FieldBinding = { source: 'asset_default', kind: 'signature', position: 0, subField: 'name' };
        expect(resolveBinding(b, makeCtx({ assets: [a1, a2] }))).toBe('YesDefault');
    });

    it('asset_default → empty when no matching default exists', () => {
        const b: FieldBinding = { source: 'asset_default', kind: 'signature', position: 0 };
        expect(resolveBinding(b, makeCtx())).toBe('');
    });

    it('lookup → finds item by name match, returns subField', () => {
        const list = asset({
            id: 'list-1',
            kind: 'lookup_list',
            name: 'Undergrupper',
            content: {
                items: [
                    { name: 'webkom', description: 'Web-folka' },
                    { name: 'bedkom', description: 'Bedrift' },
                ],
            },
        });
        const b: FieldBinding = {
            source: 'lookup',
            assetId: 'list-1',
            byKey: 'group',
            subField: 'description',
        };
        const ctx = makeCtx({ submission: { group: 'webkom' }, assets: [list] });
        expect(resolveBinding(b, ctx)).toBe('Web-folka');
    });

    it('lookup → empty when the submission key has no matching item', () => {
        const list = asset({
            id: 'list-1',
            kind: 'lookup_list',
            content: { items: [{ name: 'webkom', description: 'X' }] },
        });
        const b: FieldBinding = {
            source: 'lookup',
            assetId: 'list-1',
            byKey: 'group',
            subField: 'description',
        };
        const ctx = makeCtx({ submission: { group: 'nonsense' }, assets: [list] });
        expect(resolveBinding(b, ctx)).toBe('');
    });

    it('lookup → empty when the referenced asset is not a lookup_list', () => {
        const sig = asset({ id: 'sig-1', kind: 'signature' });
        const b: FieldBinding = {
            source: 'lookup',
            assetId: 'sig-1',
            byKey: 'group',
            subField: 'description',
        };
        const ctx = makeCtx({ submission: { group: 'webkom' }, assets: [sig] });
        expect(resolveBinding(b, ctx)).toBe('');
    });

    it('unknown binding source → returns empty (defensive default)', () => {
        const b = { source: 'never-heard-of-this' } as unknown as FieldBinding;
        expect(resolveBinding(b, makeCtx())).toBe('');
    });
});

// Helper for the buildPdfInput tests: synthesise a pdfme schemas array
// from a list of (name, type) pairs. Saves boilerplate.
function schemasOf(...fields: Array<{ name: string; type?: string }>): Schema[][] {
    return [fields.map((f) => ({
        name: f.name,
        type: f.type ?? 'text',
        content: '',
        position: { x: 0, y: 0 },
        width: 0,
        height: 0,
    } as Schema))];
}

describe('buildPdfInput', () => {
    it('uses the binding when one is set', () => {
        const bindings = {
            greeting: { source: 'composite', template: 'Hei {name}' } as FieldBinding,
        };
        const ctx = makeCtx({ submission: { name: 'Ola' } });
        const out = buildPdfInput(schemasOf({ name: 'greeting' }), bindings, ctx);
        expect(out.greeting).toBe('Hei Ola');
    });

    it('falls back to submission data when no binding exists', () => {
        const ctx = makeCtx({ submission: { name: 'Ola' } });
        const out = buildPdfInput(schemasOf({ name: 'name' }), {}, ctx);
        expect(out.name).toBe('Ola');
    });

    it('omits the key when there is no binding AND no submission data', () => {
        // pdfme then uses the schema field's `content` default, which is
        // what lets static branding text actually render.
        const ctx = makeCtx({ submission: {} });
        const out = buildPdfInput(schemasOf({ name: 'brand' }), {}, ctx);
        expect('brand' in out).toBe(false);
    });

    it('includes an empty string when the binding resolves to empty', () => {
        // Bound but empty is different from "unbound": pdfme would otherwise
        // show the schema default; we want a real empty.
        const bindings = {
            optional_field: {
                source: 'composite',
                template: '{x}',
                requireAll: ['x'],
            } as FieldBinding,
        };
        const ctx = makeCtx({ submission: {} });
        const out = buildPdfInput(schemasOf({ name: 'optional_field' }), bindings, ctx);
        expect(out.optional_field).toBe('');
    });

    it('omits image fields when the value is not a data:image/ URL', () => {
        // pdfme's image plugin throws on empty/garbage input; by omitting
        // the key we let pdfme fall back to the schema default (also empty)
        // and render no image instead of crashing.
        const bindings = {
            signature_photo_1: {
                source: 'asset_default',
                kind: 'signature',
                position: 0,
                subField: 'photo',
            } as FieldBinding,
        };
        const ctx = makeCtx({ assets: [] }); // no default signature → resolver returns ''
        const out = buildPdfInput(
            schemasOf({ name: 'signature_photo_1', type: 'image' }),
            bindings,
            ctx,
        );
        expect('signature_photo_1' in out).toBe(false);
    });

    it('keeps image fields when the value IS a data:image/ URL', () => {
        const ctx = makeCtx({ submission: { logo: 'data:image/png;base64,abc' } });
        const out = buildPdfInput(schemasOf({ name: 'logo', type: 'image' }), {}, ctx);
        expect(out.logo).toBe('data:image/png;base64,abc');
    });
});

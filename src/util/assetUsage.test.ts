import { describe, it, expect } from 'vitest';
import { countTemplatesUsingAsset, templateReferencesAsset } from './assetUsage';
import type { PDFTemplate } from '@/types/templateTypes';

function tmpl(over: Partial<PDFTemplate>): PDFTemplate {
    return {
        name: 'T',
        basePdf: '',
        schemas: [[]],
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...over,
    };
}

describe('templateReferencesAsset', () => {
    it('detects direct asset binding', () => {
        const t = tmpl({
            fieldBindings: { f: { source: 'asset', assetId: 'sig-1', subField: 'photo' } },
        });
        expect(templateReferencesAsset(t, 'sig-1')).toBe(true);
        expect(templateReferencesAsset(t, 'other')).toBe(false);
    });

    it('detects lookup binding', () => {
        const t = tmpl({
            fieldBindings: {
                f: { source: 'lookup', assetId: 'list-1', byKey: 'group', subField: 'description' },
            },
        });
        expect(templateReferencesAsset(t, 'list-1')).toBe(true);
    });

    it('detects optionsFromAsset on a form_schema dropdown', () => {
        const t = tmpl({
            formSchema: [{ key: 'group', label: 'G', type: 'dropdown', optionsFromAsset: 'list-1' }],
        });
        expect(templateReferencesAsset(t, 'list-1')).toBe(true);
    });

    it('does NOT count asset_default (resolves by kind, not id)', () => {
        const t = tmpl({
            fieldBindings: {
                f: { source: 'asset_default', kind: 'signature', position: 0, subField: 'photo' },
            },
        });
        expect(templateReferencesAsset(t, 'sig-1')).toBe(false);
    });

    it('handles templates with no bindings/form_schema', () => {
        expect(templateReferencesAsset(tmpl({}), 'x')).toBe(false);
    });
});

describe('countTemplatesUsingAsset', () => {
    it('counts unique referencing templates', () => {
        const a = tmpl({
            fieldBindings: { x: { source: 'asset', assetId: 's' } },
        });
        const b = tmpl({
            formSchema: [{ key: 'g', label: 'G', type: 'dropdown', optionsFromAsset: 's' }],
        });
        const c = tmpl({ fieldBindings: {} });
        expect(countTemplatesUsingAsset('s', [a, b, c])).toBe(2);
    });
});

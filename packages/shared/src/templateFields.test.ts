import { describe, it, expect } from 'vitest';
import type { Template, Schema } from '@pdfme/common';
import { listTemplateFieldNames, deriveFormSchema } from './templateFields';

function makeSchema(...names: string[]): Template['schemas'] {
    return [names.map((n) => ({ name: n, type: 'text', content: '', position: { x: 0, y: 0 }, width: 0, height: 0 } as Schema))];
}

describe('listTemplateFieldNames', () => {
    it('lists every named field across all pages', () => {
        const s: Template['schemas'] = [
            [...makeSchema('a', 'b')[0]],
            [...makeSchema('c')[0]],
        ];
        expect(listTemplateFieldNames(s).sort()).toEqual(['a', 'b', 'c']);
    });

    it('dedupes if the same name appears multiple times', () => {
        const s = makeSchema('a', 'a', 'b');
        expect(listTemplateFieldNames(s).sort()).toEqual(['a', 'b']);
    });

    it('handles empty pages gracefully', () => {
        expect(listTemplateFieldNames([[]] as unknown as Template['schemas'])).toEqual([]);
    });
});

describe('deriveFormSchema', () => {
    it('creates a text field per pdfme placeholder', () => {
        const s = makeSchema('name', 'role');
        const fs = deriveFormSchema(s, {});
        expect(fs.map((f) => f.key).sort()).toEqual(['name', 'role']);
        expect(fs.every((f) => f.type === 'text')).toBe(true);
    });

    it('skips system field names (qr_*, today, signature_date)', () => {
        const s = makeSchema('qr_code', 'qr_info', 'qr_page', 'today', 'signature_date', 'name');
        const fs = deriveFormSchema(s, {});
        expect(fs.map((f) => f.key)).toEqual(['name']);
    });

    it('skips fields with a non-submission binding', () => {
        const s = makeSchema('greeting', 'name');
        const fs = deriveFormSchema(s, {
            greeting: { source: 'composite', template: 'Hei {name}' },
        });
        expect(fs.map((f) => f.key)).toEqual(['name']);
    });

    it('redirects submission bindings to the bound key', () => {
        // If a pdfme field "pdf_name" is bound via { source: 'submission', key: 'volunteer_name' },
        // the form_schema should expose 'volunteer_name', not 'pdf_name'.
        const s = makeSchema('pdf_name');
        const fs = deriveFormSchema(s, {
            pdf_name: { source: 'submission', key: 'volunteer_name' },
        });
        expect(fs.map((f) => f.key)).toEqual(['volunteer_name']);
    });

    it('humanises the field key into a label', () => {
        const s = makeSchema('first_name', 'role_title');
        const fs = deriveFormSchema(s, {});
        expect(fs.find((f) => f.key === 'first_name')?.label).toBe('First Name');
        expect(fs.find((f) => f.key === 'role_title')?.label).toBe('Role Title');
    });
});

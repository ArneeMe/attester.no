import { describe, it, expect } from 'vitest';
import type { Template, Schema } from '@pdfme/common';
import { validateTemplateForSave } from './validateTemplate';

function tmpl(...fields: Schema[]): Template {
    return { basePdf: '', schemas: [fields] };
}

function text(name: string, content: string): Schema {
    return {
        name,
        type: 'text',
        content,
        position: { x: 0, y: 0 },
        width: 50,
        height: 10,
        rotate: 0,
    } as Schema;
}

function qrCode(name = 'qr_code'): Schema {
    return {
        name,
        type: 'qrcode',
        content: '',
        position: { x: 0, y: 0 },
        width: 30,
        height: 30,
        rotate: 0,
    } as Schema;
}

describe('validateTemplateForSave', () => {
    it('accepts a template with both QR and attester.no fingerprint', () => {
        const t = tmpl(qrCode(), text('brand', 'attester.no'));
        expect(validateTemplateForSave(t)).toEqual([]);
    });

    it('rejects when QR is missing', () => {
        const t = tmpl(text('brand', 'attester.no'));
        const errs = validateTemplateForSave(t);
        expect(errs.length).toBeGreaterThan(0);
        expect(errs[0]).toMatch(/QR/);
    });

    it('rejects when attester.no fingerprint is missing', () => {
        const t = tmpl(qrCode(), text('intro', 'Hei og hå'));
        const errs = validateTemplateForSave(t);
        expect(errs.some((e) => /attester\.no/i.test(e))).toBe(true);
    });

    it('accepts QR identified by field name even if type is text', () => {
        // Edge case: someone names their text field "qr_code". The original
        // intent of the rule is "a verifying QR exists on the PDF". The
        // current rule treats name=qr_code as sufficient too, matching how
        // bindings find it.
        const t = tmpl(text('qr_code', 'placeholder'), text('brand', 'attester.no'));
        expect(validateTemplateForSave(t)).toEqual([]);
    });

    it('finds attester.no case-insensitively', () => {
        const t = tmpl(qrCode(), text('brand', 'Issued via ATTESTER.NO'));
        expect(validateTemplateForSave(t)).toEqual([]);
    });

    it('rejects an empty schema', () => {
        const t: Template = { basePdf: '', schemas: [[]] };
        const errs = validateTemplateForSave(t);
        // Both rules fail.
        expect(errs.length).toBe(2);
    });
});

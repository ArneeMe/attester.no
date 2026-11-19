import { describe, expect, it } from 'vitest';
import { buildPdfInput } from '@attester/shared/resolveBinding';
import { validateTemplateForSave } from '@attester/shared/validateTemplate';
import { BLANK_PDF } from '@pdfme/common';
import { STARTER_TEMPLATES } from '@/app/pdfinfo/starterTemplates';
import {
    addQr, addQuestion, addSignature, addText, addToday, items, keyFromLabel, moveBox, normalize, remove, resizeBox,
    updateField, updateQuestion, type Draft,
} from './templateDraft';

const empty: Draft = { schemas: [[]], bindings: {}, form: [] };

const render = (d: Draft, submission: Record<string, string>) =>
    buildPdfInput(d.schemas, d.bindings, { submission, assets: [], system: { today: '01.02.2026', qr_code: 'https://x', qr_info: '', qr_page: '' } });

describe('templateDraft', () => {
    it('makes a key from the label, without Norwegian letters or clashes', () => {
        expect(keyFromLabel('Kursnavn', new Set())).toBe('kursnavn');
        expect(keyFromLabel('Rolle i året', new Set())).toBe('rolle_i_aret');
        expect(keyFromLabel('Kursnavn', new Set(['kursnavn']))).toBe('kursnavn_2');
        expect(keyFromLabel('???', new Set())).toBe('svar');
    });

    it('a question becomes one field, one binding and one form entry', () => {
        const d = addQuestion(empty, { label: 'Kursnavn', type: 'text' });
        expect(d.form).toEqual([{ key: 'kursnavn', label: 'Kursnavn', type: 'text' }]);
        expect(render(d, { kursnavn: 'Førstehjelp' })).toEqual({ kursnavn: 'Førstehjelp' });
        expect(items(d)).toMatchObject([{ kind: 'question', field: { label: 'Kursnavn' } }]);
    });

    it('a date question is printed as a date', () => {
        const d = addQuestion(empty, { label: 'Fullført', type: 'date' });
        expect(render(d, { fullfort: '2025-06-01' }).fullfort).not.toBe('2025-06-01');
    });

    it('a dropdown keeps its options', () => {
        const d = addQuestion(empty, { label: 'Gruppe', type: 'dropdown', options: ['Webkom', 'Bedkom'] });
        expect(d.form[0].options).toEqual(['Webkom', 'Bedkom']);
    });

    it('fixed text needs no binding and no question', () => {
        const d = addText(empty, 'Kursbevis');
        expect(d.bindings).toEqual({});
        expect(d.form).toEqual([]);
        expect(items(d)).toMatchObject([{ kind: 'text', text: 'Kursbevis' }]);
        expect(d.schemas[0][0].readOnly).toBe(true);
    });

    it('signatures are numbered and grouped as one item each', () => {
        const d = addSignature(addSignature(empty));
        const sigs = items(d).filter((i) => i.kind === 'signature');
        expect(sigs.map((i) => i.kind === 'signature' && i.number)).toEqual([1, 2]);
        expect(sigs[1].names).toHaveLength(3);
    });

    it('QR code with its label passes the save check', () => {
        const d = addQr(addText(empty, 'Hei'));
        expect(validateTemplateForSave({ basePdf: BLANK_PDF, schemas: d.schemas })).toEqual([]);
        expect(render(d, {}).qr_code).toBe('https://x');
    });

    it('today is filled in automatically', () => {
        expect(render(addToday(empty), {}).dato).toBe('01.02.2026');
    });

    it('removing a field drops its binding and its question', () => {
        const d = addQuestion(addSignature(empty), { label: 'Navn', type: 'text' });
        const sig = items(d).find((i) => i.kind === 'signature')!;
        const q = items(d).find((i) => i.kind === 'question')!;
        const after = remove(remove(d, sig.names), q.names);
        expect(after).toEqual({ schemas: [[]], bindings: {}, form: [] });
    });

    it('renaming a question keeps its key', () => {
        const d = updateQuestion(addQuestion(empty, { label: 'Navn', type: 'text' }), 'navn', { label: 'Fullt navn', key: 'x' });
        expect(d.form[0]).toEqual({ key: 'navn', label: 'Fullt navn', type: 'text' });
    });

    it('changing a question to a date prints it as a date', () => {
        const d = updateQuestion(addQuestion(empty, { label: 'Når', type: 'text' }), 'nar', { type: 'date' });
        expect(d.bindings.nar).toEqual({ source: 'composite', template: '{nar:date}' });
    });

    it('starter templates load without losing what they print', () => {
        for (const s of STARTER_TEMPLATES) {
            const before = { schemas: s.template.schemas, bindings: s.fieldBindings, form: s.formSchema };
            const after = normalize(before);
            const data = { name: 'Kari', course: 'Kurs', date: '2025-06-01', event: 'Fest', role: 'Leder', group: 'Webkom' };
            const fixed = Object.fromEntries(
                after.schemas.flat().filter((f) => f.readOnly).map((f) => [f.name, f.content]),
            );
            expect({ ...fixed, ...render(after, data) }).toMatchObject(render(before, data));
            const others = items(after).flatMap((i) => (i.kind === 'other' ? [i.summary?.kind] : []));
            expect(others.filter((k) => k !== 'mixed')).toEqual([]);
        }
    });
});

describe('boxes on the page', () => {
    const page = { width: 210, height: 297 };

    it('moving keeps the box on the page and snaps to half millimetres', () => {
        expect(moveBox({ x: 10, y: 10, width: 50, height: 10 }, 3.3, -20, page)).toEqual({ x: 13.5, y: 0, width: 50, height: 10 });
        expect(moveBox({ x: 150, y: 280, width: 50, height: 10 }, 100, 100, page)).toEqual({ x: 160, y: 287, width: 50, height: 10 });
    });

    it('resizing keeps a minimum size and stays inside the page', () => {
        expect(resizeBox({ x: 10, y: 10, width: 50, height: 10 }, -100, -100, page)).toEqual({ x: 10, y: 10, width: 4, height: 4 });
        expect(resizeBox({ x: 200, y: 10, width: 5, height: 10 }, 50, 0, page)).toEqual({ x: 200, y: 10, width: 10, height: 10 });
    });

    it('updating a field changes only that field', () => {
        const d = updateField(addText(addText(empty, 'A'), 'B'), 'tekst', { content: 'C' });
        expect(d.schemas[0].map((f) => f.content)).toEqual(['C', 'B']);
    });
});

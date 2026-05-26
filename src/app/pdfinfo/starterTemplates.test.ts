import { describe, it, expect } from 'vitest';
import { STARTER_TEMPLATES } from './starterTemplates';
import { validateTemplateForSave } from '@/util/validateTemplate';
import { listTemplateFieldNames } from '@/util/templateFields';

describe('starter templates', () => {
    it.each(STARTER_TEMPLATES)('$name has all the required pieces', (s) => {
        expect(s.id).toBeTruthy();
        expect(s.name).toBeTruthy();
        expect(s.description).toBeTruthy();
        expect(s.template.schemas.length).toBeGreaterThan(0);
        expect(s.formSchema.length).toBeGreaterThan(0);
    });

    it.each(STARTER_TEMPLATES)('$name passes the QR + attester.no save guard', (s) => {
        const errs = validateTemplateForSave(s.template);
        expect(errs).toEqual([]);
    });

    it.each(STARTER_TEMPLATES)('$name binds every non-trivial pdfme field', (s) => {
        const fieldNames = listTemplateFieldNames(s.template.schemas);
        const unboundButNeeded = fieldNames.filter((name) => {
            // It's fine if a field is unbound but matches a form_schema key
            // (implicit fallback) or is the static brand mark.
            if (s.fieldBindings[name]) return false;
            if (s.formSchema.some((f) => f.key === name)) return false;
            if (name === 'brand') return false;
            return true;
        });
        expect(unboundButNeeded, `Unbound fields in ${s.name}: ${unboundButNeeded.join(', ')}`).toEqual([]);
    });

    it('every starter has a unique id', () => {
        const ids = STARTER_TEMPLATES.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

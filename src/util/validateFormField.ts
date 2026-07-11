import type { FormFieldSchema } from '@/types/formSchema';

/**
 * Client-side validation for one volunteer-form field.
 * Returns a Norwegian error message, or null when the value is acceptable.
 * Kept out of SchemaForm.tsx so it stays a pure, unit-testable module.
 */
export function validateField(field: FormFieldSchema, value: string): string | null {
    const v = value.trim();
    if (!v) {
        return field.optional ? null : 'Må fylles ut';
    }
    switch (field.type) {
        case 'date':
            // <input type=date> gives yyyy-mm-dd, but pasted/prefilled data
            // can be anything — reject what Date can't parse.
            if (Number.isNaN(Date.parse(v))) return 'Ugyldig dato';
            return null;
        case 'number':
            if (Number.isNaN(Number(v))) return 'Må være et tall';
            return null;
        default:
            return null;
    }
}

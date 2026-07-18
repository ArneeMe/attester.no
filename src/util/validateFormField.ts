import type { FormFieldSchema } from '@/types/formSchema';

export type ValidationMessages = {
    required: string;
    invalidDate: string;
    invalidNumber: string;
};

// Norwegian defaults keep every existing call site working; localized
// callers pass the messages from src/strings.ts instead.
const DEFAULT_MESSAGES: ValidationMessages = {
    required: 'Må fylles ut',
    invalidDate: 'Ugyldig dato',
    invalidNumber: 'Må være et tall',
};

/**
 * Client-side validation for one volunteer-form field.
 * Returns an error message, or null when the value is acceptable.
 * Kept out of SchemaForm.tsx so it stays a pure, unit-testable module.
 */
export function validateField(
    field: FormFieldSchema,
    value: string,
    messages: ValidationMessages = DEFAULT_MESSAGES,
): string | null {
    const v = value.trim();
    if (!v) {
        return field.optional ? null : messages.required;
    }
    switch (field.type) {
        case 'date':
            // <input type=date> gives yyyy-mm-dd, but pasted/prefilled data
            // can be anything — reject what Date can't parse.
            if (Number.isNaN(Date.parse(v))) return messages.invalidDate;
            return null;
        case 'number':
            if (Number.isNaN(Number(v))) return messages.invalidNumber;
            return null;
        default:
            return null;
    }
}

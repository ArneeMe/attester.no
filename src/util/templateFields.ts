import type { Template } from '@pdfme/common';
import type { FormSchema, FormFieldSchema } from '@/types/formSchema';
import type { FieldBindings } from '@/types/fieldBindings';

/**
 * Extract every unique field name from a pdfme template's schemas. The schemas
 * are a 2D array (pages × field-array); each entry has a `name`.
 */
export function listTemplateFieldNames(schemas: Template['schemas']): string[] {
    const names = new Set<string>();
    for (const page of schemas ?? []) {
        for (const field of page ?? []) {
            if (field && typeof field.name === 'string') {
                names.add(field.name);
            }
        }
    }
    return [...names];
}

const SYSTEM_NAMES = new Set(['qr_code', 'qr_info', 'qr_page', 'today', 'signature_date']);

/**
 * If a template has no form_schema (e.g. just created in the designer), derive
 * a sensible default: every pdfme field name that is NOT bound to a non-submission
 * source becomes a form field. Defaults to type 'text'. The admin can then
 * customise labels and types.
 */
export function deriveFormSchema(
    schemas: Template['schemas'],
    bindings: FieldBindings,
): FormSchema {
    const fields: FormFieldSchema[] = [];
    const seen = new Set<string>();
    for (const name of listTemplateFieldNames(schemas)) {
        if (seen.has(name)) continue;
        if (SYSTEM_NAMES.has(name)) continue;
        const b = bindings[name];
        if (b && b.source !== 'submission') continue;
        const key = b?.source === 'submission' ? b.key : name;
        if (seen.has(key)) continue;
        seen.add(key);
        fields.push({ key, label: humanLabel(key), type: 'text' });
    }
    return fields;
}

function humanLabel(key: string): string {
    return key
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}

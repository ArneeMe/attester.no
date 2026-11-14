import type { FieldBinding } from './types/fieldBindings';

// What a PDF field holds, in the terms an admin thinks in. The stored
// bindings have seven technical sources; these are the five things they
// amount to. Used to show one plain line per field in the template editor.
export type BindingSummary =
    | { kind: 'fixed'; text: string }
    | { kind: 'form'; key: string; asDate: boolean }
    | { kind: 'mixed'; template: string; keys: string[] }
    | { kind: 'automatic'; system: 'qr_code' | 'qr_info' | 'qr_page' | 'today' }
    | { kind: 'library'; assetKind: 'signature' | 'logo' | 'body_text' | null; number: number | null; part: string | null }
    | { kind: 'lookup'; byKey: string; part: string };

const SYSTEM_NAMES = new Set(['qr_code', 'qr_info', 'qr_page', 'today']);
const PLACEHOLDER = /\{([^{}:]+)(?::([^{}]+))?\}/g;

export function placeholderKeys(template: string): string[] {
    return [...new Set([...template.matchAll(PLACEHOLDER)].map((m) => m[1].trim()))];
}

export function summarizeBinding(fieldName: string, binding: FieldBinding | undefined): BindingSummary {
    if (!binding) {
        return SYSTEM_NAMES.has(fieldName)
            ? { kind: 'automatic', system: fieldName as 'qr_code' }
            : { kind: 'form', key: fieldName, asDate: false };
    }
    switch (binding.source) {
        case 'system':
            return { kind: 'automatic', system: binding.system };
        case 'submission':
            return { kind: 'form', key: binding.key, asDate: false };
        case 'composite': {
            const keys = placeholderKeys(binding.template);
            if (keys.length === 0) return { kind: 'fixed', text: binding.template };
            const whole = /^\{([^{}:]+)(?::([^{}]+))?\}$/.exec(binding.template.trim());
            if (whole) return { kind: 'form', key: whole[1].trim(), asDate: whole[2]?.trim() === 'date' };
            return { kind: 'mixed', template: binding.template, keys };
        }
        case 'asset':
            return { kind: 'library', assetKind: null, number: null, part: binding.subField ?? null };
        case 'asset_default':
            return {
                kind: 'library',
                assetKind: binding.kind,
                number: (binding.position ?? 0) + 1,
                part: binding.subField ?? null,
            };
        case 'lookup':
            return { kind: 'lookup', byKey: binding.byKey, part: binding.subField };
    }
}

import type { Template, Schema } from '@pdfme/common';
import type { FieldBindings } from '@/types/fieldBindings';

/**
 * Quick-add presets for the designer toolbar. Each one returns the
 * pdfme schema fields to drop in plus the field_bindings patches that
 * wire them up. The whole point: leverage what admins have already
 * uploaded — the default signature, default logo, default body-text —
 * so dropping a signature field doesn't need a follow-up trip to the
 * bindings editor.
 *
 * Position cascades on repeated clicks: a second "+ Signatur" places
 * itself next to the first instead of stacking on top.
 */

export type QuickAddResult = {
    fields: Schema[];
    bindings: FieldBindings;
};

export function quickAddQrCode(schemas: Template['schemas']): QuickAddResult {
    const n = countByPrefix(schemas, 'qr_code');
    const name = n === 0 ? 'qr_code' : `qr_code_${n + 1}`;
    return {
        fields: [{
            name,
            type: 'qrcode',
            content: 'https://attester.no',
            position: { x: 160 - n * 4, y: 220 },
            width: 28,
            height: 28,
            rotate: 0,
        } as Schema],
        bindings: { [name]: { source: 'system', system: 'qr_code' } },
    };
}

export function quickAddSignature(schemas: Template['schemas']): QuickAddResult {
    const n = countByPrefix(schemas, 'signature_photo');
    const baseX = 25 + n * 70;
    const photoName = `signature_photo_${n + 1}`;
    const labelName = `signature_name_${n + 1}`;
    const roleName = `signature_role_${n + 1}`;
    return {
        fields: [
            {
                name: photoName,
                type: 'image',
                content: '',
                position: { x: baseX, y: 215 },
                width: 50,
                height: 22,
                rotate: 0,
            } as Schema,
            txt(labelName, '', { x: baseX, y: 240 }, 70, 5, { fontSize: 10 }),
            txt(roleName, '', { x: baseX, y: 246 }, 70, 4, { fontSize: 8 }),
        ],
        bindings: {
            [photoName]: { source: 'asset_default', kind: 'signature', position: n, subField: 'photo' },
            [labelName]: { source: 'asset_default', kind: 'signature', position: n, subField: 'name' },
            [roleName]:  { source: 'asset_default', kind: 'signature', position: n, subField: 'role' },
        },
    };
}

export function quickAddLogo(schemas: Template['schemas']): QuickAddResult {
    const n = countByPrefix(schemas, 'logo');
    const name = n === 0 ? 'logo' : `logo_${n + 1}`;
    return {
        fields: [{
            name,
            type: 'image',
            content: '',
            position: { x: 160 - n * 35, y: 15 },
            width: 30,
            height: 15,
            rotate: 0,
        } as Schema],
        bindings: {
            [name]: { source: 'asset_default', kind: 'logo', position: n, subField: 'image' },
        },
    };
}

export function quickAddBodyText(schemas: Template['schemas']): QuickAddResult {
    const n = countByPrefix(schemas, 'body_text');
    const name = n === 0 ? 'body_text' : `body_text_${n + 1}`;
    return {
        fields: [txt(name, '', { x: 20, y: 140 + n * 50 }, 170, 40, { fontSize: 11, lineHeight: 1.4 })],
        bindings: {
            [name]: { source: 'asset_default', kind: 'body_text', position: n, subField: 'text' },
        },
    };
}

export function quickAddBrand(schemas: Template['schemas']): QuickAddResult {
    // Idempotent: if a brand field already exists, return nothing.
    if (countByPrefix(schemas, 'brand') > 0) {
        return { fields: [], bindings: {} };
    }
    return {
        fields: [txt('brand', 'attester.no', { x: 20, y: 282 }, 170, 6, { fontSize: 9, alignment: 'center' })],
        bindings: {},
    };
}

function countByPrefix(schemas: Template['schemas'], prefix: string): number {
    const names = new Set<string>();
    for (const page of schemas ?? []) {
        for (const field of page ?? []) {
            const name = field?.name;
            if (typeof name !== 'string') continue;
            if (name === prefix || name.startsWith(prefix + '_')) names.add(name);
        }
    }
    return names.size;
}

function txt(
    name: string,
    content: string,
    position: { x: number; y: number },
    width: number,
    height: number,
    extra: Partial<Schema> = {},
): Schema {
    return {
        name,
        type: 'text',
        content,
        position,
        width,
        height,
        rotate: 0,
        alignment: 'left',
        verticalAlignment: 'top',
        fontSize: 12,
        lineHeight: 1.3,
        characterSpacing: 0,
        ...extra,
    } as Schema;
}

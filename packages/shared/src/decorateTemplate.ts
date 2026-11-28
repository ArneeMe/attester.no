import type { Template, Schema } from '@pdfme/common';

const VERIFY_LABEL = 'Verifiser på attester.no';

/**
 * Apply mandatory transforms to a pdfme template right before generate().
 *
 * 1. Strip `required: true` from every field. pdfme errors when a required
 *    field has no truthy input — empty string counts as missing — which
 *    crashes legacy templates that lack bindings for all their fields. We
 *    already validate templates at our level (QR + attester.no fingerprint),
 *    so missing data should render empty, not blow up generation.
 * 2. Inject a small "Verifiser på attester.no" label immediately below
 *    every qrcode field, as platform branding + a hint to the recipient
 *    of the printed cert. Done system-side so admins can't accidentally
 *    remove or restyle it via the designer.
 */
export function decorateTemplateForGenerate(template: Template): Template {
    const schemas = (template.schemas ?? []).map((page) => {
        const next: Schema[] = [];
        for (const field of page ?? []) {
            next.push({ ...field, required: false } as Schema);
            const label = makeVerifyLabel(field);
            if (label) next.push(label);
        }
        return next;
    });
    return { ...template, schemas };
}

function makeVerifyLabel(field: Schema): Schema | null {
    if (field?.type !== 'qrcode') return null;
    const pos = field.position;
    const w = field.width;
    const h = field.height;
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return null;
    if (typeof w !== 'number' || typeof h !== 'number') return null;
    // Mirror the field shape used by working text schemas in the seed +
    // starter templates (notably the 'brand' field). Earlier this label
    // omitted backgroundColor/opacity and used a 4mm-tall row, which made
    // pdfme skip or clip the render.
    return {
        name: `__verify_label__${field.name ?? 'qr'}`,
        type: 'text',
        content: VERIFY_LABEL,
        position: { x: pos.x, y: pos.y + h + 1 },
        width: w,
        height: 6,
        rotate: 0,
        alignment: 'center',
        verticalAlignment: 'top',
        fontSize: 8,
        lineHeight: 1.3,
        characterSpacing: 0,
        fontColor: '#555555',
        backgroundColor: '',
        opacity: 1,
        required: false,
    } as Schema;
}

import type { Template, Schema } from '@pdfme/common';

const BG_FIELD_NAME = '__background__';

/**
 * Background presets the admin can pick from in the designer. Each one
 * is a fill color applied to a full-page rectangle inserted at the
 * bottom of the schema stack (so subsequent fields render on top).
 *
 * Backgrounds live as a regular pdfme `rectangle` schema field rather
 * than a custom basePdf — that way they're editable, swappable, and
 * removable without re-uploading a PDF, and they survive a template
 * save/load round-trip via the same schemas jsonb column.
 */
export type Background = {
    id: string;
    name: string;
    color: string;
};

export const BACKGROUNDS: Background[] = [
    { id: 'white',     name: 'Hvit',         color: '#ffffff' },
    { id: 'cream',     name: 'Krem',         color: '#fbf7ee' },
    { id: 'mint',      name: 'Mynte',        color: '#eaf5ee' },
    { id: 'blue',      name: 'Lyseblå',      color: '#eaf2fb' },
    { id: 'blush',     name: 'Rosa',         color: '#fbecec' },
    { id: 'lavender',  name: 'Lavendel',     color: '#f1ecfb' },
    { id: 'sand',      name: 'Sand',         color: '#f5efe1' },
    { id: 'graphite',  name: 'Grafitt',      color: '#1f2937' },
];

function makeBackgroundField(color: string): Schema {
    return {
        name: BG_FIELD_NAME,
        type: 'rectangle',
        position: { x: 0, y: 0 },
        width: 210,
        height: 297,
        color,
        borderColor: '',
        borderWidth: 0,
        rotate: 0,
        readOnly: true,
    } as Schema;
}

/**
 * Replace (or insert) the background rectangle on page 0 of the template.
 * The background field always sits at index 0 so other fields render
 * above it. Idempotent: re-applying with the same color is a no-op.
 */
export function applyBackground(template: Template, color: string | null): Template {
    const pages = template.schemas ?? [[]];
    const firstPage = pages[0] ?? [];

    const withoutBg = firstPage.filter((f) => f?.name !== BG_FIELD_NAME);

    const nextFirst: Schema[] = color
        ? [makeBackgroundField(color), ...withoutBg]
        : withoutBg;

    const nextSchemas = [nextFirst, ...pages.slice(1)];
    return { ...template, schemas: nextSchemas };
}

/**
 * Read the current background color from the template's schemas, or
 * null if no background field is set.
 */
export function readBackgroundColor(template: Template): string | null {
    const firstPage = template.schemas?.[0] ?? [];
    const bg = firstPage.find((f) => f?.name === BG_FIELD_NAME);
    if (!bg) return null;
    const color = (bg as { color?: unknown }).color;
    return typeof color === 'string' ? color : null;
}

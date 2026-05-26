import type { Template, Schema } from '@pdfme/common';
import { BLANK_PDF } from '@pdfme/common';
import type { FieldBindings } from '@/types/fieldBindings';
import type { FormSchema } from '@/types/formSchema';

/**
 * Pre-built templates an admin can clone as a starting point. Each carries a
 * complete pdfme schema, field bindings, and a form_schema — the admin opens
 * the designer with all three pre-populated and customises from there.
 *
 * Coordinates are in mm (A4 portrait: 210 × 297). Keep layouts conservative;
 * admins are expected to drag things around to taste.
 */
export type StarterTemplate = {
    id: string;
    name: string;
    description: string;
    template: Template;
    fieldBindings: FieldBindings;
    formSchema: FormSchema;
};

const BLANK_A4 = BLANK_PDF;

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

const COURSE_COMPLETION: StarterTemplate = {
    id: 'course-completion',
    name: 'Kursbevis',
    description: 'Attest for fullført kurs. Mottakerens navn, kursnavn, dato, og en signatur.',
    template: {
        basePdf: BLANK_A4,
        schemas: [[
            txt('title', 'Kursbevis', { x: 20, y: 30 }, 170, 16, { fontSize: 32, alignment: 'center' }),
            txt('subtitle', 'Tildelt', { x: 20, y: 70 }, 170, 8, { fontSize: 14, alignment: 'center' }),
            txt('recipient', '{name}', { x: 20, y: 85 }, 170, 14, { fontSize: 24, alignment: 'center' }),
            txt('body', 'for fullført', { x: 20, y: 115 }, 170, 8, { fontSize: 14, alignment: 'center' }),
            txt('course_name', '{course}', { x: 20, y: 130 }, 170, 12, { fontSize: 18, alignment: 'center' }),
            txt('completion_date', 'den {date:date}', { x: 20, y: 155 }, 170, 8, { fontSize: 12, alignment: 'center' }),
            {
                name: 'signature_photo',
                type: 'image',
                content: '',
                position: { x: 25, y: 215 },
                width: 50,
                height: 25,
                rotate: 0,
            } as Schema,
            txt('signature_name', 'Signatur', { x: 25, y: 245 }, 70, 6, { fontSize: 11 }),
            txt('signature_role', '', { x: 25, y: 252 }, 70, 5, { fontSize: 9 }),
            {
                name: 'qr_code',
                type: 'qrcode',
                content: 'https://attester.no',
                position: { x: 155, y: 220 },
                width: 32,
                height: 32,
                rotate: 0,
            } as Schema,
            txt('qr_label', 'Verifiser på attester.no', { x: 151, y: 253 }, 40, 6, { fontSize: 7, alignment: 'center' }),
            txt('brand', 'attester.no', { x: 20, y: 275 }, 170, 6, { fontSize: 9, alignment: 'center' }),
        ]],
    },
    fieldBindings: {
        title: { source: 'composite', template: 'Kursbevis' },
        subtitle: { source: 'composite', template: 'Tildelt' },
        body: { source: 'composite', template: 'for fullført' },
        recipient: { source: 'composite', template: '{name}' },
        course_name: { source: 'composite', template: '{course}' },
        completion_date: { source: 'composite', template: 'den {date:date}', requireAll: ['date'] },
        signature_photo: { source: 'asset_default', kind: 'signature', position: 0, subField: 'photo' },
        signature_name: { source: 'asset_default', kind: 'signature', position: 0, subField: 'name' },
        signature_role: { source: 'asset_default', kind: 'signature', position: 0, subField: 'role' },
        qr_code: { source: 'system', system: 'qr_code' },
        qr_label: { source: 'composite', template: 'Verifiser på attester.no' },
    },
    formSchema: [
        { key: 'name', label: 'Mottakers navn', type: 'text' },
        { key: 'course', label: 'Kursnavn', type: 'text' },
        { key: 'date', label: 'Fullført dato', type: 'date' },
    ],
};

const EVENT_ATTENDANCE: StarterTemplate = {
    id: 'event-attendance',
    name: 'Deltakerbevis',
    description: 'Attest for deltakelse på et arrangement. Navn, arrangement, dato.',
    template: {
        basePdf: BLANK_A4,
        schemas: [[
            txt('title', 'Deltakerbevis', { x: 20, y: 30 }, 170, 16, { fontSize: 32, alignment: 'center' }),
            txt('subtitle', 'Dette bekrefter at', { x: 20, y: 75 }, 170, 8, { fontSize: 14, alignment: 'center' }),
            txt('recipient', '{name}', { x: 20, y: 90 }, 170, 14, { fontSize: 24, alignment: 'center' }),
            txt('body', 'deltok på', { x: 20, y: 125 }, 170, 8, { fontSize: 14, alignment: 'center' }),
            txt('event_name', '{event}', { x: 20, y: 140 }, 170, 12, { fontSize: 18, alignment: 'center' }),
            txt('event_date', '{date:date}', { x: 20, y: 165 }, 170, 8, { fontSize: 12, alignment: 'center' }),
            {
                name: 'signature_photo',
                type: 'image',
                content: '',
                position: { x: 25, y: 215 },
                width: 50,
                height: 25,
                rotate: 0,
            } as Schema,
            txt('signature_name', 'Signatur', { x: 25, y: 245 }, 70, 6, { fontSize: 11 }),
            {
                name: 'qr_code',
                type: 'qrcode',
                content: 'https://attester.no',
                position: { x: 155, y: 220 },
                width: 32,
                height: 32,
                rotate: 0,
            } as Schema,
            txt('qr_label', 'Verifiser på attester.no', { x: 151, y: 253 }, 40, 6, { fontSize: 7, alignment: 'center' }),
            txt('brand', 'attester.no', { x: 20, y: 275 }, 170, 6, { fontSize: 9, alignment: 'center' }),
        ]],
    },
    fieldBindings: {
        title: { source: 'composite', template: 'Deltakerbevis' },
        subtitle: { source: 'composite', template: 'Dette bekrefter at' },
        body: { source: 'composite', template: 'deltok på' },
        recipient: { source: 'composite', template: '{name}' },
        event_name: { source: 'composite', template: '{event}' },
        event_date: { source: 'composite', template: '{date:date}', requireAll: ['date'] },
        signature_photo: { source: 'asset_default', kind: 'signature', position: 0, subField: 'photo' },
        signature_name: { source: 'asset_default', kind: 'signature', position: 0, subField: 'name' },
        qr_code: { source: 'system', system: 'qr_code' },
        qr_label: { source: 'composite', template: 'Verifiser på attester.no' },
    },
    formSchema: [
        { key: 'name', label: 'Deltakers navn', type: 'text' },
        { key: 'event', label: 'Arrangement', type: 'text' },
        { key: 'date', label: 'Dato', type: 'date' },
    ],
};

const ROLE_ATTESTATION: StarterTemplate = {
    id: 'role-attestation',
    name: 'Rolleattest',
    description: 'Attest for et verv eller en rolle. Navn, rolle, tidsperiode, og to signaturer.',
    template: {
        basePdf: BLANK_A4,
        schemas: [[
            txt('title', 'Attest', { x: 20, y: 30 }, 170, 14, { fontSize: 28, alignment: 'center' }),
            txt('recipient', '{name}', { x: 20, y: 65 }, 170, 12, { fontSize: 20, alignment: 'center' }),
            txt('body', 'har hatt vervet {role} fra {start:date} til {end:date}.',
                { x: 20, y: 100 }, 170, 20,
                { fontSize: 13, alignment: 'center', lineHeight: 1.5 }),
            txt('org_text', '', { x: 20, y: 140 }, 170, 50, { fontSize: 11, lineHeight: 1.4 }),
            {
                name: 'signature_photo_1',
                type: 'image',
                content: '',
                position: { x: 25, y: 215 },
                width: 50,
                height: 22,
                rotate: 0,
            } as Schema,
            txt('signature_name_1', '', { x: 25, y: 240 }, 70, 5, { fontSize: 10 }),
            txt('signature_role_1', '', { x: 25, y: 246 }, 70, 4, { fontSize: 8 }),
            {
                name: 'signature_photo_2',
                type: 'image',
                content: '',
                position: { x: 95, y: 215 },
                width: 50,
                height: 22,
                rotate: 0,
            } as Schema,
            txt('signature_name_2', '', { x: 95, y: 240 }, 70, 5, { fontSize: 10 }),
            txt('signature_role_2', '', { x: 95, y: 246 }, 70, 4, { fontSize: 8 }),
            {
                name: 'qr_code',
                type: 'qrcode',
                content: 'https://attester.no',
                position: { x: 160, y: 220 },
                width: 28,
                height: 28,
                rotate: 0,
            } as Schema,
            txt('qr_label', 'Verifiser på attester.no', { x: 156, y: 249 }, 36, 6, { fontSize: 7, alignment: 'center' }),
            txt('brand', 'attester.no', { x: 20, y: 275 }, 170, 6, { fontSize: 9, alignment: 'center' }),
        ]],
    },
    fieldBindings: {
        title: { source: 'composite', template: 'Attest' },
        recipient: { source: 'composite', template: '{name}' },
        body: {
            source: 'composite',
            template: '{name} har hatt vervet {role} fra {start:date} til {end:date}.',
            requireAll: ['name', 'role', 'start', 'end'],
        },
        org_text: { source: 'asset_default', kind: 'body_text', subField: 'text' },
        signature_photo_1: { source: 'asset_default', kind: 'signature', position: 0, subField: 'photo' },
        signature_name_1: { source: 'asset_default', kind: 'signature', position: 0, subField: 'name' },
        signature_role_1: { source: 'asset_default', kind: 'signature', position: 0, subField: 'role' },
        signature_photo_2: { source: 'asset_default', kind: 'signature', position: 1, subField: 'photo' },
        signature_name_2: { source: 'asset_default', kind: 'signature', position: 1, subField: 'name' },
        signature_role_2: { source: 'asset_default', kind: 'signature', position: 1, subField: 'role' },
        qr_code: { source: 'system', system: 'qr_code' },
        qr_label: { source: 'composite', template: 'Verifiser på attester.no' },
    },
    formSchema: [
        { key: 'name', label: 'Navn', type: 'text' },
        { key: 'role', label: 'Rolle / verv', type: 'text' },
        { key: 'start', label: 'Startdato', type: 'date' },
        { key: 'end', label: 'Sluttdato', type: 'date' },
    ],
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
    COURSE_COMPLETION,
    EVENT_ATTENDANCE,
    ROLE_ATTESTATION,
];

import type { Schema, Template } from '@pdfme/common';
import type { FieldBinding, FieldBindings } from '@attester/shared/types/fieldBindings';
import type { FormFieldSchema, FormFieldType, FormSchema } from '@attester/shared/types/formSchema';
import { placeholderKeys, summarizeBinding, type BindingSummary } from '@attester/shared/describeBinding';

export type Draft = {
    schemas: Template['schemas'];
    bindings: FieldBindings;
    form: FormSchema;
};

export type QuestionInput = {
    label: string;
    type: FormFieldType;
    optional?: boolean;
    options?: string[];
};

export type DraftItem =
    | { kind: 'text'; names: string[]; text: string }
    | { kind: 'image'; names: string[] }
    | { kind: 'question'; names: string[]; field: FormFieldSchema }
    | { kind: 'signature'; names: string[]; number: number }
    | { kind: 'qr'; names: string[] }
    | { kind: 'today'; names: string[] }
    | { kind: 'library'; names: string[]; assetKind: 'logo' | 'body_text' }
    | { kind: 'other'; names: string[]; summary?: BindingSummary };

const QR_LABEL = 'Verifiser på attester.no';

const allFields = (schemas: Template['schemas']): Schema[] => (schemas ?? []).flatMap((page) => page ?? []);

function fieldNames(schemas: Template['schemas']): Set<string> {
    return new Set(allFields(schemas).map((f) => f.name));
}

function uniqueName(base: string, taken: Set<string>): string {
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
}

export function keyFromLabel(label: string, taken: Set<string>): string {
    const base = label
        .toLowerCase()
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'o')
        .replace(/å/g, 'a')
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    return uniqueName(base || 'svar', taken);
}

function textField(name: string, content: string, y: number, extra: Partial<Schema> = {}): Schema {
    return {
        name,
        type: 'text',
        content,
        position: { x: 20, y },
        width: 120,
        height: 8,
        rotate: 0,
        alignment: 'left',
        verticalAlignment: 'top',
        fontSize: 12,
        lineHeight: 1.3,
        characterSpacing: 0,
        ...extra,
    } as Schema;
}

function nextY(schemas: Template['schemas']): number {
    return 20 + ((allFields(schemas).length * 12) % 240);
}

function append(draft: Draft, fields: Schema[]): Template['schemas'] {
    const pages = (draft.schemas ?? [[]]).map((page) => [...(page ?? [])]);
    if (pages.length === 0) pages.push([]);
    pages[0].push(...fields);
    return pages;
}

function usedKeys(draft: Draft): Set<string> {
    const keys = new Set<string>();
    for (const f of allFields(draft.schemas)) {
        const b = draft.bindings[f.name];
        if (!b) keys.add(f.name);
        else if (b.source === 'submission') keys.add(b.key);
        else if (b.source === 'composite') placeholderKeys(b.template).forEach((k) => keys.add(k));
        else if (b.source === 'lookup') keys.add(b.byKey);
    }
    return keys;
}

export function prune(draft: Draft): Draft {
    const names = fieldNames(draft.schemas);
    const bindings = Object.fromEntries(Object.entries(draft.bindings).filter(([n]) => names.has(n)));
    const next = { ...draft, bindings };
    const keys = usedKeys(next);
    return { ...next, form: draft.form.filter((f) => keys.has(f.key)) };
}

function questionAt(form: FormSchema, key: string): FormFieldSchema | undefined {
    return form.find((f) => f.key === key);
}

export function normalize(draft: Draft): Draft {
    const bindings: FieldBindings = { ...draft.bindings };
    const schemas = (draft.schemas ?? []).map((page) =>
        (page ?? []).map((field) => {
            const b = bindings[field.name];
            if (field.type !== 'text') return field;
            if (!b) return questionAt(draft.form, field.name) ? field : { ...field, readOnly: true };
            const summary = summarizeBinding(field.name, b);
            if (summary.kind === 'fixed') {
                delete bindings[field.name];
                return { ...field, content: summary.text, readOnly: true };
            }
            if (summary.kind === 'form') {
                const q = questionAt(draft.form, summary.key);
                return { ...field, content: `[${q?.label ?? summary.key}]` };
            }
            return field;
        }),
    );
    return { ...draft, schemas, bindings };
}

export function addText(draft: Draft, text: string): Draft {
    const name = uniqueName('tekst', fieldNames(draft.schemas));
    return { ...draft, schemas: append(draft, [textField(name, text, nextY(draft.schemas), { readOnly: true })]) };
}

export function addQuestion(draft: Draft, q: QuestionInput): Draft {
    const taken = new Set([...fieldNames(draft.schemas), ...draft.form.map((f) => f.key)]);
    const key = keyFromLabel(q.label, taken);
    const binding: FieldBinding = { source: 'composite', template: q.type === 'date' ? `{${key}:date}` : `{${key}}` };
    const field: FormFieldSchema = { key, label: q.label.trim(), type: q.type };
    if (q.optional) field.optional = true;
    if (q.type === 'dropdown') field.options = q.options ?? [];
    const height = q.type === 'long_text' ? 30 : 8;
    return {
        schemas: append(draft, [textField(key, `[${field.label}]`, nextY(draft.schemas), { height })]),
        bindings: { ...draft.bindings, [key]: binding },
        form: [...draft.form, field],
    };
}

function signaturePositions(bindings: FieldBindings): number[] {
    return Object.values(bindings).flatMap((b) =>
        b.source === 'asset_default' && b.kind === 'signature' ? [b.position ?? 0] : [],
    );
}

export function addSignature(draft: Draft): Draft {
    const used = signaturePositions(draft.bindings);
    const position = used.length ? Math.max(...used) + 1 : 0;
    const n = position + 1;
    const taken = fieldNames(draft.schemas);
    const photo = uniqueName(`signatur_${n}_bilde`, taken);
    const name = uniqueName(`signatur_${n}_navn`, taken);
    const role = uniqueName(`signatur_${n}_rolle`, taken);
    const x = 20 + (position % 3) * 60;
    const fields: Schema[] = [
        { name: photo, type: 'image', content: '', position: { x, y: 215 }, width: 50, height: 25, rotate: 0 } as Schema,
        { ...textField(name, '[Navn]', 245, { width: 55, fontSize: 11 }), position: { x, y: 245 } } as Schema,
        { ...textField(role, '[Rolle]', 252, { width: 55, height: 5, fontSize: 9 }), position: { x, y: 252 } } as Schema,
    ];
    const part = (subField: string): FieldBinding => ({ source: 'asset_default', kind: 'signature', position, subField });
    return {
        ...draft,
        schemas: append(draft, fields),
        bindings: { ...draft.bindings, [photo]: part('photo'), [name]: part('name'), [role]: part('role') },
    };
}

export function hasQr(draft: Draft): boolean {
    return allFields(draft.schemas).some((f) => f.type === 'qrcode');
}

export function addQr(draft: Draft): Draft {
    const taken = fieldNames(draft.schemas);
    const qr = uniqueName('qr_code', taken);
    const label = uniqueName('qr_tekst', taken);
    const fields: Schema[] = [
        { name: qr, type: 'qrcode', content: 'https://attester.no', position: { x: 155, y: 220 }, width: 32, height: 32, rotate: 0 } as Schema,
        { ...textField(label, QR_LABEL, 253, { width: 40, height: 6, fontSize: 7, alignment: 'center', readOnly: true }), position: { x: 151, y: 253 } } as Schema,
    ];
    return {
        ...draft,
        schemas: append(draft, fields),
        bindings: { ...draft.bindings, [qr]: { source: 'system', system: 'qr_code' } },
    };
}

export function addToday(draft: Draft): Draft {
    const name = uniqueName('dato', fieldNames(draft.schemas));
    return {
        ...draft,
        schemas: append(draft, [textField(name, '[Dagens dato]', nextY(draft.schemas), { width: 50 })]),
        bindings: { ...draft.bindings, [name]: { source: 'system', system: 'today' } },
    };
}

export function remove(draft: Draft, names: string[]): Draft {
    const gone = new Set(names);
    const schemas = (draft.schemas ?? []).map((page) => (page ?? []).filter((f) => !gone.has(f.name)));
    return prune({ ...draft, schemas });
}

export function updateQuestion(draft: Draft, key: string, patch: Partial<FormFieldSchema>): Draft {
    const form = draft.form.map((f) => (f.key === key ? { ...f, ...patch, key } : f));
    if (!patch.type) return { ...draft, form };
    const whole = new Set([`{${key}}`, `{${key}:date}`]);
    const template = patch.type === 'date' ? `{${key}:date}` : `{${key}}`;
    const bindings = Object.fromEntries(
        Object.entries(draft.bindings).map(([n, b]) =>
            b.source === 'composite' && whole.has(b.template.trim()) ? [n, { ...b, template }] : [n, b],
        ),
    );
    return { ...draft, form, bindings };
}

export function items(draft: Draft): DraftItem[] {
    const out: DraftItem[] = [];
    const signatures = new Map<number, DraftItem & { kind: 'signature' }>();
    const formKeys = new Set(draft.form.map((f) => f.key));
    for (const f of allFields(draft.schemas)) {
        const b = draft.bindings[f.name];
        if (b?.source === 'asset_default' && b.kind === 'signature') {
            const position = b.position ?? 0;
            const existing = signatures.get(position);
            if (existing) existing.names.push(f.name);
            else {
                const item = { kind: 'signature' as const, names: [f.name], number: position + 1 };
                signatures.set(position, item);
                out.push(item);
            }
            continue;
        }
        if (!b) {
            if (f.type === 'qrcode') out.push({ kind: 'other', names: [f.name] });
            else if (f.type === 'image') out.push({ kind: 'image', names: [f.name] });
            else if (formKeys.has(f.name)) out.push({ kind: 'question', names: [f.name], field: questionAt(draft.form, f.name)! });
            else out.push({ kind: 'text', names: [f.name], text: String(f.content ?? '') });
            continue;
        }
        const summary = summarizeBinding(f.name, b);
        if (summary.kind === 'automatic' && summary.system === 'qr_code') out.push({ kind: 'qr', names: [f.name] });
        else if (summary.kind === 'automatic' && summary.system === 'today') out.push({ kind: 'today', names: [f.name] });
        else if (summary.kind === 'library' && (summary.assetKind === 'logo' || summary.assetKind === 'body_text')) {
            out.push({ kind: 'library', names: [f.name], assetKind: summary.assetKind });
        }
        else if (summary.kind === 'form' && questionAt(draft.form, summary.key)) {
            out.push({ kind: 'question', names: [f.name], field: questionAt(draft.form, summary.key)! });
        } else out.push({ kind: 'other', names: [f.name], summary });
    }
    return out;
}

export function updateField(draft: Draft, name: string, patch: Partial<Schema>): Draft {
    const schemas = (draft.schemas ?? []).map((page) =>
        (page ?? []).map((f) => (f.name === name ? ({ ...f, ...patch } as Schema) : f)),
    );
    return { ...draft, schemas };
}

export type Box = { x: number; y: number; width: number; height: number };

const MIN = 4;
const snap = (v: number) => Math.round(v * 2) / 2;

export function moveBox(box: Box, dx: number, dy: number, page: { width: number; height: number }): Box {
    return {
        ...box,
        x: snap(Math.min(Math.max(0, box.x + dx), page.width - box.width)),
        y: snap(Math.min(Math.max(0, box.y + dy), page.height - box.height)),
    };
}

export function resizeBox(box: Box, dx: number, dy: number, page: { width: number; height: number }): Box {
    return {
        ...box,
        width: snap(Math.min(Math.max(MIN, box.width + dx), page.width - box.x)),
        height: snap(Math.min(Math.max(MIN, box.height + dy), page.height - box.y)),
    };
}

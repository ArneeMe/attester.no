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
    before?: string;
    after?: string;
    texts?: Record<string, string>;
};

export type DraftItem =
    | { kind: 'text'; names: string[]; text: string }
    | { kind: 'image'; names: string[] }
    | { kind: 'question'; names: string[]; field: FormFieldSchema }
    | { kind: 'signature'; names: string[]; number: number }
    | { kind: 'qr'; names: string[] }
    | { kind: 'today'; names: string[] }
    | { kind: 'library'; names: string[]; assetKind: 'logo' | 'body_text'; position: number }
    | { kind: 'unused'; names: string[] }
    | { kind: 'choiceText'; names: string[]; field: FormFieldSchema; texts: Record<string, string> }
    | { kind: 'other'; names: string[]; summary?: BindingSummary };

const QR_LABEL = 'Verifiser på attester.no';
const SYSTEM_NAMES = new Set(['qr_code', 'qr_info', 'qr_page', 'today']);

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
        else if (b.source === 'choice') keys.add(b.key);
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
            if (!b) return field;
            const summary = summarizeBinding(field.name, b);
            if (summary.kind === 'fixed') {
                delete bindings[field.name];
                return { ...field, content: summary.text, readOnly: true };
            }
            if (summary.kind === 'form') {
                const q = questionAt(draft.form, summary.key);
                return { ...field, content: `[${q?.label ?? summary.key}]` };
            }
            if (summary.kind === 'mixed') return { ...field, content: toDisplay(summary.template, draft.form) };
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
    const before = q.before ?? '';
    const after = q.after ?? '';
    const answer = q.type === 'date' ? `{${key}:date}` : `{${key}}`;
    const binding: FieldBinding = { source: 'composite', template: `${before}${answer}${after}` };
    if (q.optional && (before || after)) binding.requireAll = [key];
    const field: FormFieldSchema = { key, label: q.label.trim(), type: q.type };
    if (q.optional) field.optional = true;
    if (q.type === 'dropdown') field.options = q.options ?? [];
    const height = q.type === 'long_text' ? 30 : 8;
    const next: Draft = {
        schemas: append(draft, [textField(key, `${before}[${field.label}]${after}`, nextY(draft.schemas), { height })]),
        bindings: { ...draft.bindings, [key]: binding },
        form: [...draft.form, field],
    };
    const texts = Object.fromEntries(Object.entries(q.texts ?? {}).filter(([o, t]) => (q.options ?? []).includes(o) && t.trim()));
    if (q.type !== 'dropdown' || Object.keys(texts).length === 0) return next;
    const name = uniqueName(`${key}_tekst`, fieldNames(next.schemas));
    return {
        ...next,
        schemas: append(next, [textField(name, `[Tekst for ${field.label}]`, nextY(next.schemas), { width: 170, height: 20 })]),
        bindings: { ...next.bindings, [name]: { source: 'choice', key, texts } },
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
    const before = usedKeys(draft);
    const schemas = (draft.schemas ?? []).map((page) => (page ?? []).filter((f) => !gone.has(f.name)));
    const bindings = Object.fromEntries(Object.entries(draft.bindings).filter(([n]) => !gone.has(n)));
    const after = usedKeys({ ...draft, schemas, bindings });
    return { schemas, bindings, form: draft.form.filter((f) => !before.has(f.key) || after.has(f.key)) };
}

const PLACEHOLDER = /\{([^{}:]+)(?::([^{}]+))?\}/g;

export function toDisplay(template: string, form: FormSchema): string {
    return template.replace(PLACEHOLDER, (whole, key: string) => {
        const q = questionAt(form, key.trim());
        return q ? `[${q.label}]` : whole;
    });
}

export function fromDisplay(text: string, form: FormSchema): string {
    return [...form]
        .sort((a, b) => b.label.length - a.label.length)
        .reduce((out, q) => out.split(`[${q.label}]`).join(q.type === 'date' ? `{${q.key}:date}` : `{${q.key}}`), text);
}

export function displayText(draft: Draft, field: Schema): string | null {
    if (field.type !== 'text') return null;
    const b = draft.bindings[field.name];
    if (!b) return field.readOnly || !draft.form.some((q) => q.key === field.name) ? String(field.content ?? '') : `[${questionAt(draft.form, field.name)!.label}]`;
    return b.source === 'composite' ? toDisplay(b.template, draft.form) : null;
}

export function setChoiceText(draft: Draft, name: string, option: string, text: string): Draft {
    const b = draft.bindings[name];
    if (b?.source !== 'choice') return draft;
    const texts = { ...b.texts, [option]: text };
    if (!text) delete texts[option];
    return { ...draft, bindings: { ...draft.bindings, [name]: { ...b, texts } } };
}

export function unknownAnswers(text: string, form: FormSchema): string[] {
    const labels = new Set(form.map((q) => q.label));
    return [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]).filter((l) => !labels.has(l));
}

export function setText(draft: Draft, name: string, display: string): Draft {
    const template = fromDisplay(display, draft.form);
    const keys = placeholderKeys(template);
    const bindings = { ...draft.bindings };
    const old = bindings[name];
    if (keys.length === 0) {
        delete bindings[name];
        return { ...draft, bindings, schemas: updateField(draft, name, { content: display, readOnly: true }).schemas };
    }
    const requireAll = old?.source === 'composite' ? old.requireAll?.filter((k) => keys.includes(k)) : undefined;
    bindings[name] = { source: 'composite', template, ...(requireAll?.length ? { requireAll } : {}) };
    return { ...draft, bindings, schemas: updateField(draft, name, { content: display, readOnly: false }).schemas };
}

export function removeQuestion(draft: Draft, key: string): Draft {
    const own = items(draft)
        .filter((i) => (i.kind === 'question' || i.kind === 'choiceText') && i.field.key === key)
        .flatMap((i) => i.names);
    let next = remove(draft, own);
    const strip = new RegExp(`\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?::[^{}]+)?\\}`, 'g');
    for (const f of allFields(next.schemas)) {
        const b = next.bindings[f.name];
        if (b?.source !== 'composite' || !placeholderKeys(b.template).includes(key)) continue;
        const without = { ...next, form: next.form.filter((q) => q.key !== key) };
        next = { ...setText(without, f.name, toDisplay(b.template.replace(strip, ''), without.form)), form: next.form };
    }
    return { ...next, form: next.form.filter((q) => q.key !== key) };
}

export function updateQuestion(draft: Draft, key: string, patch: Partial<FormFieldSchema>): Draft {
    const form = draft.form.map((f) => (f.key === key ? { ...f, ...patch, key } : f));
    if (patch.options) {
        const keep = new Set(patch.options);
        const bindings = Object.fromEntries(
            Object.entries(draft.bindings).map(([n, b]) =>
                b.source === 'choice' && b.key === key
                    ? [n, { ...b, texts: Object.fromEntries(Object.entries(b.texts).filter(([o]) => keep.has(o))) }]
                    : [n, b],
            ),
        );
        return { ...draft, form, bindings };
    }
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
        if (!b && !SYSTEM_NAMES.has(f.name)) {
            if (f.type === 'qrcode') out.push({ kind: 'other', names: [f.name] });
            else if (f.type === 'image') out.push({ kind: 'image', names: [f.name] });
            else if (formKeys.has(f.name)) out.push({ kind: 'question', names: [f.name], field: questionAt(draft.form, f.name)! });
            else if (f.readOnly) out.push({ kind: 'text', names: [f.name], text: String(f.content ?? '') });
            else out.push({ kind: 'unused', names: [f.name] });
            continue;
        }
        const summary = summarizeBinding(f.name, b);
        if (summary.kind === 'automatic' && summary.system === 'qr_code') out.push({ kind: 'qr', names: [f.name] });
        else if (summary.kind === 'automatic' && summary.system === 'today') out.push({ kind: 'today', names: [f.name] });
        else if (b?.source === 'choice' && questionAt(draft.form, b.key)) {
            out.push({ kind: 'choiceText', names: [f.name], field: questionAt(draft.form, b.key)!, texts: b.texts });
        }
        else if (summary.kind === 'library' && (summary.assetKind === 'logo' || summary.assetKind === 'body_text')) {
            out.push({ kind: 'library', names: [f.name], assetKind: summary.assetKind, position: (summary.number ?? 1) - 1 });
        }
        else if (summary.kind === 'form' && questionAt(draft.form, summary.key)) {
            out.push({ kind: 'question', names: [f.name], field: questionAt(draft.form, summary.key)! });
        } else if (summary.kind === 'mixed' || summary.kind === 'fixed') {
            out.push({ kind: 'text', names: [f.name], text: displayText(draft, f) ?? '' });
        } else out.push({ kind: 'other', names: [f.name], summary });
    }
    const shown = new Set(out.flatMap((i) => (i.kind === 'question' ? [i.field.key] : [])));
    for (const q of draft.form) if (!shown.has(q.key)) out.push({ kind: 'question', names: [], field: q });
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

export function missingForSave(draft: Draft): Array<'qr' | 'brand'> {
    const fields = allFields(draft.schemas);
    const missing: Array<'qr' | 'brand'> = [];
    if (!fields.some((f) => f.type === 'qrcode' || f.name === 'qr_code')) missing.push('qr');
    if (!fields.some((f) => f.type === 'text' && typeof f.content === 'string' && /attester\.no/i.test(f.content))) missing.push('brand');
    return missing;
}

const PT_TO_MM = 25.4 / 72;
const DATE_WIDTH = 10;

function capacity(field: Schema): number {
    const em = Number(field.fontSize ?? 12) * PT_TO_MM;
    const perLine = Math.floor(field.width / (em * 0.5));
    const lines = Math.max(1, Math.floor(field.height / (em * Number(field.lineHeight ?? 1.2))));
    return perLine * lines;
}

export function answerLimits(draft: Draft): Record<string, number> {
    const isText = (key: string) => {
        const q = questionAt(draft.form, key);
        return q?.type === 'text' || q?.type === 'long_text';
    };
    const limits: Record<string, number> = {};
    const limit = (key: string, n: number) => {
        limits[key] = Math.max(5, Math.min(limits[key] ?? Infinity, n));
    };
    for (const f of allFields(draft.schemas)) {
        if (f.type !== 'text') continue;
        const b = draft.bindings[f.name];
        if (!b && isText(f.name) && !f.readOnly) limit(f.name, capacity(f));
        if (b?.source === 'submission' && isText(b.key)) limit(b.key, capacity(f));
        if (b?.source !== 'composite') continue;
        const keys = placeholderKeys(b.template);
        const texts = keys.filter(isText);
        if (texts.length === 0) continue;
        const fixed = b.template.replace(PLACEHOLDER, '').length + (keys.length - texts.length) * DATE_WIDTH;
        const each = Math.floor((capacity(f) - fixed) / texts.length);
        texts.forEach((k) => limit(k, each));
    }
    return limits;
}

export function withLimits(draft: Draft): FormSchema {
    const limits = answerLimits(draft);
    return draft.form.map((q) => {
        const next = { ...q };
        delete next.maxLength;
        return limits[q.key] ? { ...next, maxLength: limits[q.key] } : next;
    });
}

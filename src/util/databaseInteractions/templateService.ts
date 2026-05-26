import { authHeader } from '@/lib/nhost';
import type { PDFTemplate } from '@/types/templateTypes';
import type { FormSchema } from '@/types/formSchema';
import type { FieldBindings } from '@/types/fieldBindings';
import type { Template } from '@pdfme/common';
import { deriveFormSchema } from '@/util/templateFields';

type TemplateRow = {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    base_pdf: string;
    schemas: Template['schemas'];
    form_schema: FormSchema | null;
    field_bindings: FieldBindings | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
};

export async function getTemplates(orgSlug: string): Promise<PDFTemplate[]> {
    const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/templates`, {
        headers: authHeader(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to load templates');
    return (json.templates as TemplateRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        basePdf: row.base_pdf,
        schemas: row.schemas,
        formSchema: row.form_schema ?? undefined,
        fieldBindings: row.field_bindings ?? undefined,
        isDefault: row.is_default,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    }));
}

export async function setTemplateDefault(orgSlug: string, templateId: string, isDefault: boolean): Promise<void> {
    const res = await fetch(
        `/api/org/${encodeURIComponent(orgSlug)}/templates/${encodeURIComponent(templateId)}`,
        {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', ...authHeader() },
            body: JSON.stringify({ isDefault }),
        },
    );
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to update template default');
    }
}

export async function deleteTemplate(orgSlug: string, templateId: string): Promise<void> {
    const res = await fetch(
        `/api/org/${encodeURIComponent(orgSlug)}/templates/${encodeURIComponent(templateId)}`,
        { method: 'DELETE', headers: authHeader() },
    );
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to delete template');
    }
}

export async function saveTemplate(
    orgSlug: string,
    template: Omit<PDFTemplate, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<PDFTemplate> {
    const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/templates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeader() },
        body: JSON.stringify({
            name: template.name,
            description: template.description,
            basePdf: template.basePdf,
            schemas: template.schemas,
            formSchema: template.formSchema,
            fieldBindings: template.fieldBindings ?? {},
            isDefault: template.isDefault,
        }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to save template');
    const row = json.template as { id: string; created_at: string; updated_at: string };
    return {
        ...template,
        id: row.id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

/**
 * Convert a pdfme Designer template into our PDFTemplate shape. The designer
 * doesn't know about field bindings or the public form schema, so we auto-
 * derive a sensible default form_schema from the placeholder names (admin can
 * later customise labels / types).
 */
export function fromPdfmeTemplate(
    pdfmeTemplate: Template,
    name: string,
    options?: {
        description?: string;
        isDefault?: boolean;
        fieldBindings?: FieldBindings;
        formSchema?: FormSchema;
    },
): Omit<PDFTemplate, 'id' | 'createdAt' | 'updatedAt'> {
    const fieldBindings = autoBindSystemSlots(
        pdfmeTemplate.schemas,
        options?.fieldBindings ?? {},
    );
    const formSchema = options?.formSchema ?? deriveFormSchema(pdfmeTemplate.schemas, fieldBindings);
    return {
        name,
        description: options?.description,
        basePdf: pdfmeTemplate.basePdf as string,
        schemas: pdfmeTemplate.schemas,
        formSchema,
        fieldBindings,
        isDefault: options?.isDefault ?? false,
    };
}

/**
 * Pdfme field names that, by convention, map directly to a system slot
 * (resolveBinding's `system` source). Auto-wire these on save so admins
 * don't have to open the bindings editor for the obvious ones — placing
 * a qr_code field is signal enough that it should hold the verify URL.
 */
const SYSTEM_SLOT_BY_NAME: Record<string, 'qr_code' | 'qr_info' | 'qr_page' | 'today'> = {
    qr_code: 'qr_code',
    qr_info: 'qr_info',
    qr_page: 'qr_page',
    today: 'today',
    signature_date: 'today',
};

function autoBindSystemSlots(
    schemas: Template['schemas'],
    existing: FieldBindings,
): FieldBindings {
    const next: FieldBindings = { ...existing };
    for (const page of schemas ?? []) {
        for (const field of page ?? []) {
            const name = field?.name;
            if (typeof name !== 'string') continue;
            if (next[name]) continue;
            const slot = SYSTEM_SLOT_BY_NAME[name];
            if (!slot) continue;
            next[name] = { source: 'system', system: slot };
        }
    }
    return next;
}

import { authHeader } from '@/lib/nhost';
import type { PDFTemplate } from '@/types/templateTypes';
import type { Template } from '@pdfme/common';

type TemplateRow = {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    base_pdf: string;
    schemas: Template['schemas'];
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
        isDefault: row.is_default,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    }));
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

export function fromPdfmeTemplate(
    pdfmeTemplate: Template,
    name: string,
    options?: { description?: string; isDefault?: boolean },
): Omit<PDFTemplate, 'id' | 'createdAt' | 'updatedAt'> {
    return {
        name,
        description: options?.description,
        basePdf: pdfmeTemplate.basePdf as string,
        schemas: pdfmeTemplate.schemas,
        isDefault: options?.isDefault ?? false,
    };
}

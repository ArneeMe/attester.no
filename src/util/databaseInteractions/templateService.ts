import { nhost, getDefaultOrgId } from '@/lib/nhost';
import type { PDFTemplate } from '@/types/templateTypes';
import type { Template } from '@pdfme/common';

const GET_TEMPLATES = `
    query GetTemplates($organizationId: uuid!) {
        templates(where: { organization_id: { _eq: $organizationId } }, order_by: { created_at: asc }) {
            id
            organization_id
            name
            description
            base_pdf
            schemas
            is_default
            created_at
            updated_at
        }
    }
`;

const INSERT_TEMPLATE = `
    mutation InsertTemplate(
        $organizationId: uuid!, $name: String!, $description: String,
        $basePdf: String!, $schemas: jsonb!, $isDefault: Boolean!
    ) {
        insert_templates_one(object: {
            organization_id: $organizationId, name: $name, description: $description,
            base_pdf: $basePdf, schemas: $schemas, is_default: $isDefault
        }) { id created_at updated_at }
    }
`;

export async function getTemplates(): Promise<PDFTemplate[]> {
    const organizationId = await getDefaultOrgId();
    const res = await nhost.graphql.request<{ templates: Record<string, unknown>[] }>({
        query: GET_TEMPLATES,
        variables: { organizationId },
    });
    return (res.body.data?.templates ?? []).map((row) => ({
        id: row.id as string,
        organizationId: row.organization_id as string,
        name: row.name as string,
        description: row.description as string | undefined,
        basePdf: row.base_pdf as string,
        schemas: row.schemas as Template['schemas'],
        isDefault: row.is_default as boolean,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
    }));
}

export async function saveTemplate(
    template: Omit<PDFTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PDFTemplate> {
    const organizationId = await getDefaultOrgId();
    const res = await nhost.graphql.request<{
        insert_templates_one: { id: string; created_at: string; updated_at: string };
    }>({
        query: INSERT_TEMPLATE,
        variables: {
            organizationId,
            name: template.name,
            description: template.description,
            basePdf: template.basePdf,
            schemas: template.schemas,
            isDefault: template.isDefault,
        },
    });

    const row = res.body.data?.insert_templates_one;
    if (!row) throw new Error('Failed to save template');

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
    options?: { description?: string; isDefault?: boolean }
): Omit<PDFTemplate, 'id' | 'createdAt' | 'updatedAt'> {
    return {
        organizationId: 'echo',
        name,
        description: options?.description,
        basePdf: pdfmeTemplate.basePdf as string,
        schemas: pdfmeTemplate.schemas,
        isDefault: options?.isDefault ?? false,
    };
}

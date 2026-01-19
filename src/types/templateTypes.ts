import type { Schema } from '@pdfme/common';

export type TemplateFieldType = 'text' | 'date' | 'select' | 'textarea';

export type TemplateStatus = 'draft' | 'active';

export interface TemplateField {
    key: string;
    label: string;
    type: TemplateFieldType;
    required: boolean;
    options?: string[];
    order: number;
}

export const RESERVED_FIELD_PREFIXES = [
    'qr_',           // qr_code, qr_info, qr_page
    'signature_',    // signature_date, signature_name_1, signature_photo_1, etc.
] as const;

export function isReservedField(fieldName: string): boolean {
    return RESERVED_FIELD_PREFIXES.some(prefix => fieldName.startsWith(prefix));
}

export interface PDFTemplate {
    id?: string;
    organizationId: string;
    name: string;
    description?: string;
    basePdf: string;
    schemas: Schema[][];
    fields?: TemplateField[];
    isDefault: boolean;
    status?: TemplateStatus;
    createdAt: Date;
    updatedAt: Date;
}

export function extractConfigurableFields(schemas: Schema[][]): string[] {
    const fieldNames = new Set<string>();

    for (const page of schemas) {
        for (const field of page) {
            if (field.name && !isReservedField(field.name)) {
                fieldNames.add(field.name);
            }
        }
    }

    return Array.from(fieldNames);
}
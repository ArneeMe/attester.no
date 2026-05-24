import type { Schema } from '@pdfme/common';

export interface PDFTemplate {
    id?: string;
    name: string;
    description?: string;
    basePdf: string;
    schemas: Schema[][];
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

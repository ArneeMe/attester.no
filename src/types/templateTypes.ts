import type { Schema } from '@pdfme/common';
import type { FormSchema } from './formSchema';

export interface PDFTemplate {
    id?: string;
    name: string;
    description?: string;
    basePdf: string;
    schemas: Schema[][];
    formSchema?: FormSchema;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

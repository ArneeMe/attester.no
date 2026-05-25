import type { Schema } from '@pdfme/common';
import type { FormSchema } from './formSchema';
import type { FieldBindings } from './fieldBindings';

export interface PDFTemplate {
    id?: string;
    name: string;
    description?: string;
    basePdf: string;
    schemas: Schema[][];
    formSchema?: FormSchema;
    fieldBindings?: FieldBindings;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

import type { Schema } from '@pdfme/common';

/**
 * PDFTemplate stored in Firestore at /organizations/{orgId}/templates/{templateId}
 */
export interface PDFTemplate {
    id?: string;
    organizationId: string;
    name: string;
    description?: string;
    basePdf: string;
    schemas: Schema[][];
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}
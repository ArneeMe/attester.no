import { barcodes, image, text } from '@pdfme/schemas';
import { generate } from '@pdfme/generator';
import { Template } from '@pdfme/common';
import { getPdfInput } from '@/app/login/adminpage/getPDFInput';
import type { FieldBindings } from '@/types/fieldBindings';

export type TemplateData = {
    id: string;
    base_pdf: string;
    schemas: Template['schemas'];
    field_bindings: FieldBindings;
};

export const generatePDF = async (
    orgSlug: string,
    templateData: TemplateData,
    submissionId: string,
    data: Record<string, string>,
) => {
    const pdfInput = await getPdfInput(
        orgSlug,
        templateData.id,
        submissionId,
        data,
        templateData.schemas,
        templateData.field_bindings,
    );
    // pdfme throws "input for X is required" when a field has `required:
    // true` and no truthy input value — even empty string counts as
    // missing. Legacy templates (saved before field_bindings existed) hit
    // this for fields like `student_name_date` whose values used to come
    // from hardcoded composite logic. We already validate templates at
    // our level (QR + attester.no fingerprint), so drop the per-field
    // required flag and let missing data render as empty.
    const template: Template = {
        basePdf: templateData.base_pdf,
        schemas: templateData.schemas.map((page) =>
            page.map((field) => ({ ...field, required: false })),
        ),
    };
    const pdf = await generate({
        template,
        inputs: pdfInput,
        plugins: { text, image, qrcode: barcodes.qrcode },
    });
    const filename = data.name ? `${data.name}_attest.pdf` : `attest_${submissionId}.pdf`;
    const blob = new Blob([new Uint8Array(pdf.buffer)], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

import { barcodes, image, text } from '@pdfme/schemas';
import { generate } from '@pdfme/generator';
import { Template } from '@pdfme/common';
import { getPdfInput } from '@/app/login/adminpage/getPDFInput';
import { decorateTemplateForGenerate } from '@/util/decorateTemplate';
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
    const template = decorateTemplateForGenerate({
        basePdf: templateData.base_pdf,
        schemas: templateData.schemas,
    });
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

import { Volunteer } from '@/util/Volunteer';
import { barcodes, image, text } from '@pdfme/schemas';
import { generate } from '@pdfme/generator';
import { getPdfInput } from "@/app/login/adminpage/getPDFInput";
import { Template } from "@pdfme/common";

export type TemplateData = {
    id: string;
    base_pdf: string;
    schemas: unknown;
};

export const generatePDF = async (orgSlug: string, templateData: TemplateData, volunteer: Volunteer) => {
    const pdfInput = await getPdfInput(orgSlug, templateData.id, volunteer);
    const template: Template = {
        basePdf: templateData.base_pdf,
        schemas: templateData.schemas as Template['schemas'],
    };
    try {
        const pdf = await generate({
            template,
            inputs: pdfInput,
            plugins: { text, image, qrcode: barcodes.qrcode },
        });
        const blob = new Blob([new Uint8Array(pdf.buffer)], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${volunteer.personName}_attest.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Feil ved generering av PDF:', error);
    }
};

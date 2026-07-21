import { barcodes, image, text } from '@pdfme/schemas';
import { generate } from '@pdfme/generator';
import { Template } from '@pdfme/common';
import type { Schema } from '@pdfme/common';
import { getPdfInput } from '@/app/login/adminpage/getPDFInput';
import { decorateTemplateForGenerate } from '@/util/decorateTemplate';
import type { FieldBindings } from '@/types/fieldBindings';

export type TemplateData = {
    id: string;
    base_pdf: string;
    schemas: Template['schemas'];
    field_bindings: FieldBindings;
};

/**
 * Render the attest PDF and return it as a blob + filename, without
 * touching the DOM. Shared by single download, batch ZIP, and (with a
 * watermark layered on) preview.
 */
export const buildAttestPdfBlob = async (
    orgSlug: string,
    templateData: TemplateData,
    submissionId: string,
    data: Record<string, string>,
): Promise<{ blob: Blob; filename: string }> => {
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
    return { blob: new Blob([new Uint8Array(pdf.buffer)], { type: 'application/pdf' }), filename };
};

export const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const generatePDF = async (
    orgSlug: string,
    templateData: TemplateData,
    submissionId: string,
    data: Record<string, string>,
) => {
    const { blob, filename } = await buildAttestPdfBlob(orgSlug, templateData, submissionId, data);
    downloadBlob(blob, filename);
};

// Diagonal grey banner stamped on every page of a preview render, so a
// preview that escapes into the world can't pass as an issued attest.
// Mirrors the full field shape used by decorateTemplate's verify label —
// pdfme skips or clips fields with a sparser shape.
const previewWatermark = (pageIndex: number): Schema => ({
    name: `__preview_watermark__${pageIndex}`,
    type: 'text',
    content: 'FORHÅNDSVISNING – IKKE GYLDIG ATTEST',
    position: { x: 10, y: 130 },
    width: 190,
    height: 20,
    rotate: 30,
    alignment: 'center',
    verticalAlignment: 'middle',
    fontSize: 24,
    lineHeight: 1,
    characterSpacing: 1,
    fontColor: '#b9b9b9',
    backgroundColor: '',
    opacity: 0.7,
    required: false,
} as Schema);

/**
 * Render the attest exactly as generatePDF would — same bindings, same real
 * submission data, same QR URL — but WITHOUT touching the certificates
 * route: no hash is registered and the submission is not deleted. Opens in
 * a new tab with a watermark instead of downloading.
 */
export const previewPDF = async (
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
    const decorated = decorateTemplateForGenerate({
        basePdf: templateData.base_pdf,
        schemas: templateData.schemas,
    });
    const template: Template = {
        ...decorated,
        schemas: (decorated.schemas ?? []).map((page, i) => [...(page ?? []), previewWatermark(i)]),
    };
    const pdf = await generate({
        template,
        inputs: pdfInput,
        plugins: { text, image, qrcode: barcodes.qrcode },
    });
    const blob = new Blob([new Uint8Array(pdf.buffer)], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

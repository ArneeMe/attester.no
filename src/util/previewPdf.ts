import { generate } from '@pdfme/generator';
import { barcodes, image, text } from '@pdfme/schemas';
import type { Template } from '@pdfme/common';
import type { FieldBindings } from '@/types/fieldBindings';
import type { FormSchema } from '@/types/formSchema';
import type { OrgAsset } from '@/types/orgAssets';
import { buildPdfInput, type SystemValues } from '@/util/resolveBinding';
import { buildSampleSubmission } from '@/util/sampleSubmission';
import { listTemplateFieldNames } from '@/util/templateFields';

/**
 * Render the designer's current template with placeholder data, so the admin
 * can sanity-check layout/bindings without going through the full submission
 * flow. Uses the same buildPdfInput pipeline as production cert generation.
 */
export async function generatePreviewPdf(
    orgSlug: string,
    pdfmeTemplate: Template,
    bindings: FieldBindings,
    formSchema: FormSchema,
    assets: OrgAsset[],
    filenameStem: string,
): Promise<void> {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    const system: SystemValues = {
        today: `${dd}.${mm}.${yyyy}`,
        qr_code: `${window.location.origin}/org/${orgSlug}/verify?preview=1`,
        qr_info: 'Scan for å verifisere',
        qr_page: window.location.origin,
    };

    const submission = buildSampleSubmission(formSchema, assets);
    const fieldNames = listTemplateFieldNames(pdfmeTemplate.schemas);
    const input = buildPdfInput(fieldNames, bindings, { submission, assets, system });

    const pdf = await generate({
        template: pdfmeTemplate,
        inputs: [input],
        plugins: { text, image, qrcode: barcodes.qrcode },
    });

    const blob = new Blob([new Uint8Array(pdf.buffer)], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `forhandsvisning-${filenameStem || 'mal'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

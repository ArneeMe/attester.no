import { generate } from '@pdfme/generator';
import { barcodes, image, text } from '@pdfme/schemas';
import type { Template } from '@pdfme/common';
import type { FieldBindings } from '@/types/fieldBindings';
import type { FormSchema } from '@/types/formSchema';
import type { OrgAsset } from '@/types/orgAssets';
import { buildPdfInput, type SystemValues } from '@/util/resolveBinding';
import { buildSampleSubmission } from '@/util/sampleSubmission';

/**
 * Render the designer's current template with placeholder data and return
 * an object URL for inline embedding. Uses the same buildPdfInput pipeline
 * as production cert generation so the preview matches reality.
 *
 * Caller is responsible for calling URL.revokeObjectURL when done (or when
 * replacing the URL) — long-lived blob URLs leak memory.
 */
export async function buildPreviewPdfUrl(
    orgSlug: string,
    pdfmeTemplate: Template,
    bindings: FieldBindings,
    formSchema: FormSchema,
    assets: OrgAsset[],
): Promise<string> {
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
    const input = buildPdfInput(pdfmeTemplate.schemas, bindings, { submission, assets, system });

    // See generatePDF.ts for why we strip `required` — pdfme treats empty
    // input as missing, which crashes legacy templates with no bindings.
    const template: Template = {
        ...pdfmeTemplate,
        schemas: pdfmeTemplate.schemas.map((page) =>
            page.map((field) => ({ ...field, required: false })),
        ),
    };

    const pdf = await generate({
        template,
        inputs: [input],
        plugins: { text, image, qrcode: barcodes.qrcode },
    });

    const blob = new Blob([new Uint8Array(pdf.buffer)], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
}

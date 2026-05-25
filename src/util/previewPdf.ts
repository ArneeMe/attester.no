import { generate } from '@pdfme/generator';
import { barcodes, image, text } from '@pdfme/schemas';
import type { Template } from '@pdfme/common';
import type { FieldBindings } from '@/types/fieldBindings';
import type { FormSchema } from '@/types/formSchema';
import type { OrgAsset, LookupListContent } from '@/types/orgAssets';
import { buildPdfInput, type SystemValues } from '@/util/resolveBinding';
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

    const submission = buildFakeSubmission(formSchema, assets);
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

function buildFakeSubmission(
    schema: FormSchema,
    assets: OrgAsset[],
): Record<string, string> {
    const isoToday = new Date().toISOString().slice(0, 10);
    const data: Record<string, string> = {};
    for (const field of schema) {
        switch (field.type) {
            case 'date':
                data[field.key] = isoToday;
                break;
            case 'number':
                data[field.key] = '42';
                break;
            case 'long_text':
                data[field.key] = 'Eksempeltekst for forhåndsvisning.';
                break;
            case 'dropdown': {
                if (field.options && field.options.length > 0) {
                    data[field.key] = field.options[0];
                    break;
                }
                if (field.optionsFromAsset) {
                    const list = assets.find(
                        (a) => a.id === field.optionsFromAsset && a.kind === 'lookup_list',
                    );
                    const items = (list?.content as LookupListContent | undefined)?.items;
                    data[field.key] = items?.[0]?.name ?? 'Eksempel';
                    break;
                }
                data[field.key] = 'Eksempel';
                break;
            }
            case 'text':
            default:
                data[field.key] = field.label || 'Eksempel';
        }
    }
    return data;
}

import type { Template } from '@pdfme/common';
import { generateURL } from './generateURL';
import { listOrgAssets } from '@/util/databaseInteractions/orgAssets';
import { buildPdfInput, type SystemValues } from '@/util/resolveBinding';
import type { FieldBindings } from '@/types/fieldBindings';

/**
 * Build the flat `Record<string, string>` that pdfme.generate expects.
 *
 * Each field name in the template's pdfme schema resolves via:
 *   1. The template's field_bindings, if a binding exists for that name.
 *   2. Otherwise, submission.data[<field name>] directly.
 *
 * Field bindings cover system slots (qr_code, today, …), composite strings,
 * and references into the per-org asset library.
 */
export const getPdfInput = async (
    orgSlug: string,
    templateId: string,
    submissionId: string,
    data: Record<string, string>,
    schemas: Template['schemas'],
    fieldBindings: FieldBindings,
): Promise<Record<string, string>[]> => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    const fullURL = generateURL(orgSlug, templateId, submissionId, data);
    const basePageURL = window.location.origin;

    const system: SystemValues = {
        today: `${dd}.${mm}.${yyyy}`,
        qr_code: fullURL,
        qr_info: 'Scan for å verifisere',
        qr_page: basePageURL,
    };

    let assets = [] as Awaited<ReturnType<typeof listOrgAssets>>;
    try {
        assets = await listOrgAssets(orgSlug);
    } catch (error) {
        console.error('Error loading org assets:', error);
    }

    const input = buildPdfInput(schemas, fieldBindings, {
        submission: data,
        assets,
        system,
    });
    return [input];
};

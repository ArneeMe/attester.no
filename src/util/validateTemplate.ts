import type { Template } from '@pdfme/common';

/**
 * Mandatory presence rules for every issued PDF, regardless of layout:
 *   - A QR-code field (so the cert can be verified back via the URL it encodes).
 *   - An "attester.no" mention (the platform's fingerprint, by user request).
 *
 * Admins choose where on the page these go — but they cannot leave them off.
 */
export function validateTemplateForSave(template: Template): string[] {
    const errors: string[] = [];

    const allFields = (template.schemas ?? []).flatMap((page) => page ?? []);

    const hasQr = allFields.some((f) => f.type === 'qrcode' || f.name === 'qr_code');
    if (!hasQr) {
        errors.push('PDF-en må inneholde en QR-kode (typen "QR" eller felt med navn qr_code).');
    }

    const hasFingerprint = allFields.some((f) => {
        if (f.type !== 'text') return false;
        const content = (f as { content?: unknown }).content;
        return typeof content === 'string' && /attester\.no/i.test(content);
    });
    if (!hasFingerprint) {
        errors.push('PDF-en må inneholde teksten "attester.no" et sted (vår verifiserings-fotavtrykk).');
    }

    return errors;
}

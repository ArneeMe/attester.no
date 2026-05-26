import type { FieldBindings } from '@/types/fieldBindings';

/**
 * Field bindings for the echo PDF template (echo attest v1). The pdfme schema
 * in customTemplate.ts uses field names like `student_role`, `verv_1`,
 * `signature_photo_1`, `qr_code`. These bindings tell the generic resolver in
 * util/resolveBinding.ts how to fill each one from submission data, system
 * values, or the org's asset library (defaults to the first/second signature
 * row, the default body_text, and the Undergrupper lookup-list).
 *
 * The migration script (2026-05-org-assets.sql) populates the same shape into
 * the existing echo template row. This file exists so the seed scripts can
 * re-seed an identical template without losing bindings.
 *
 * Re-used as the lookup list's name in echo.
 */
export const ECHO_UNDERGRUPPER_LIST_NAME = 'Undergrupper';

export const echoFieldBindings: FieldBindings = {
    signature_date: { source: 'system', system: 'today' },
    qr_code: { source: 'system', system: 'qr_code' },
    qr_page: { source: 'system', system: 'qr_page' },
    qr_info: { source: 'composite', template: 'Scan for å verifisere' },

    student_name_date: { source: 'composite', template: 'Attest til {name}' },
    student_role: {
        source: 'composite',
        template: '{name} har vært {role} i {group} fra {start:date} til {end:date}',
        requireAll: ['name', 'role', 'group', 'start', 'end'],
    },
    verv_1: {
        source: 'composite',
        template: '{name} har og hatt en stilling som {role1} i {group1} fra {start1:date} til {end1:date}',
        requireAll: ['name', 'role1', 'group1', 'start1', 'end1'],
    },
    verv_2: {
        source: 'composite',
        template: '{name} har og hatt en stilling som {role2} i {group2} fra {start2:date} til {end2:date}',
        requireAll: ['name', 'role2', 'group2', 'start2', 'end2'],
    },
    verv_3: {
        source: 'composite',
        template: '{name} har og hatt en stilling som {role3} i {group3} fra {start3:date} til {end3:date}',
        requireAll: ['name', 'role3', 'group3', 'start3', 'end3'],
    },

    echo_info: { source: 'asset_default', kind: 'body_text', subField: 'text' },

    signature_photo_1: { source: 'asset_default', kind: 'signature', position: 0, subField: 'photo' },
    signature_name_1:  { source: 'asset_default', kind: 'signature', position: 0, subField: 'name' },
    signature_role_1:  { source: 'asset_default', kind: 'signature', position: 0, subField: 'role' },
    signature_phone_1: { source: 'asset_default', kind: 'signature', position: 0, subField: 'phone' },
    signature_photo_2: { source: 'asset_default', kind: 'signature', position: 1, subField: 'photo' },
    signature_name_2:  { source: 'asset_default', kind: 'signature', position: 1, subField: 'name' },
    signature_role_2:  { source: 'asset_default', kind: 'signature', position: 1, subField: 'role' },
    signature_phone_2: { source: 'asset_default', kind: 'signature', position: 1, subField: 'phone' },
    // group_info is bound to a lookup-list. Since the list's id isn't known
    // until the asset is created, the seed scripts plug it in at insert time.
};

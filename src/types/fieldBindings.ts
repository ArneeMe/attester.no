/**
 * Maps a pdfme schema field name onto a data source at render time.
 *
 * Resolution order (in `resolveBinding`):
 *   1. If a binding exists for the field name → resolve via that.
 *   2. Otherwise, fall back to `submission.data[<field name>]`.
 *
 * The fallback lets new templates "just work" when the admin names PDF fields
 * the same as the form fields. Bindings are only needed for composites,
 * system values, or library assets.
 */

export type SystemSlot = 'qr_code' | 'qr_info' | 'qr_page' | 'today';

export type FieldBinding =
    | { source: 'system'; system: SystemSlot }
    | { source: 'submission'; key: string }
    | { source: 'composite'; template: string; requireAll?: string[] }
    | { source: 'asset'; assetId: string; subField?: string }
    | {
          source: 'asset_default';
          kind: 'signature' | 'logo' | 'body_text';
          position?: number;
          subField?: string;
      }
    | { source: 'lookup'; assetId: string; byKey: string; subField: string };

export type FieldBindings = Record<string, FieldBinding>;

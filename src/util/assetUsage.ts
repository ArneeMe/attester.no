import type { FieldBinding } from '@/types/fieldBindings';
import type { PDFTemplate } from '@/types/templateTypes';

/**
 * Counts how many of the given templates reference the asset by id (via a
 * direct `asset` or `lookup` binding, or via a `optionsFromAsset` dropdown
 * field). Does NOT include `asset_default` references — those resolve by
 * kind+position, so they're tied to the asset library shape rather than
 * any specific asset row.
 */
export function countTemplatesUsingAsset(
    assetId: string,
    templates: PDFTemplate[],
): number {
    let count = 0;
    for (const t of templates) {
        if (templateReferencesAsset(t, assetId)) count++;
    }
    return count;
}

export function templateReferencesAsset(template: PDFTemplate, assetId: string): boolean {
    const bindings = template.fieldBindings ?? {};
    for (const binding of Object.values(bindings) as FieldBinding[]) {
        if (binding.source === 'asset' && binding.assetId === assetId) return true;
        if (binding.source === 'lookup' && binding.assetId === assetId) return true;
    }
    const formSchema = template.formSchema ?? [];
    for (const field of formSchema) {
        if (field.optionsFromAsset === assetId) return true;
    }
    return false;
}

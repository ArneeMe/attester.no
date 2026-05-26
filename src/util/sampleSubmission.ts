import type { FormSchema } from '@/types/formSchema';
import type { LookupListContent, OrgAsset } from '@/types/orgAssets';

/**
 * Builds a placeholder submission for the bindings/preview UI: one
 * reasonable-looking value per form_schema field. Lets the admin see how
 * their template would render before any volunteer has actually submitted.
 */
export function buildSampleSubmission(
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

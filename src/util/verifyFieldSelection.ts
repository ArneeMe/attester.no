import type { FormSchema } from '@/types/formSchema';

/**
 * Narrows the verify page's URL-derived fields down to the ones that
 * actually participate in the certificate hash.
 *
 * When the template's form schema is known, only its field keys (plus the
 * submission id) are trusted — this makes the verifier immune to any
 * incidental extra query param (a tracking param a messaging app appends
 * when the link is shared, a future UI param like `lang`) without having
 * to blocklist each one by name as it's discovered.
 *
 * When the schema isn't available (still loading, fetch failed, or the
 * template was deleted), every field already present is trusted as-is —
 * the caller is responsible for stripping known non-cert params (t, lang)
 * before it gets here. This keeps historical certs verifiable even if
 * their template row is gone.
 */
export function selectHashFields(
    schema: FormSchema | null,
    fields: Record<string, string>,
): Record<string, string> {
    if (!schema) return fields;

    const allowedKeys = new Set<string>(['id', ...schema.map((f) => f.key)]);
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
        if (allowedKeys.has(key)) result[key] = value;
    }
    return result;
}

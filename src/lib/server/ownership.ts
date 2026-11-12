import { hasuraAdmin } from "@/lib/server/hasura";

/**
 * Verify a template id belongs to the given org. Used by every route that
 * accepts a client-supplied templateId so an attacker can't reference a
 * different org's template id when posting to their own org's endpoint.
 */
export async function templateBelongsToOrg(
    templateId: string,
    organizationId: string,
): Promise<boolean> {
    if (!templateId || typeof templateId !== "string") return false;
    const data = await hasuraAdmin<{ templates: Array<{ id: string }> }>(
        `query CheckTemplateOrg($id: uuid!, $organizationId: uuid!) {
            templates(where: {
                id: { _eq: $id },
                organization_id: { _eq: $organizationId }
            }, limit: 1) { id }
        }`,
        { id: templateId, organizationId },
    );
    return data.templates.length > 0;
}

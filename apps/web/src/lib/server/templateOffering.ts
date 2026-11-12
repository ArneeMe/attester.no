import { hasuraAdmin } from "@/lib/server/hasura";

/**
 * Templates are immutable: editing one inserts a new row. Offering the new
 * revision must therefore retire the old one, or the public form lists the
 * same attest type twice. Matching on name is what makes that possible
 * without a lineage column — an edit keeps the name, a genuinely different
 * attest type has a different one.
 */
export async function clearOfferedForName(
    organizationId: string,
    name: string,
    exceptId?: string,
): Promise<void> {
    await hasuraAdmin(
        `mutation ClearOfferedForName($organizationId: uuid!, $name: String!, $exceptId: uuid!) {
            update_templates(
                where: {
                    organization_id: { _eq: $organizationId }
                    name: { _eq: $name }
                    id: { _neq: $exceptId }
                }
                _set: { is_offered: false }
            ) { affected_rows }
        }`,
        {
            organizationId,
            name,
            exceptId: exceptId ?? "00000000-0000-0000-0000-000000000000",
        },
    );
}

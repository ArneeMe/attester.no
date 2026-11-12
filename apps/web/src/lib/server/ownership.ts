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

/**
 * Same idea for a submission id. Used when minting a certificate so a
 * malicious admin can't insert a cert hash for a submission from another org
 * (or a non-existent submission).
 */
export async function submissionBelongsToOrg(
    submissionId: string,
    organizationId: string,
): Promise<boolean> {
    if (!submissionId || typeof submissionId !== "string") return false;
    const data = await hasuraAdmin<{ submissions: Array<{ id: string }> }>(
        `query CheckSubmissionOrg($id: uuid!, $organizationId: uuid!) {
            submissions(where: {
                id: { _eq: $id },
                organization_id: { _eq: $organizationId }
            }, limit: 1) { id }
        }`,
        { id: submissionId, organizationId },
    );
    return data.submissions.length > 0;
}

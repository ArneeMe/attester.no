import { hasuraAdmin } from "../lib/hasura";
import { seal, unseal } from "../lib/seal";

export async function storeRecipient(submissionId: string, nationalId: string): Promise<void> {
    await hasuraAdmin(
        `mutation StoreRecipient($submissionId: uuid!, $sealed: String!) {
            insert_submission_recipients_one(object: { submission_id: $submissionId, national_id_enc: $sealed }) {
                submission_id
            }
        }`,
        { submissionId, sealed: seal(nationalId) },
    );
}

export async function loadRecipient(submissionId: string): Promise<string | null> {
    const data = await hasuraAdmin<{ submission_recipients: Array<{ national_id_enc: string }> }>(
        `query LoadRecipient($submissionId: uuid!) {
            submission_recipients(where: { submission_id: { _eq: $submissionId } }, limit: 1) { national_id_enc }
        }`,
        { submissionId },
    );
    const row = data.submission_recipients[0];
    return row ? unseal(row.national_id_enc) : null;
}

export async function deleteRecipient(submissionId: string): Promise<void> {
    await hasuraAdmin(
        `mutation DeleteRecipient($submissionId: uuid!) {
            delete_submission_recipients(where: { submission_id: { _eq: $submissionId } }) { affected_rows }
        }`,
        { submissionId },
    );
}

export async function digipostEnabled(organizationId: string): Promise<boolean> {
    const data = await hasuraAdmin<{ org_settings: Array<{ digipost_enabled: boolean }> }>(
        `query OrgDigipost($organizationId: uuid!) {
            org_settings(where: { organization_id: { _eq: $organizationId } }, limit: 1) { digipost_enabled }
        }`,
        { organizationId },
    );
    return data.org_settings[0]?.digipost_enabled ?? false;
}

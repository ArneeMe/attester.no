import { nhost, getDefaultOrgId } from '@/lib/nhost';
import { Volunteer } from '@/util/Volunteer';
import { generateParams } from '@/app/login/adminpage/generateParams';
import { hashFunction } from '@/util/hashFunction';

export const submitHash = async (volunteer: Volunteer): Promise<void> => {
    try {
        const toHash = generateParams(volunteer);
        const hash = await hashFunction(toHash);
        const organizationId = await getDefaultOrgId();

        const res = await nhost.graphql.request({
            query: `
                mutation InsertCertificate($organizationId: uuid!, $volunteerId: String!, $hash: String!) {
                    insert_certificates_one(object: {
                        organization_id: $organizationId,
                        volunteer_id: $volunteerId,
                        hash: $hash
                    }) { id }
                }
            `,
            variables: { organizationId, volunteerId: volunteer.id, hash },
        });

        if (res.body.errors?.length) throw new Error(res.body.errors[0].message);
    } catch (error) {
        alert('Feil ved lagring av hash');
        console.error(error);
    }
};

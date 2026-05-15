import { nhost } from '@/lib/nhost';

export const deleteVolunteer = async (id: string): Promise<void> => {
    const res = await nhost.graphql.request({
        query: `
            mutation DeleteVolunteer($id: uuid!) {
                delete_volunteers_by_pk(id: $id) { id }
            }
        `,
        variables: { id },
    });

    if (res.body.errors?.length) {
        console.error('Error removing volunteer:', res.body.errors);
        alert('Feil ved sletting av dokument. Sjekk konsollen for detaljer.');
    }
};

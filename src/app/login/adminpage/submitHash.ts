import { nhost, getDefaultOrgId } from '@/lib/nhost';
import { Volunteer } from '@/util/Volunteer';
import { generateParams } from '@/app/login/adminpage/generateParams';
import { hashFunction } from '@/util/hashFunction';

export const submitHash = async (volunteer: Volunteer): Promise<void> => {
    try {
        const toHash = generateParams(volunteer);
        const hash = await hashFunction(toHash);
        const organizationId = await getDefaultOrgId();
        const accessToken = nhost.getUserSession()?.accessToken;
        if (!accessToken) throw new Error('Not authenticated');

        const res = await fetch('/api/certificates', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ organizationId, volunteerId: volunteer.id, hash }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Server error');
    } catch (error) {
        alert('Feil ved lagring av hash');
        console.error(error);
    }
};

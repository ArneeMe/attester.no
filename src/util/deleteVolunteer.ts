import { authHeader } from '@/lib/nhost';

export const deleteVolunteer = async (id: string): Promise<void> => {
    const res = await fetch(`/api/volunteers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeader(),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error('Error removing volunteer:', json);
        alert('Feil ved sletting av dokument. Sjekk konsollen for detaljer.');
    }
};

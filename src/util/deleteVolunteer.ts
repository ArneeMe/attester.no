import { authHeader } from '@/lib/nhost';

export const deleteVolunteer = async (orgSlug: string, id: string): Promise<void> => {
    const res = await fetch(
        `/api/org/${encodeURIComponent(orgSlug)}/volunteers/${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: authHeader() },
    );
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error('Error removing volunteer:', json);
        alert('Feil ved sletting av dokument. Sjekk konsollen for detaljer.');
    }
};

import { authHeader } from '@/lib/nhost';

/**
 * DELETE a submission. Throws on failure so the caller can decide how to
 * surface the error (toast, dialog, etc.) — we no longer alert() here.
 */
export const deleteSubmission = async (orgSlug: string, id: string): Promise<void> => {
    const res = await fetch(
        `/api/org/${encodeURIComponent(orgSlug)}/submissions/${encodeURIComponent(id)}`,
        { method: 'DELETE', headers: authHeader() },
    );
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const reason = json?.error ?? `HTTP ${res.status}`;
        throw new Error(`Kunne ikke slette innsending: ${reason}`);
    }
};

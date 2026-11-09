import { authHeader } from '@/lib/nhost';

export const submitHash = async (
    orgSlug: string,
    submissionId: string,
): Promise<boolean> => {
    const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/certificates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeader() },
        body: JSON.stringify({ submissionId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Server error');
    // true when a cert for this submission already existed (idempotent
    // re-issuance) — callers can use this to skip re-downloading if they
    // want, though re-issuing is always safe either way.
    return !!json.alreadyIssued;
};

import { authHeader } from '@/lib/nhost';
import { buildCertParams } from '@/util/certParams';
import { canonicalHash } from '@/util/canonicalHash';

export const submitHash = async (
    orgSlug: string,
    templateId: string,
    submissionId: string,
    data: Record<string, string>,
): Promise<void> => {
    const params = buildCertParams(templateId, submissionId, data);
    const hash = await canonicalHash(params);

    const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/certificates`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeader() },
        body: JSON.stringify({ submissionId, hash, templateId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Server error');
};

/**
 * Canonical URLSearchParams for a certificate. Issuer, verifier, and seed
 * scripts MUST share this exact shape — drift here invalidates existing certs.
 *
 * `t` (template id) and `id` (submission id) are set explicitly. All other
 * keys come from the submission data record. Empty values are dropped so that
 * the canonical hash is stable across "field present-but-empty" vs "absent".
 *
 * `lang` is reserved for the verify page's UI language toggle: the verifier
 * strips it before hashing (it can appear in a shared URL without being part
 * of the cert), so it must never be baked into a cert at issuance either —
 * otherwise issuer and verifier would disagree and the cert would never
 * verify. Reserved keys in submission data are skipped, not errors, matching
 * the existing t/id behavior.
 */
export const buildCertParams = (
    templateId: string,
    submissionId: string,
    data: Record<string, string>,
): URLSearchParams => {
    const params = new URLSearchParams();
    params.set("t", templateId);
    params.set("id", submissionId);
    for (const [key, value] of Object.entries(data)) {
        if (key === "t" || key === "id" || key === "lang") continue;
        if (value) params.set(key, value);
    }
    return params;
};

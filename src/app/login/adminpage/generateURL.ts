import { buildCertParams } from "@/util/certParams";

export { buildCertParams };

export const generateURL = (
    orgSlug: string,
    templateId: string,
    submissionId: string,
    data: Record<string, string>,
): string =>
    `${window.location.origin}/org/${encodeURIComponent(orgSlug)}/verify?${buildCertParams(templateId, submissionId, data).toString()}`;

import { Volunteer } from "@/util/Volunteer";
import { buildCertParams } from "@/util/certParams";

export { buildCertParams };

export const generateURL = (orgSlug: string, templateId: string, volunteer: Volunteer): string =>
    `${window.location.origin}/org/${encodeURIComponent(orgSlug)}/verify?${buildCertParams(templateId, volunteer).toString()}`;

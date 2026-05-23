import { Volunteer } from "@/util/Volunteer";

/**
 * Canonical URLSearchParams for a certificate. Issuer, verifier, and seed
 * scripts MUST share this exact shape — drift here invalidates existing certs.
 */
export const buildCertParams = (templateId: string, volunteer: Volunteer): URLSearchParams => {
    const params = new URLSearchParams();
    params.set("t", templateId);
    params.set("id", volunteer.id);
    params.set("name", volunteer.personName);
    params.set("group", volunteer.groupName);
    params.set("start", volunteer.startDate);
    params.set("end", volunteer.endDate);
    params.set("role", volunteer.role);
    (volunteer.extraRole ?? []).forEach((r, i) => {
        const n = i + 1;
        if (r.groupName) params.set(`group${n}`, r.groupName);
        if (r.startDate) params.set(`start${n}`, r.startDate);
        if (r.endDate) params.set(`end${n}`, r.endDate);
        if (r.role) params.set(`role${n}`, r.role);
    });
    return params;
};

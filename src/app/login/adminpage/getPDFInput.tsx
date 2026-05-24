import { generateURL } from "./generateURL";
import { getGroupInfo, getOrganizationInfo, getSignatureInfo } from "@/util/databaseInteractions/fetchInfo";
import { formatDate } from "@/util/formatDate";
import { Certificate } from '@/app/login/adminpage/Certificate';
import type { SignatureInfo } from '@/types/pdfTypes';

const EMPTY_SIGNATURE: SignatureInfo = { photo: '', name: '', role: '', phone: '' };

/**
 * Maps a submission's generic data record onto the echo pdfme template's
 * specific input keys. The pdfme schema keys (`student_role`, `group_info`,
 * `verv_1`, etc.) are echo-specific and remain hardcoded here; the data keys
 * (`name`, `group`, `start`, `end`, `role`, `groupN`, `startN`, `endN`,
 * `roleN`) come from VOLUNTEER_FORM_SCHEMA. Templates whose form_schema
 * doesn't match those keys can be submitted and verified, but won't render
 * meaningful content through this echo-shaped pipeline.
 */
export const getPdfInput = async (
    orgSlug: string,
    templateId: string,
    submissionId: string,
    data: Record<string, string>,
): Promise<Certificate[]> => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    const name = data.name ?? '';
    const groupName = data.group ?? '';
    const role = data.role ?? '';
    const startDate = data.start ?? '';
    const endDate = data.end ?? '';

    const fullURL = generateURL(orgSlug, templateId, submissionId, data);
    const basePageURL = window.location.origin;

    let groupInfo = `Information about ${groupName}`;
    let generic_echo = '';
    let signaturePerson1: SignatureInfo = EMPTY_SIGNATURE;
    let signaturePerson2: SignatureInfo = EMPTY_SIGNATURE;

    try {
        const [groupDescriptions, organizationInfo, signatories] = await Promise.all([
            getGroupInfo(orgSlug),
            getOrganizationInfo(orgSlug),
            getSignatureInfo(orgSlug),
        ]);

        if (groupName && groupDescriptions[groupName]) {
            groupInfo = groupDescriptions[groupName];
        }
        if (organizationInfo.generic_text) {
            generic_echo = organizationInfo.generic_text;
        }
        if (signatories.length >= 1) signaturePerson1 = signatories[0];
        if (signatories.length >= 2) signaturePerson2 = signatories[1];
    } catch (error) {
        console.error('Error fetching content for certificate:', error);
    }

    const getVervText = (n: number) => {
        const r = data[`role${n}`];
        const g = data[`group${n}`];
        const s = data[`start${n}`];
        const e = data[`end${n}`];
        if (r && g && s && e) {
            return `${name} har og hatt en stilling som ${r} i ${g} fra ${formatDate(s)} til ${formatDate(e)}`;
        }
        return '';
    };

    return [{
        signature_date: dd + '.' + mm + '.' + yyyy,
        student_name_date: `Attest til ${name}`,
        student_role: `${name} har vært ${role} i ${groupName} fra ${formatDate(startDate)} til ${formatDate(endDate)}`,
        group_info: groupInfo,
        echo_info: generic_echo,
        verv_1: getVervText(1),
        verv_2: getVervText(2),
        verv_3: getVervText(3),
        signature_photo_1: signaturePerson1.photo,
        signature_photo_2: signaturePerson2.photo,
        signature_name_1: signaturePerson1.name,
        signature_name_2: signaturePerson2.name,
        signature_role_1: signaturePerson1.role,
        signature_role_2: signaturePerson2.role,
        signature_phone_1: signaturePerson1.phone,
        signature_phone_2: signaturePerson2.phone,
        qr_code: `${fullURL}`,
        qr_info: `Scan for å verifisere`,
        qr_page: `${basePageURL}`,
    }];
};

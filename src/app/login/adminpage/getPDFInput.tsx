import {baseURL, generateURL} from "./generateURL";
import {fallbackValues, getGroupInfo, getOrganizationInfo, getSignatureInfo} from "@/app/util/databaseInteractions/fetchInfo";
import {formatDate} from "@/app/util/formatDate";
import {Volunteer} from '@/app/util/Volunteer'
import {Certificate} from '@/app/login/adminpage/Certificate'

export const getPdfInput = async (volunteer: Volunteer): Promise<Certificate[]> => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    const yyyy = today.getFullYear();
    const name = volunteer.personName;
    const fullURL = generateURL(volunteer);
    const basePageURL = baseURL();

    // Default values
    let groupInfo = fallbackValues.groups[volunteer.groupName] || `Information about ${volunteer.groupName}`;
    let generic_echo = fallbackValues.organization.generic_text;
    let signaturePerson1 = fallbackValues.signatures[0];
    let signaturePerson2 = fallbackValues.signatures[1];

    try {
        const [groupDescriptions, organizationInfo, signatories] = await Promise.all([
            getGroupInfo(),
            getOrganizationInfo(),
            getSignatureInfo()
        ]);

        if (volunteer.groupName && groupDescriptions[volunteer.groupName]) {
            groupInfo = groupDescriptions[volunteer.groupName];
        }

        if (organizationInfo.generic_text) {
            generic_echo = organizationInfo.generic_text;
        }

        if (signatories.length >= 1) {
            signaturePerson1 = signatories[0];
        }

        if (signatories.length >= 2) {
            signaturePerson2 = signatories[1];
        }
    } catch (error) {
        console.error('Error fetching content for certificate:', error);
    }

    const getVervText = (index: number) => {
        if (volunteer.extraRole && volunteer.extraRole.length > index) {
            const role = volunteer.extraRole[index];
            if (role.role && role.groupName && role.startDate && role.endDate) {
                return `${name} har og hatt en stilling som ${role.role} i ${role.groupName} fra ${formatDate(role.startDate)} til ${formatDate(role.endDate)}`;
            }
        }
        return '';
    };

    return [{
        signature_date: dd + '.' + mm + '.' + yyyy,
        student_name_date: `Attest til ${name}`,
        student_role: `${name} har vært ${volunteer.role} i ${volunteer.groupName} fra ${formatDate(volunteer.startDate)} til ${formatDate(volunteer.endDate)}`,
        group_info: groupInfo,
        echo_info: generic_echo,
        verv_1: getVervText(0),
        verv_2: getVervText(1),
        verv_3: getVervText(2),
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
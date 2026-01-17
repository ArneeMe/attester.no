// app/util/insertData.ts
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/app/firebase/fb_config';
import { GroupInfo, OrganizationInfo, SignatureInfo } from '@/app/pdfinfo/pdfTypes';

export const updateGroupInfo = async (groups: GroupInfo): Promise<void> => {
    await setDoc(doc(db, 'sitecontent', 'groupDescriptions'), groups);
};

export const updateSignatureInfo = async (signatures: SignatureInfo[]): Promise<void> => {
    await setDoc(doc(db, 'sitecontent', 'signatureInfo'), {
        signatories: signatures,
    });
};

export const updateOrganizationInfo = async (organization: OrganizationInfo): Promise<void> => {
    await setDoc(doc(db, 'sitecontent', 'organizationInfo'), organization);
};
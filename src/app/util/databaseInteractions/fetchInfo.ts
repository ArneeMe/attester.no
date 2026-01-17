import {doc, getDoc} from 'firebase/firestore';
import {db} from '@/app/firebase/fb_config';
import {ContentCache, GroupInfo, OrganizationInfo, SignatureInfo} from '../../pdfinfo/pdfTypes';
import {generic_echo, undergrupper} from "@/app/pdfinfo/echoInfo";
import {signaturePerson1, signaturePerson2} from "@/app/pdfinfo/signatureInfo";


const contentCache: ContentCache = {
    groups: null,
    signatures: null,
    organization: null,
    lastFetched: {
        groups: null,
        signatures: null,
        organization: null,
    },
};

//(15 minutes)
const CACHE_DURATION = 15 * 60 * 1000;


const isCacheValid = (type: 'groups' | 'signatures' | 'organization'): boolean => {
    const lastFetched = contentCache.lastFetched[type];
    if (!lastFetched) return false;

    const now = new Date();
    return now.getTime() - lastFetched.getTime() < CACHE_DURATION;
};

export const getGroupInfo = async (): Promise<GroupInfo> => {
    if (contentCache.groups && isCacheValid('groups')) {
        return contentCache.groups;
    }

    try {
        const docRef = doc(db, 'sitecontent', 'groupDescriptions');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as GroupInfo;
            contentCache.groups = data;
            contentCache.lastFetched.groups = new Date();

            return data;
        } else {
            console.warn('No group descriptions document found');
            return {};
        }
    } catch (error) {
        console.error('Error fetching group descriptions:', error);
        return contentCache.groups || {};
    }
};

export const getSignatureInfo = async (): Promise<SignatureInfo[]> => {
    if (contentCache.signatures && isCacheValid('signatures')) {
        return contentCache.signatures;
    }

    try {
        const docRef = doc(db, 'sitecontent', 'signatureInfo');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {

            const data = docSnap.data();
            const signatories: SignatureInfo[] = [];

            if (Array.isArray(data.signatories)) {

                signatories.push(...data.signatories);
            } else {
                // If stored as separate fields (signatory1, signatory2, etc.)
                for (let i = 1; data[`signatory${i}`]; i++) {
                    signatories.push(data[`signatory${i}`]);
                }
            }

            // Update cache
            contentCache.signatures = signatories;
            contentCache.lastFetched.signatures = new Date();

            return signatories;
        } else {
            console.warn('No signatories document found');
            return [];
        }
    } catch (error) {
        console.error('Error fetching signatories:', error);
        // Return cached data even if expired, as fallback
        return contentCache.signatures || [];
    }
};

// Fetch organization information
export const getOrganizationInfo = async (): Promise<OrganizationInfo> => {
    if (contentCache.organization && isCacheValid('organization')) {
        return contentCache.organization;
    }

    try {
        const docRef = doc(db, 'sitecontent', 'organizationInfo');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as OrganizationInfo;
            console.log(data)

            // Update cache
            contentCache.organization = data;
            contentCache.lastFetched.organization = new Date();

            return data;
        } else {
            console.warn('No organization info document found');
            return {generic_text: ''};
        }
    } catch (error) {
        console.error('Error fetching organization info:', error);
        return contentCache.organization || {generic_text: ''};
    }
};

export const fallbackValues: {
    groups: { [key: string]: string };
    organization: { generic_text: string };
    signatures: Array<{ photo: string; name: string; role: string; phone: string }>;
} = {
    groups: undergrupper,

    organization: {
        generic_text: generic_echo
    },
    signatures: [signaturePerson1, signaturePerson2]
};
export interface GroupInfo {
    [key: string]: string;
}

export interface SignatureInfo {
    photo: string;
    name: string;
    role: string;
    phone: string;
}

export interface OrganizationInfo {
    generic_text: string;
}

export interface ContentCache {
    groups: GroupInfo | null;
    signatures: SignatureInfo[] | null;
    organization: OrganizationInfo | null;
    lastFetched: {
        groups: Date | null;
        signatures: Date | null;
        organization: Date | null;
    };
}
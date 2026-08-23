export type Submission = {
    id: string;
    organizationId: string;
    templateId: string;
    data: Record<string, string>;
    createdAt: Date;
    /**
     * When the certificate was issued, or null if it hasn't been. This is
     * the deletion clock: the retention sweep only removes rows where it is
     * set and older than the window. Unissued submissions wait for the admin
     * indefinitely (see src/util/retention.ts).
     */
    issuedAt: Date | null;
};

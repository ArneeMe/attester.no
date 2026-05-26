export type Submission = {
    id: string;
    organizationId: string;
    templateId: string;
    data: Record<string, string>;
    createdAt: Date;
};

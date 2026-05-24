import OrgSubmissionForm from "@/app/orgSubmissionForm";

export const runtime = 'edge';

export default async function OrgFormPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;
    return <OrgSubmissionForm orgSlug={orgSlug} />;
}

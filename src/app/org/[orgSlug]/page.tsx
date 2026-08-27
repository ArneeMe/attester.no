import OrgSubmissionForm from "@/app/orgSubmissionForm";
import { getOrgNameBySlug } from "@/lib/server/orgs";

export const runtime = 'edge';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;
    const name = await getOrgNameBySlug(orgSlug).catch(() => null);
    return { title: name ? `Attestskjema for ${name}` : 'Attestskjema' };
}

export default async function OrgFormPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;
    return <OrgSubmissionForm orgSlug={orgSlug} />;
}

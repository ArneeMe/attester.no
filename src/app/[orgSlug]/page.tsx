import VolunteerForm from "@/app/volunteerForm";

export default async function OrgFormPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;
    return <VolunteerForm orgSlug={orgSlug} />;
}

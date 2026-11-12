import OrgVerifyClient from './OrgVerifyClient';
import { getOrgNameBySlug } from '@/lib/server/orgs';

export const runtime = 'edge';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;
    const name = await getOrgNameBySlug(orgSlug).catch(() => null);
    return { title: name ? `Verifiser attest for ${name}` : 'Verifiser attest' };
}

export default function OrgVerifyPage() {
    return <OrgVerifyClient />;
}

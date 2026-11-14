import StatusClient from './StatusClient';
import PageShell from '@/components/landing/PageShell';

export const runtime = 'edge';

// The link holds a secret after the "#". It must never be indexed or shared
// by a preview, and the page must send no referrer onwards.
export const metadata = {
    title: 'Status for forespørselen',
    robots: { index: false, follow: false },
    referrer: 'no-referrer' as const,
};

export default async function StatusPage({
    params,
    searchParams,
}: {
    params: Promise<{ orgSlug: string }>;
    searchParams: Promise<{ lang?: string }>;
}) {
    const { orgSlug } = await params;
    const { lang } = await searchParams;
    return (
        <PageShell lang={lang}>
            <StatusClient orgSlug={orgSlug} lang={lang} />
        </PageShell>
    );
}

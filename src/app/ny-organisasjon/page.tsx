import React from 'react';
import { Box } from '@mui/material';
import { getStrings, normalizeLang } from '@/strings';
import { publicPageMetadata } from '@/util/seo';
import PageShell from '@/components/landing/PageShell';
import { gutter } from '@/app/style/tokens';
import RequestOrgForm from './RequestOrgForm';

export const runtime = 'edge';

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const { lang } = await searchParams;
    const s = getStrings(lang).requestOrg;
    return publicPageMetadata('/ny-organisasjon', lang, s.metaTitle, s.lede);
}

export default async function RequestOrgPage({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const { lang } = await searchParams;
    return (
        <PageShell lang={lang}>
            <Box sx={{ px: gutter, py: { xs: 4, md: 6 } }}>
                <RequestOrgForm lang={normalizeLang(lang)} />
            </Box>
        </PageShell>
    );
}

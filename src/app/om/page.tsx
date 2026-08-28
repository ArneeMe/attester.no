import React from 'react';
import Link from 'next/link';
import { Box } from '@mui/material';
import { getStrings } from '@/strings';
import JsonLd from '@/components/JsonLd';
import { publicPageMetadata } from '@/util/seo';
import { fontSerif } from '@/app/style/landingFonts';
import PageShell from '@/components/landing/PageShell';
import SplitSection from '@/components/landing/SplitSection';
import { body, c, dividedRows, gutter, h2, lede } from '@/components/landing/tokens';

export const runtime = 'edge';

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const { lang } = await searchParams;
    const s = getStrings(lang).about;
    return publicPageMetadata('/om', lang, s.metaTitle, s.intro);
}

const NumberedSteps: React.FC<{ steps: string[] }> = ({ steps }) => (
    <Box component="ol" sx={{ ...dividedRows, listStyle: 'none', m: 0, p: 0 }}>
        {steps.map((step, i) => (
            <Box
                component="li"
                key={step}
                sx={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 2 }}
            >
                <Box aria-hidden sx={{ font: `400 20px/1.3 ${fontSerif}`, color: c.accent }}>
                    {i + 1}
                </Box>
                <Box sx={{ ...body, fontSize: 14.5 }}>{step}</Box>
            </Box>
        ))}
    </Box>
);

export default async function AboutPage({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const { lang } = await searchParams;
    const s = getStrings(lang).about;
    const withLang = (path: string) => (lang === 'en' ? `${path}?lang=en` : path);

    const faq = [
        { q: s.flowTitle, a: s.flowSteps.join(' ') },
        { q: s.hashTitle, a: `${s.hashBody} ${s.hashConsequence}` },
        { q: s.verifyTitle, a: s.verifySteps.join(' ') },
    ];

    return (
        <PageShell lang={lang}>
            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'FAQPage',
                    mainEntity: faq.map((f) => ({
                        '@type': 'Question',
                        name: f.q,
                        acceptedAnswer: { '@type': 'Answer', text: f.a },
                    })),
                }}
            />

            <Box
                component="section"
                sx={{
                    px: gutter,
                    pt: { xs: 6, md: 9 },
                    pb: { xs: 5, md: 7 },
                    borderBottom: `1px solid ${c.rule}`,
                }}
            >
                <Box sx={{ maxWidth: 640 }}>
                    <Box
                        component="h1"
                        sx={{
                            m: 0,
                            font: `400 clamp(30px, 3.6vw, 40px)/1.15 ${fontSerif}`,
                            letterSpacing: '-0.01em',
                        }}
                    >
                        {s.title}
                    </Box>
                    <Box component="p" sx={{ ...lede, mt: 3, mb: 0 }}>
                        {s.intro}
                    </Box>
                </Box>
            </Box>

            <SplitSection
                py={5.5}
                left={
                    <>
                        <Box component="h2" sx={h2}>
                            {s.flowTitle}
                        </Box>
                        <Box sx={{ mt: 2.5 }}>
                            <NumberedSteps steps={s.flowSteps} />
                        </Box>
                    </>
                }
                right={
                    <>
                        <Box component="h2" sx={h2}>
                            {s.verifyTitle}
                        </Box>
                        <Box sx={{ mt: 2.5 }}>
                            <NumberedSteps steps={s.verifySteps} />
                        </Box>
                    </>
                }
            />

            <Box
                component="section"
                sx={{ px: gutter, py: 5, borderBottom: `1px solid ${c.rule}` }}
            >
                <Box sx={{ maxWidth: 720 }}>
                    <Box component="h2" sx={h2}>
                        {s.hashTitle}
                    </Box>
                    <Box component="p" sx={{ ...body, mt: 1.5, mb: 2.5 }}>
                        {s.hashBody}
                    </Box>
                    <Box
                        component="p"
                        sx={{
                            ...body,
                            m: 0,
                            pl: 2.5,
                            borderLeft: `2px solid ${c.accent}`,
                            color: c.inkMuted,
                        }}
                    >
                        {s.hashConsequence}
                    </Box>
                </Box>
            </Box>

            <Box
                component="section"
                sx={{ px: gutter, py: 5, borderBottom: `1px solid ${c.rule}` }}
            >
                <Box component="h2" sx={h2}>
                    {s.contactTitle}
                </Box>
                <Box component="p" sx={{ ...body, mt: 1.25, mb: 1.75 }}>
                    {s.contactBody}{' '}
                    <Box
                        component="a"
                        href="https://github.com/ArneeMe/attester.no"
                        target="_blank"
                        rel="noreferrer"
                        sx={{ color: c.accent }}
                    >
                        GitHub ↗
                    </Box>
                    .
                </Box>
                <Box
                    component={Link}
                    href={withLang('/')}
                    sx={{ fontSize: 14.5, color: c.accent }}
                >
                    {s.backToFront}
                </Box>
            </Box>
        </PageShell>
    );
}

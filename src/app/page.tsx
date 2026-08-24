import React from 'react';
import Link from 'next/link';
import { Box, GlobalStyles } from '@mui/material';
import { listPublicOrgs, type PublicOrg } from '@/lib/server/orgs';
import { getStrings } from '@/strings';
import JsonLd from '@/components/JsonLd';
import { publicPageMetadata, SITE_URL } from '@/util/seo';
import { fontBody, fontSerif, landingFontClass } from '@/app/style/landingFonts';
import LandingHeader from '@/components/landing/LandingHeader';
import OrgPicker from '@/components/landing/OrgPicker';
import SplitSection from '@/components/landing/SplitSection';
import VerifyLinkForm from '@/components/landing/VerifyLinkForm';
import { body, c, dividedRows, gutter, h2, lede, mono, pageMaxWidth } from '@/components/landing/tokens';

export const runtime = 'edge';

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const { lang } = await searchParams;
    return publicPageMetadata('/', lang, undefined, getStrings(lang).landing.tagline);
}

export default async function Home({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const { lang } = await searchParams;
    const s = getStrings(lang).landing;
    const withLang = (path: string) => (lang === 'en' ? `${path}?lang=en` : path);

    let orgs: PublicOrg[] = [];
    let orgsFailed = false;
    try {
        orgs = await listPublicOrgs();
    } catch {
        orgsFailed = true;
    }

    return (
        <Box
            className={landingFontClass}
            sx={{ minHeight: '100vh', background: c.paper, color: c.ink, fontFamily: fontBody }}
        >
            {/* The app ships no CssBaseline, so body keeps the browser's 8px
                margin — which shows as a white gutter around a full-bleed
                page. Scoped here rather than reset globally, since every
                other screen is a centred Container that relies on it. */}
            <GlobalStyles styles={{ body: { margin: 0, background: c.paper } }} />

            <JsonLd
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'WebSite',
                    name: 'attester.no',
                    url: SITE_URL,
                    description: s.tagline,
                    inLanguage: ['nb-NO', 'en'],
                }}
            />

            <Box sx={{ maxWidth: pageMaxWidth, mx: 'auto' }}>
                <LandingHeader adminLogin={s.adminLogin} lang={lang} />

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
                                font: `400 clamp(32px, 4vw, 44px)/1.15 ${fontSerif}`,
                                letterSpacing: '-0.01em',
                            }}
                        >
                            {s.heroTitle}
                        </Box>
                        <Box component="p" sx={{ ...lede, mt: 3, mb: 0 }}>
                            {s.heroLede}
                        </Box>
                    </Box>
                </Box>

                <SplitSection
                    py={5.5}
                    left={
                        <>
                            <Box component="ol" sx={{ ...dividedRows, listStyle: 'none', m: 0, p: 0 }}>
                                {s.steps.map((step) => (
                                    <Box
                                        component="li"
                                        key={step.numeral}
                                        sx={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 2 }}
                                    >
                                        <Box
                                            aria-hidden
                                            sx={{ font: `400 20px/1.3 ${fontSerif}`, color: c.accent }}
                                        >
                                            {step.numeral}
                                        </Box>
                                        <Box>
                                            <Box sx={{ fontSize: 16, fontWeight: 500 }}>{step.title}</Box>
                                            <Box component="p" sx={{ ...body, mt: 0.75, mb: 0 }}>
                                                {step.text}
                                            </Box>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>

                            <Box sx={{ mt: 5, pt: 3.5, borderTop: `1px solid ${c.ruleSoft}` }}>
                                <Box component="h2" sx={h2}>
                                    {s.forOrgsTitle}
                                </Box>
                                <Box component="p" sx={{ ...body, mt: 1.25, mb: 1.75 }}>
                                    {s.forOrgsBody}
                                </Box>
                                <Box
                                    component="a"
                                    href="mailto:hei@attester.no"
                                    sx={{ fontSize: 14.5, color: c.accent }}
                                >
                                    hei@attester.no
                                </Box>
                            </Box>
                        </>
                    }
                    right={
                        <OrgPicker
                            orgs={orgs}
                            failed={orgsFailed}
                            lang={lang}
                            t={{
                                search: s.orgsSearch,
                                count: s.orgsCount(orgs.length),
                                cta: s.orgsCta,
                                empty: s.orgsEmpty,
                                failed: s.orgsFailed,
                            }}
                        />
                    }
                />

                <SplitSection
                    py={5}
                    left={
                        <VerifyLinkForm
                            t={{
                                title: s.verifyTitle,
                                body: s.verifyBody,
                                placeholder: s.verifyPlaceholder,
                                submit: s.verifySubmit,
                                error: s.verifyError,
                            }}
                        />
                    }
                    right={
                        <Box component="dl" sx={{ ...dividedRows, m: 0 }}>
                            {s.faq.map((item) => (
                                <Box key={item.q}>
                                    <Box component="dt" sx={{ fontSize: 15, fontWeight: 500 }}>
                                        {item.q}
                                    </Box>
                                    <Box
                                        component="dd"
                                        sx={{ ...body, fontSize: 14, mt: 0.75, mx: 0, mb: 0 }}
                                    >
                                        {item.a}
                                    </Box>
                                </Box>
                            ))}
                            <Box sx={{ fontSize: 14, lineHeight: 1.6 }}>
                                <Box component={Link} href={withLang('/om')} sx={{ color: c.accent }}>
                                    {s.aboutLink}
                                </Box>
                            </Box>
                        </Box>
                    }
                />

                <Box
                    component="footer"
                    sx={{
                        ...mono,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 2,
                        px: gutter,
                        py: 2.5,
                    }}
                >
                    <span>attester.no</span>
                    <Box component="a" href="mailto:hei@attester.no" sx={{ color: 'inherit' }}>
                        hei@attester.no
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

import Link from 'next/link';
import {
    Box, Chip, Container, Paper, Stack, Typography,
} from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { listPublicOrgs, type PublicOrg } from '@/lib/server/orgs';
import { getStrings } from '@/strings';
import PublicShell from '@/components/PublicShell';
import JsonLd from '@/components/JsonLd';
import { publicPageMetadata, SITE_URL } from '@/util/seo';

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
    try {
        orgs = await listPublicOrgs();
    } catch {
        // Directory is a nice-to-have — the landing page must render even
        // if the database is unreachable.
    }

    return (
        <PublicShell lang={lang}>
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

            {/* Hero */}
            <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                <Container maxWidth="md" sx={{ py: { xs: 8, md: 12 }, textAlign: 'center' }}>
                    <Typography variant="h2" component="h1" gutterBottom>
                        attester
                        <Box component="span" sx={{ color: 'primary.main' }}>.no</Box>
                    </Typography>
                    <Typography
                        variant="h5"
                        component="p"
                        color="text.secondary"
                        sx={{ maxWidth: 620, mx: 'auto', lineHeight: 1.5 }}
                    >
                        {s.tagline}
                    </Typography>
                </Container>
            </Box>

            <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}>
                <Stack spacing={{ xs: 6, md: 8 }}>
                    {/* The three steps */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
                        {s.steps.map((step, i) => (
                            <Paper
                                key={step.title}
                                variant="outlined"
                                sx={{ p: 3, flex: 1, bgcolor: 'background.paper' }}
                            >
                                <Box
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        fontWeight: 700,
                                        mb: 2,
                                    }}
                                >
                                    {i + 1}
                                </Box>
                                <Typography variant="subtitle1" gutterBottom>
                                    {step.title.replace(/^\d+\.\s*/, '')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {step.text}
                                </Typography>
                            </Paper>
                        ))}
                    </Stack>

                    {/* Privacy card */}
                    <Paper
                        variant="outlined"
                        sx={{
                            p: { xs: 3, md: 4 },
                            borderLeft: 4,
                            borderLeftColor: 'primary.main',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                            <ShieldOutlinedIcon color="primary" />
                            <Typography variant="h6" component="h2">{s.privacyTitle}</Typography>
                        </Box>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                            {s.privacyBody}
                        </Typography>
                        <Link href={withLang('/om')} style={{ fontSize: '0.9rem' }}>
                            {s.aboutLink}
                        </Link>
                    </Paper>

                    {/* Org directory */}
                    {orgs.length > 0 && (
                        <Box>
                            <Typography variant="h6" component="h2" gutterBottom>{s.orgsTitle}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {s.orgsSubtitle}
                            </Typography>
                            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
                                {orgs.map((org) => (
                                    <Chip
                                        key={org.slug}
                                        label={org.name}
                                        component={Link}
                                        href={withLang(`/org/${encodeURIComponent(org.slug)}`)}
                                        clickable
                                        variant="outlined"
                                        sx={{ px: 0.5, py: 2.25, fontSize: '0.9rem' }}
                                    />
                                ))}
                            </Stack>
                        </Box>
                    )}

                    {/* Contact prompt */}
                    <Typography variant="body2" color="text.secondary">
                        {s.contactPrompt}{' '}
                        <Link href="https://github.com/ArneeMe/attester.no" target="_blank" rel="noreferrer">
                            {s.contactLink}
                        </Link>.
                    </Typography>
                </Stack>
            </Container>
        </PublicShell>
    );
}

import Link from 'next/link';
import {
    Box, Container, Divider, Grid, Paper, Stack, Typography,
} from '@mui/material';
import { getStrings } from '@/strings';
import PublicShell from '@/components/PublicShell';
import JsonLd from '@/components/JsonLd';
import { publicPageMetadata } from '@/util/seo';

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
        { q: s.storedTitle, a: `${s.storedIntro} ${s.storedItems.join('; ')}. ${s.neverStoredIntro} ${s.neverStoredItems.join('; ')}.` },
        { q: s.hashTitle, a: `${s.hashBody} ${s.hashConsequence}` },
        { q: s.verifyTitle, a: s.verifySteps.join(' ') },
    ];

    return (
        <PublicShell lang={lang}>
        <Container maxWidth="md" sx={{ py: 6 }}>
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
            <Stack spacing={4}>
                <Typography variant="h3" component="h1">{s.title}</Typography>

                <Typography variant="h6" component="p" color="text.secondary">
                    {s.intro}
                </Typography>

                <Box>
                    <Typography variant="h5" gutterBottom>{s.flowTitle}</Typography>
                    <Typography component="ol" variant="body1" sx={{ pl: 3, '& li': { mb: 1 } }}>
                        {s.flowSteps.map((step) => <li key={step}>{step}</li>)}
                    </Typography>
                </Box>

                <Box>
                    <Typography variant="h5" gutterBottom>{s.storedTitle}</Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Paper elevation={0} sx={{ p: 3, height: '100%', bgcolor: 'success.light' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                                    {s.storedIntro}
                                </Typography>
                                <Typography component="ul" variant="body2" sx={{ pl: 3, '& li': { mb: 0.5 } }}>
                                    {s.storedItems.map((item) => <li key={item}>{item}</li>)}
                                </Typography>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Paper elevation={0} sx={{ p: 3, height: '100%', bgcolor: 'grey.100' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                                    {s.neverStoredIntro}
                                </Typography>
                                <Typography component="ul" variant="body2" sx={{ pl: 3, '& li': { mb: 0.5 } }}>
                                    {s.neverStoredItems.map((item) => <li key={item}>{item}</li>)}
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>

                <Box>
                    <Typography variant="h5" gutterBottom>{s.hashTitle}</Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>{s.hashBody}</Typography>
                    <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50' }}>
                        <Typography variant="body1">{s.hashConsequence}</Typography>
                    </Paper>
                </Box>

                <Box>
                    <Typography variant="h5" gutterBottom>{s.verifyTitle}</Typography>
                    <Typography component="ol" variant="body1" sx={{ pl: 3, '& li': { mb: 1 } }}>
                        {s.verifySteps.map((step) => <li key={step}>{step}</li>)}
                    </Typography>
                </Box>

                <Divider />

                <Box>
                    <Typography variant="h6" gutterBottom>{s.contactTitle}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {s.contactBody}{' '}
                        <Link href="https://github.com/ArneeMe/attester.no" target="_blank" rel="noreferrer">
                            GitHub ↗
                        </Link>
                    </Typography>
                    <Link href={withLang('/')}>{s.backToFront}</Link>
                </Box>
            </Stack>
        </Container>
        </PublicShell>
    );
}

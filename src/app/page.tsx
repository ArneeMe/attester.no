import Link from 'next/link';
import {
    Box, Button, Chip, Container, Divider, Paper, Stack, Typography,
} from '@mui/material';
import { listPublicOrgs, type PublicOrg } from '@/lib/server/orgs';
import { getStrings } from '@/strings';
import LanguageToggle from '@/components/LanguageToggle';

export const runtime = 'edge';

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
        <Container maxWidth="md" sx={{ py: 8 }}>
            <Stack spacing={6}>
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 2 }}>
                        <Typography variant="h2" component="h1" gutterBottom>
                            attester.no
                        </Typography>
                        <LanguageToggle />
                    </Box>
                    <Typography variant="h5" color="text.secondary">
                        {s.tagline}
                    </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    {s.steps.map((step) => (
                        <Paper key={step.title} elevation={2} sx={{ p: 3, flex: 1 }}>
                            <Typography variant="h6" gutterBottom>{step.title}</Typography>
                            <Typography variant="body2" color="text.secondary">{step.text}</Typography>
                        </Paper>
                    ))}
                </Stack>

                <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50' }}>
                    <Typography variant="h6" gutterBottom>{s.privacyTitle}</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                        {s.privacyBody}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        <Link href={withLang('/om')}>{s.aboutLink}</Link>
                        <Link href={withLang('/personvern')}>{s.privacyLink}</Link>
                    </Box>
                </Paper>

                {orgs.length > 0 && (
                    <Box>
                        <Typography variant="h6" gutterBottom>{s.orgsTitle}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {s.orgsSubtitle}
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {orgs.map((org) => (
                                <Chip
                                    key={org.slug}
                                    label={org.name}
                                    component={Link}
                                    href={withLang(`/org/${encodeURIComponent(org.slug)}`)}
                                    clickable
                                />
                            ))}
                        </Stack>
                    </Box>
                )}

                <Divider />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <Button component={Link} href="/login" variant="outlined">
                        {s.adminLogin}
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                        {s.contactPrompt}{' '}
                        <Link href="https://github.com/ArneeMe/attester.no" target="_blank" rel="noreferrer">
                            {s.contactLink}
                        </Link>.
                    </Typography>
                </Stack>
            </Stack>
        </Container>
    );
}

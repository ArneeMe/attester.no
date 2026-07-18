import Link from 'next/link';
import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import { getStrings } from '@/strings';
import PublicShell from '@/components/PublicShell';
import { publicPageMetadata } from '@/util/seo';

export const runtime = 'edge';

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const { lang } = await searchParams;
    const s = getStrings(lang).privacy;
    return publicPageMetadata('/personvern', lang, s.metaTitle, s.sections[1]?.body ?? s.title);
}

export default async function PrivacyPage({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const { lang } = await searchParams;
    const s = getStrings(lang).privacy;
    const withLang = (path: string) => (lang === 'en' ? `${path}?lang=en` : path);

    return (
        <PublicShell lang={lang}>
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Stack spacing={4}>
                <Typography variant="h3" component="h1">{s.title}</Typography>
                <Typography variant="body2" color="text.secondary">{s.updated}</Typography>

                {s.sections.map((section) => (
                    <Box key={section.heading}>
                        <Typography variant="h5" gutterBottom>{section.heading}</Typography>
                        <Typography variant="body1" color="text.secondary">{section.body}</Typography>
                    </Box>
                ))}

                <Divider />

                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {s.seeAlso}{' '}
                        <Link href={withLang('/om')}>{s.seeAlsoLink}</Link>
                    </Typography>
                    <Link href={withLang('/')}>{s.backToFront}</Link>
                </Box>
            </Stack>
        </Container>
        </PublicShell>
    );
}

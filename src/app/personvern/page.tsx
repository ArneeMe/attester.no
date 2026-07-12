import Link from 'next/link';
import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import { getStrings } from '@/strings';
import LanguageToggle from '@/components/LanguageToggle';

export const runtime = 'edge';

export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ lang?: string }>;
}) {
    const { lang } = await searchParams;
    return { title: getStrings(lang).privacy.metaTitle };
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
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Stack spacing={4}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 2 }}>
                    <Typography variant="h3" component="h1">{s.title}</Typography>
                    <LanguageToggle />
                </Box>
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
    );
}

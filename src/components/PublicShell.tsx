import Link from 'next/link';
import { Box, Container, Divider, Typography } from '@mui/material';
import LanguageToggle from '@/components/LanguageToggle';
import { getStrings } from '@/strings';

/**
 * Shared chrome for the public marketing/info pages (landing, /om): a slim
 * wordmark header with the language toggle, and a footer with the standard
 * links. The org-branded pages (form, verify) keep their own headers — the
 * org's identity should lead there, not ours.
 */

const withLang = (path: string, lang?: string | null) =>
    lang === 'en' ? `${path}?lang=en` : path;

export function PublicHeader({ lang }: { lang?: string | null }) {
    return (
        <Box component="header" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Container maxWidth="md" sx={{ py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Typography
                    component={Link}
                    href={withLang('/', lang)}
                    variant="h6"
                    sx={{ color: 'text.primary', textDecoration: 'none', letterSpacing: '-0.01em' }}
                >
                    attester<Box component="span" sx={{ color: 'primary.main' }}>.no</Box>
                </Typography>
                <LanguageToggle />
            </Container>
        </Box>
    );
}

export function PublicFooter({ lang }: { lang?: string | null }) {
    const s = getStrings(lang);
    return (
        <Box component="footer" sx={{ mt: 'auto', bgcolor: 'background.paper' }}>
            <Container maxWidth="md" sx={{ py: 4 }}>
                <Divider sx={{ mb: 3 }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 4 }, alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                        attester.no
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 3 }, fontSize: '0.875rem' }}>
                        <Link href={withLang('/om', lang)}>{s.about.metaTitle}</Link>
                        <Link href="/login">{s.landing.adminLogin}</Link>
                        <Link href="https://github.com/ArneeMe/attester.no" target="_blank" rel="noreferrer">
                            GitHub ↗
                        </Link>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}

export default function PublicShell({
    lang,
    children,
}: {
    lang?: string | null;
    children: React.ReactNode;
}) {
    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <PublicHeader lang={lang} />
            <Box component="main" sx={{ flex: 1 }}>
                {children}
            </Box>
            <PublicFooter lang={lang} />
        </Box>
    );
}

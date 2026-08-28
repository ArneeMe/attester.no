import React from 'react';
import { Box, GlobalStyles } from '@mui/material';
import { getStrings } from '@/strings';
import { fontBody, landingFontClass } from '@/app/style/landingFonts';
import LandingHeader from './LandingHeader';
import { c, gutter, mono, pageMaxWidth } from './tokens';

type Props = { lang?: string; children: React.ReactNode };

const PageShell: React.FC<Props> = ({ lang, children }) => (
    <Box
        className={landingFontClass}
        sx={{ minHeight: '100vh', background: c.paper, color: c.ink, fontFamily: fontBody }}
    >
        {/* The app ships no CssBaseline and no global stylesheet, so body keeps
            the browser's 8px margin — a white gutter around a full-bleed page.
            Scoped here rather than reset globally, since every other screen is
            a centred Container that relies on it. */}
        <GlobalStyles styles={{ body: { margin: 0, background: c.paper } }} />

        <Box sx={{ maxWidth: pageMaxWidth, mx: 'auto' }}>
            <LandingHeader lang={lang} adminLogin={getStrings(lang).landing.adminLogin} />
            {children}
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

export default PageShell;

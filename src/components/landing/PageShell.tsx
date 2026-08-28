import React from 'react';
import { Box } from '@mui/material';
import { getStrings } from '@/strings';
import LandingHeader from './LandingHeader';
import { c, gutter, mono, pageMaxWidth } from '@/app/style/tokens';

type Props = { lang?: string; children: React.ReactNode };

// The body margin reset and the paper background used to live here as scoped
// GlobalStyles, because the app shipped no CssBaseline. Both are now global:
// CssBaseline is mounted in src/app/style/rootLayout.tsx and paints
// palette.background.default, which is the same token.
const PageShell: React.FC<Props> = ({ lang, children }) => (
    <Box sx={{ minHeight: '100vh', background: c.paper, color: c.ink }}>
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

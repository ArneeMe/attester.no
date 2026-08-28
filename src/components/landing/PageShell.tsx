import React from 'react';
import { Box } from '@mui/material';
import { getStrings } from '@/strings';
import LandingHeader from './LandingHeader';
import { c, gutter, mono, pageMaxWidth } from '@/app/style/tokens';

type Props = { lang?: string; children: React.ReactNode };

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

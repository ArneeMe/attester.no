import React from 'react';
import { Box } from '@mui/material';
import SiteHeader from './SiteHeader';
import { c, gutter, pageMaxWidth } from '@/app/style/tokens';

type Props = { right?: React.ReactNode; children: React.ReactNode };

const SignedInShell: React.FC<Props> = ({ right, children }) => (
    <Box sx={{ minHeight: '100vh', background: c.paper, color: c.ink }}>
        <Box sx={{ maxWidth: pageMaxWidth, mx: 'auto' }}>
            <SiteHeader>{right}</SiteHeader>
            <Box component="main" sx={{ px: gutter, py: { xs: 3, md: 4 } }}>
                {children}
            </Box>
        </Box>
    </Box>
);

export default SignedInShell;

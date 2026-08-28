import React from 'react';
import { Box } from '@mui/material';
import { c, gutter } from '@/app/style/tokens';

type Props = { left: React.ReactNode; right: React.ReactNode; py: number };

const SplitSection: React.FC<Props> = ({ left, right, py }) => (
    <Box
        component="section"
        sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1px 1fr' },
            borderBottom: `1px solid ${c.rule}`,
        }}
    >
        <Box sx={{ px: gutter, py }}>{left}</Box>
        <Box aria-hidden sx={{ display: { xs: 'none', md: 'block' }, background: c.rule }} />
        <Box sx={{ px: gutter, py, borderTop: { xs: `1px solid ${c.rule}`, md: 'none' } }}>
            {right}
        </Box>
    </Box>
);

export default SplitSection;

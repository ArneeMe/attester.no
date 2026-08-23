import React from 'react';
import { Box } from '@mui/material';
import { gutter, landing } from './tokens';

type Props = {
    left: React.ReactNode;
    right: React.ReactNode;
    /** Vertical padding inside each cell, in MUI spacing units. */
    py: number;
};

/**
 * A full-width band split into two columns by a hairline rule.
 *
 * The rule is a 1px grid column rather than a border so that it spans the
 * full height of the taller cell — the design leans on that line reaching
 * edge to edge. Below `md` the columns stack and the rule becomes the top
 * border of the second cell.
 */
const SplitSection: React.FC<Props> = ({ left, right, py }) => (
    <Box
        component="section"
        sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1px 1fr' },
            borderBottom: `1px solid ${landing.rule}`,
        }}
    >
        <Box sx={{ px: gutter, py }}>{left}</Box>
        <Box
            aria-hidden
            sx={{ display: { xs: 'none', md: 'block' }, background: landing.rule }}
        />
        <Box
            sx={{
                px: gutter,
                py,
                borderTop: { xs: `1px solid ${landing.rule}`, md: 'none' },
            }}
        >
            {right}
        </Box>
    </Box>
);

export default SplitSection;

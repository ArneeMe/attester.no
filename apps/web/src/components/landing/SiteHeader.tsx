import React from 'react';
import { Box } from '@mui/material';
import Link from 'next/link';
import { fontSerif } from '@/app/style/landingFonts';
import { c, gutter } from '@/app/style/tokens';

type Props = { lang?: string; children: React.ReactNode };

export const headerLink = {
    color: c.ink,
    textDecoration: 'none',
    borderBottom: `1px solid ${c.borderStrong}`,
    pb: '2px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: c.borderStrong,
    font: 'inherit',
    p: 0,
    '&:hover': { borderBottomColor: c.ink },
} as const;

const SiteHeader: React.FC<Props> = ({ lang, children }) => (
    <Box
        component="header"
        sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: gutter,
            py: 2.25,
            borderBottom: `1px solid ${c.rule}`,
        }}
    >
        <Box
            component={Link}
            href={lang === 'en' ? '/?lang=en' : '/'}
            sx={{
                font: `600 17px/1 ${fontSerif}`,
                letterSpacing: '0.01em',
                color: c.ink,
                textDecoration: 'none',
            }}
        >
            attester.no
        </Box>

        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1.5, sm: 2.5 },
                fontSize: 13,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
            }}
        >
            {children}
        </Box>
    </Box>
);

export default SiteHeader;

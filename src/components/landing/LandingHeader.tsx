import React from 'react';
import { Box } from '@mui/material';
import Link from 'next/link';
import LanguageToggle from '@/components/LanguageToggle';
import { fontSerif } from '@/app/style/landingFonts';
import { c, gutter } from '@/app/style/tokens';

type Props = { adminLogin: string; lang?: string };

const LandingHeader: React.FC<Props> = ({ adminLogin, lang }) => (
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
            }}
        >
            <Box
                sx={{
                    '& a': { color: c.inkSoft, textDecorationColor: c.borderStrong },
                    '& a[aria-current]': { color: c.ink },
                }}
            >
                <LanguageToggle />
            </Box>
            <Box
                component={Link}
                href={lang === 'en' ? '/login?lang=en' : '/login'}
                sx={{
                    color: c.ink,
                    textDecoration: 'none',
                    borderBottom: `1px solid ${c.borderStrong}`,
                    pb: '2px',
                    whiteSpace: 'nowrap',
                    '&:hover': { borderBottomColor: c.ink },
                }}
            >
                {adminLogin}
            </Box>
        </Box>
    </Box>
);

export default LandingHeader;

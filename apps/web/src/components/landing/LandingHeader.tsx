import React from 'react';
import { Box } from '@mui/material';
import Link from 'next/link';
import LanguageToggle from '@/components/LanguageToggle';
import SiteHeader, { headerLink } from './SiteHeader';
import { c } from '@/app/style/tokens';

type Props = { adminLogin: string; lang?: string };

const LandingHeader: React.FC<Props> = ({ adminLogin, lang }) => (
    <SiteHeader lang={lang}>
        <Box
            sx={{
                '& a': { color: c.inkSoft, textDecorationColor: c.borderStrong },
                '& a[aria-current]': { color: c.ink },
            }}
        >
            <LanguageToggle />
        </Box>
        <Box component={Link} href={lang === 'en' ? '/login?lang=en' : '/login'} sx={headerLink}>
            {adminLogin}
        </Box>
    </SiteHeader>
);

export default LandingHeader;

'use client'
import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Box } from '@mui/material';
import { normalizeLang } from '@/strings';

/**
 * "Norsk | English" links that swap the ?lang= param on the current path.
 * URL-based so it works for server-rendered pages and shared links alike.
 */
const LanguageToggle: React.FC = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const lang = normalizeLang(searchParams.get('lang'));

    const href = (target: 'no' | 'en') => {
        const params = new URLSearchParams(searchParams.toString());
        if (target === 'no') params.delete('lang'); else params.set('lang', target);
        const qs = params.toString();
        return qs ? `${pathname}?${qs}` : pathname;
    };

    const style = (active: boolean): React.CSSProperties => ({
        fontSize: '0.875rem',
        fontWeight: active ? 700 : 400,
        textDecoration: active ? 'none' : 'underline',
    });

    return (
        <Box component="span" sx={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}>
            <Link href={href('no')} style={style(lang === 'no')} aria-current={lang === 'no' ? 'true' : undefined}>
                Norsk
            </Link>
            <span aria-hidden>|</span>
            <Link href={href('en')} style={style(lang === 'en')} aria-current={lang === 'en' ? 'true' : undefined}>
                English
            </Link>
        </Box>
    );
};

export default LanguageToggle;

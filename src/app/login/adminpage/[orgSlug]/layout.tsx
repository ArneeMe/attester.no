'use client'
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { usePathname } from 'next/navigation';
import { useCurrentOrg } from '@/app/login/adminpage/UserOrgsProvider';
import { useAdminLang } from '@/util/useAdminLang';
import { headerLink } from '@/components/landing/SiteHeader';
import { body, c, mono } from '@/app/style/tokens';

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const router = useRouter();
    const pathname = usePathname();
    const currentOrg = useCurrentOrg(orgSlug);
    const { lang, setLang, strings } = useAdminLang();

    useEffect(() => {
        if (currentOrg === null) {
            router.replace('/login/adminpage');
        }
    }, [currentOrg, router]);

    if (currentOrg === undefined) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                <CircularProgress />
            </Box>
        );
    }
    if (currentOrg === null) {
        return null;
    }

    const nav = strings.admin.nav;
    const items: Array<{ href: string; label: string }> = [
        { href: `/login/adminpage/${orgSlug}`, label: nav.oversikt },
        { href: `/login/adminpage/${orgSlug}/rediger`, label: nav.innhold },
        { href: `/login/adminpage/${orgSlug}/edit_pdf`, label: nav.pdfmal },
        { href: `/login/adminpage/${orgSlug}/maler`, label: nav.maler },
        { href: `/login/adminpage/${orgSlug}/medlemmer`, label: nav.medlemmer },
        { href: `/login/adminpage/${orgSlug}/utstedte`, label: nav.utstedte },
    ];

    return (
        <>
            <Box
                sx={{
                    mb: 3,
                    pb: 2,
                    borderBottom: `1px solid ${c.ruleSoft}`,
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2.5, flexWrap: 'wrap' }}>
                    <Box sx={{ ...mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {currentOrg.name}
                    </Box>
                    {items.map((item) => {
                        const active = pathname === item.href;
                        return (
                            <Box
                                key={item.href}
                                component={Link}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                sx={{
                                    ...body,
                                    fontSize: 14,
                                    textDecoration: 'none',
                                    color: active ? c.ink : c.inkSoft,
                                    fontWeight: active ? 600 : 400,
                                    borderBottom: `1px solid ${active ? c.ink : 'transparent'}`,
                                    pb: '2px',
                                    '&:hover': { color: c.ink },
                                }}
                            >
                                {item.label}
                            </Box>
                        );
                    })}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, fontSize: 13 }}>
                    <Box
                        component={Link}
                        href={`/org/${orgSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        sx={headerLink}
                    >
                        {nav.publicForm}
                    </Box>
                    <Box
                        component="button"
                        type="button"
                        onClick={() => setLang(lang === 'no' ? 'en' : 'no')}
                        aria-label="Bytt språk / switch language"
                        sx={headerLink}
                    >
                        {lang === 'no' ? 'EN' : 'NO'}
                    </Box>
                </Box>
            </Box>
            {children}
        </>
    );
}

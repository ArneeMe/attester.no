'use client'
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useCurrentOrg } from '@/app/login/adminpage/UserOrgsProvider';
import { useAdminLang } from '@/util/useAdminLang';

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const router = useRouter();
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
        { href: `/login/adminpage/${orgSlug}/tilbakemeldinger`, label: nav.tilbakemeldinger },
        { href: `/login/adminpage/${orgSlug}/utstedte`, label: nav.utstedte },
    ];

    return (
        <>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {currentOrg.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {items.map((item) => (
                        <Button
                            key={item.href}
                            component={Link}
                            href={item.href}
                            variant="outlined"
                            size="small"
                        >
                            {item.label}
                        </Button>
                    ))}
                    <Button
                        component={Link}
                        href={`/org/${orgSlug}`}
                        target="_blank"
                        rel="noreferrer"
                        variant="text"
                        size="small"
                    >
                        {nav.publicForm}
                    </Button>
                    <Button
                        size="small"
                        variant="text"
                        onClick={() => setLang(lang === 'no' ? 'en' : 'no')}
                        aria-label="Bytt språk / switch language"
                    >
                        {lang === 'no' ? 'EN' : 'NO'}
                    </Button>
                </Box>
            </Box>
            {children}
        </>
    );
}

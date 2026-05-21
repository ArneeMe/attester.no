'use client'
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { authHeader } from '@/lib/nhost';

type UserOrg = { id: string; slug: string; name: string; role: string };

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const router = useRouter();
    const [currentOrg, setCurrentOrg] = useState<UserOrg | null | undefined>(undefined);

    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('/api/me/organizations', { headers: authHeader() });
                if (res.status === 401) {
                    router.replace('/login');
                    return;
                }
                if (!res.ok) {
                    router.replace('/login/adminpage');
                    return;
                }
                const json = await res.json();
                const memberships: UserOrg[] = json.organizations ?? [];
                const match = memberships.find((o) => o.slug === orgSlug);
                if (!match) {
                    router.replace('/login/adminpage');
                    return;
                }
                setCurrentOrg(match);
            } catch {
                router.replace('/login/adminpage');
            }
        };
        check();
    }, [orgSlug, router]);

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

    return (
        <>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {currentOrg.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        component={Link}
                        href={`/login/adminpage/${orgSlug}`}
                        variant="outlined"
                        size="small"
                    >
                        Oversikt
                    </Button>
                    <Button
                        component={Link}
                        href={`/login/adminpage/${orgSlug}/rediger`}
                        variant="outlined"
                        size="small"
                    >
                        Rediger innhold
                    </Button>
                    <Button
                        component={Link}
                        href={`/login/adminpage/${orgSlug}/edit_pdf`}
                        variant="outlined"
                        size="small"
                    >
                        PDF-mal
                    </Button>
                </Box>
            </Box>
            {children}
        </>
    );
}

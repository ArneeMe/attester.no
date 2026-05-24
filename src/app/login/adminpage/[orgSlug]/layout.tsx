'use client'
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useCurrentOrg } from '@/app/login/adminpage/UserOrgsProvider';

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const router = useRouter();
    const currentOrg = useCurrentOrg(orgSlug);

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

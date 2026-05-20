'use client'
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Box, Button, Typography } from '@mui/material';
import { getOrgBySlug } from '@/lib/nhost';

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const [orgName, setOrgName] = useState<string>(orgSlug);

    useEffect(() => {
        getOrgBySlug(orgSlug)
            .then((org) => setOrgName(org.name))
            .catch(() => setOrgName(orgSlug));
    }, [orgSlug]);

    return (
        <>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {orgName}
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

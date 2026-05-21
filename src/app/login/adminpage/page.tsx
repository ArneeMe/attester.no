'use client'
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { authHeader } from '@/lib/nhost';

type UserOrg = { id: string; slug: string; name: string; role: string };

const AdminOrgPicker: React.FC = () => {
    const [orgs, setOrgs] = useState<UserOrg[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrgs = async () => {
            try {
                const res = await fetch('/api/me/organizations', { headers: authHeader() });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? 'Failed to load organizations');
                setOrgs(json.organizations);
            } catch (e) {
                setError((e as Error).message);
                setOrgs([]);
            }
        };
        fetchOrgs();
    }, []);

    if (orgs === null) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Velg organisasjon
            </Typography>
            {error && (
                <Typography color="error" gutterBottom>
                    {error}
                </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                {orgs.map((org) => (
                    <Paper key={org.id} sx={{ p: 2 }}>
                        <Button
                            component={Link}
                            href={`/login/adminpage/${org.slug}`}
                            variant="contained"
                            fullWidth
                        >
                            {org.name} ({org.slug})
                        </Button>
                    </Paper>
                ))}
                {orgs.length === 0 && !error && (
                    <Paper sx={{ p: 3 }}>
                        <Typography>
                            Du er ikke koblet til noen organisasjon ennå. Be en
                            eksisterende admin om å legge deg til.
                        </Typography>
                    </Paper>
                )}
            </Box>
        </Box>
    );
};

export default AdminOrgPicker;

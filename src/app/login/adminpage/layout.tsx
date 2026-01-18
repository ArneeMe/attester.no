// app/login/adminpage/layout.tsx
'use client'
import React from 'react';
import { useAuth, logout } from '@/util/auth';
import { Box, Button, Container, Typography, CircularProgress } from '@mui/material';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const currentUser = useAuth();

    if (currentUser === undefined) {
        return (
            <Container sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                <CircularProgress />
            </Container>
        );
    }

    if (currentUser === null) {
        return (
            <Container sx={{ mt: 8, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>
                    Du må være logget inn for å se denne siden
                </Typography>
                <Button component={Link} href="/login" variant="contained">
                    Gå til innlogging
                </Button>
            </Container>
        );
    }

    return (
        <Container component="main" maxWidth="lg">
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">
                    Velkommen, {currentUser.email}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button component={Link} href="/login/adminpage" variant="outlined" size="small">
                        Oversikt
                    </Button>
                    <Button component={Link} href="/login/adminpage/rediger" variant="outlined" size="small">
                        Rediger innhold
                    </Button>
                    <Button onClick={logout} variant="outlined" size="small" color="error">
                        Logg ut
                    </Button>
                </Box>
            </Box>
            {children}
        </Container>
    );
}
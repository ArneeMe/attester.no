'use client'
import React from 'react';
import { logout, useAuth, useSessionKeepAlive } from '@/util/auth';
import { Box, Button, Container, Typography, CircularProgress } from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminLang } from '@/util/useAdminLang';
import { UserOrgsProvider, useUserOrgs } from './UserOrgsProvider';

function Notice({
    title,
    body,
    action,
}: {
    title: string;
    body?: string;
    action: React.ReactNode;
}) {
    return (
        <Container sx={{ mt: 8, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
                {title}
            </Typography>
            {body && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {body}
                </Typography>
            )}
            {action}
        </Container>
    );
}

function AdminShell({
    email,
    onLogout,
    children,
}: {
    email: string | undefined;
    onLogout: () => void;
    children: React.ReactNode;
}) {
    const { status, refresh } = useUserOrgs();
    const { strings } = useAdminLang();
    const s = strings.admin.session;

    if (status === 'unauthenticated') {
        return (
            <Notice
                title={s.expiredTitle}
                body={s.expiredBody}
                action={
                    <Button component={Link} href="/login" variant="contained">
                        {s.loginButton}
                    </Button>
                }
            />
        );
    }

    if (status === 'error') {
        return (
            <Notice
                title={s.loadFailedTitle}
                body={s.loadFailedBody}
                action={
                    <Button onClick={() => void refresh()} variant="contained">
                        {s.retry}
                    </Button>
                }
            />
        );
    }

    return (
        <Container component="main" maxWidth="lg">
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">Velkommen, {email}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button component={Link} href="/login/adminpage" variant="outlined" size="small">
                        Bytt organisasjon
                    </Button>
                    <Button onClick={onLogout} variant="outlined" size="small" color="error">
                        Logg ut
                    </Button>
                </Box>
            </Box>
            {children}
        </Container>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const currentUser = useAuth();
    const sessionExpired = useSessionKeepAlive();
    const router = useRouter();
    const { strings } = useAdminLang();
    const s = strings.admin.session;

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    if (currentUser === undefined) {
        return (
            <Container sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                <CircularProgress />
            </Container>
        );
    }

    const loginAction = (
        <Button component={Link} href="/login" variant="contained">
            {s.loginButton}
        </Button>
    );

    if (sessionExpired) {
        return <Notice title={s.expiredTitle} body={s.expiredBody} action={loginAction} />;
    }

    if (currentUser === null) {
        return <Notice title={s.signedOutTitle} action={loginAction} />;
    }

    return (
        <UserOrgsProvider>
            <AdminShell email={currentUser.email} onLogout={() => void handleLogout()}>
                {children}
            </AdminShell>
        </UserOrgsProvider>
    );
}

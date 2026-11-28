'use client'
import React from 'react';
import { logout, useAuth, useSessionKeepAlive } from '@/util/auth';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminLang } from '@/util/useAdminLang';
import { UserOrgsProvider, useUserOrgs } from './UserOrgsProvider';
import { headerLink } from '@/components/landing/SiteHeader';
import Shell from '@/components/landing/SignedInShell';
import { c } from '@/app/style/tokens';

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
        <Shell>
            <Box sx={{ textAlign: 'center', mt: 6 }}>
                <Typography variant="h6" gutterBottom>
                    {title}
                </Typography>
                {body && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {body}
                    </Typography>
                )}
                {action}
            </Box>
        </Shell>
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
    const shell = strings.admin.shell;

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
        <Shell
            right={
                <>
                    <Box sx={{ color: c.inkFaint, display: { xs: 'none', sm: 'block' } }}>
                        {shell.welcome(email ?? '')}
                    </Box>
                    <Box component={Link} href="/login/adminpage" sx={headerLink}>
                        {shell.switchOrg}
                    </Box>
                    <Box component="button" type="button" onClick={onLogout} sx={headerLink}>
                        {shell.logOut}
                    </Box>
                </>
            }
        >
            {children}
        </Shell>
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
            <Shell>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress />
                </Box>
            </Shell>
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

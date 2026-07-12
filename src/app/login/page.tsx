'use client'
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { login, redeemInvite, useAuth } from '@/util/auth';
import { Box, Button, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { getStrings } from '@/strings';
import LanguageToggle from '@/components/LanguageToggle';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const currentUser = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const lang = searchParams.get('lang');
    const inviteToken = searchParams.get('invite');
    const s = getStrings(lang).auth;
    const withLang = (path: string) => (lang === 'en' ? `${path}?lang=en` : path);
    const toast = useToast();

    useEffect(() => {
        if (currentUser) {
            router.push('/login/adminpage');
        }
    }, [currentUser, router]);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
            await login(email, password);
            if (inviteToken) {
                try {
                    const orgName = await redeemInvite(inviteToken);
                    toast.success(s.inviteJoined(orgName));
                } catch (e) {
                    toast.error((e as Error).message);
                }
            }
            router.push('/login/adminpage');
        } catch (error) {
            console.error('Login failed:', error);
            const msg = (error as { message?: string }).message ?? s.loginFailed;
            toast.error(msg);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Typography component="h1" variant="h5">
                    {s.loginTitle}
                </Typography>
                <Box component="form" onSubmit={handleLogin} sx={{ mt: 1, width: '100%' }}>
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        label={s.email}
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={busy}
                    />
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        label={s.password}
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={busy}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={busy || !email || !password}
                    >
                        {busy ? <CircularProgress size={20} /> : s.loginButton}
                    </Button>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Link href={withLang('/login/glemt')} style={{ fontSize: '0.875rem' }}>
                            {s.forgotPassword}
                        </Link>
                        <Link href={withLang('/registrer')} style={{ fontSize: '0.875rem' }}>
                            {s.registerLink}
                        </Link>
                    </Box>
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <LanguageToggle />
                    </Box>
                </Box>
            </Box>
        </Container>
    );
};

export default LoginPage;

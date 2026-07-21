'use client'
export const runtime = 'edge';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { PASSWORD_MIN_LENGTH, redeemInvite, signup } from '@/util/auth';
import { useToast } from '@/components/ToastProvider';
import { getStrings } from '@/strings';
import LanguageToggle from '@/components/LanguageToggle';

const RegisterPage: React.FC = () => {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [needsVerification, setNeedsVerification] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const lang = searchParams.get('lang');
    const inviteToken = searchParams.get('invite');
    const s = getStrings(lang).auth;
    const withLang = (path: string) => (lang === 'en' ? `${path}?lang=en` : path);
    const toast = useToast();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        if (password !== confirm) {
            toast.error(s.passwordMismatch);
            return;
        }
        if (password.length < PASSWORD_MIN_LENGTH) {
            toast.error(s.passwordTooShort(PASSWORD_MIN_LENGTH));
            return;
        }
        setBusy(true);
        try {
            const hasSession = await signup(email, password, displayName.trim());
            if (hasSession) {
                toast.success(s.registerDone);
                if (inviteToken) {
                    try {
                        const orgName = await redeemInvite(inviteToken);
                        toast.success(s.inviteJoined(orgName));
                    } catch (e) {
                        toast.error((e as Error).message);
                    }
                }
                router.push('/login/adminpage');
            } else {
                setNeedsVerification(true);
            }
        } catch (error) {
            console.error(error);
            toast.error((error as Error).message ?? s.registerFailed);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h5" gutterBottom>
                    {s.registerTitle}
                </Typography>
                {needsVerification ? (
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        {s.verifyEmail}
                        {inviteToken && ` ${s.inviteAfterVerify}`}
                    </Typography>
                ) : (
                    <>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                            {s.registerIntro}
                        </Typography>
                        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                            <TextField
                                variant="outlined"
                                margin="normal"
                                fullWidth
                                label={s.name}
                                autoComplete="name"
                                autoFocus
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                disabled={busy}
                            />
                            <TextField
                                variant="outlined"
                                margin="normal"
                                required
                                fullWidth
                                label={s.email}
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={busy}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                {s.emailPrivacyHint}{' '}
                                <Link href="https://pr.tn/ref/9NG6TBSB" target="_blank" rel="noreferrer">
                                    Proton Pass ↗
                                </Link>
                                {' '}{s.affiliateDisclosure}
                            </Typography>
                            <TextField
                                variant="outlined"
                                margin="normal"
                                required
                                fullWidth
                                label={s.password}
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={busy}
                                slotProps={{ htmlInput: { minLength: PASSWORD_MIN_LENGTH } }}
                                helperText={s.passwordTooShort(PASSWORD_MIN_LENGTH)}
                            />
                            <TextField
                                variant="outlined"
                                margin="normal"
                                required
                                fullWidth
                                label={s.repeatPassword}
                                type="password"
                                autoComplete="new-password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                disabled={busy}
                            />
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                sx={{ mt: 3, mb: 2 }}
                                disabled={busy || !email || !password || !confirm}
                            >
                                {busy ? <CircularProgress size={20} /> : s.registerButton}
                            </Button>
                        </Box>
                    </>
                )}
                <Link href={withLang('/login')}>{s.hasAccount}</Link>
                <Box sx={{ mt: 2 }}>
                    <LanguageToggle />
                </Box>
            </Box>
        </Container>
    );
};

export default RegisterPage;

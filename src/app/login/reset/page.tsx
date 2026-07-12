'use client'
export const runtime = 'edge';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { completePasswordReset } from '@/util/auth';
import { useToast } from '@/components/ToastProvider';
import { getStrings } from '@/strings';

const ResetPasswordPage: React.FC = () => {
    const searchParams = useSearchParams();
    const refreshToken = searchParams.get('refreshToken');
    const lang = searchParams.get('lang');
    const s = getStrings(lang).auth;
    const withLang = (path: string) => (lang === 'en' ? `${path}?lang=en` : path);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const router = useRouter();
    const toast = useToast();

    if (!refreshToken) {
        return (
            <Container component="main" maxWidth="xs">
                <Box sx={{ mt: 8, textAlign: 'center' }}>
                    <Typography variant="h5" gutterBottom>{s.resetInvalidTitle}</Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        {s.resetInvalidBody}
                    </Typography>
                    <Link href={withLang('/login/glemt')}>{s.forgotTitle}</Link>
                </Box>
            </Container>
        );
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        if (password !== confirm) {
            toast.error(s.passwordMismatch);
            return;
        }
        setBusy(true);
        try {
            await completePasswordReset(refreshToken, password);
            toast.success(s.resetDone);
            router.push('/login');
        } catch (error) {
            console.error(error);
            toast.error(((error as Error).message ?? s.genericError) + s.resetFailedHint);
            setBusy(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h5">
                    {s.resetTitle}
                </Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        label={s.newPassword}
                        type="password"
                        autoComplete="new-password"
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={busy}
                    />
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        label={s.repeatNewPassword}
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
                        disabled={busy || !password || !confirm}
                    >
                        {busy ? <CircularProgress size={20} /> : s.resetButton}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
};

export default ResetPasswordPage;

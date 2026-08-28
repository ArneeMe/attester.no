'use client'
export const runtime = 'edge';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Box, Button, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { requestPasswordReset } from '@/util/auth';
import { useToast } from '@/components/ToastProvider';
import { getStrings } from '@/strings';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const searchParams = useSearchParams();
    const lang = searchParams.get('lang');
    const s = getStrings(lang).auth;
    const withLang = (path: string) => (lang === 'en' ? `${path}?lang=en` : path);
    const toast = useToast();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
            await requestPasswordReset(email);
            setSent(true);
        } catch (error) {
            console.error(error);
            toast.error((error as Error).message ?? s.genericError);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h5" gutterBottom>
                    {s.forgotTitle}
                </Typography>
                {sent ? (
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        {s.forgotSent}
                    </Typography>
                ) : (
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                        <TextField
                            variant="outlined"
                            margin="normal"
                            required
                            fullWidth
                            label={s.email}
                            type="email"
                            autoComplete="email"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={busy}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                            disabled={busy || !email}
                        >
                            {busy ? <CircularProgress size={20} /> : s.forgotSend}
                        </Button>
                    </Box>
                )}
                <Link href={withLang('/login')}>{s.backToLogin}</Link>
            </Box>
        </Container>
    );
};

export default ForgotPasswordPage;

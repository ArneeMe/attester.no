'use client'
export const runtime = 'edge';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { completePasswordReset } from '@/util/auth';
import { useToast } from '@/components/ToastProvider';

const ResetPasswordPage: React.FC = () => {
    const searchParams = useSearchParams();
    const refreshToken = searchParams.get('refreshToken');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const router = useRouter();
    const toast = useToast();

    if (!refreshToken) {
        return (
            <Container component="main" maxWidth="xs">
                <Box sx={{ mt: 8, textAlign: 'center' }}>
                    <Typography variant="h5" gutterBottom>Ugyldig lenke</Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        Lenken mangler eller er utløpt. Be om en ny.
                    </Typography>
                    <Link href="/login/glemt">Glemt passord</Link>
                </Box>
            </Container>
        );
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        if (password !== confirm) {
            toast.error('Passordene er ikke like');
            return;
        }
        setBusy(true);
        try {
            await completePasswordReset(refreshToken, password);
            toast.success('Passordet er endret. Logg inn med det nye passordet.');
            router.push('/login');
        } catch (error) {
            console.error(error);
            toast.error(
                ((error as Error).message ?? 'Noe gikk galt')
                + '. Lenken kan være utløpt – be om en ny under «Glemt passord».',
            );
            setBusy(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h5">
                    Sett nytt passord
                </Typography>
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        label="Nytt passord"
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
                        label="Gjenta nytt passord"
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
                        {busy ? <CircularProgress size={20} /> : 'Endre passord'}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
};

export default ResetPasswordPage;

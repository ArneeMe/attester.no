'use client'
export const runtime = 'edge';

import React, { useState } from 'react';
import Link from 'next/link';
import { Box, Button, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { requestPasswordReset } from '@/util/auth';
import { useToast } from '@/components/ToastProvider';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
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
            toast.error((error as Error).message ?? 'Noe gikk galt');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h5" gutterBottom>
                    Glemt passord
                </Typography>
                {sent ? (
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        Hvis kontoen finnes, er det sendt en e-post med lenke for å
                        sette nytt passord. Sjekk innboksen din.
                    </Typography>
                ) : (
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                        <TextField
                            variant="outlined"
                            margin="normal"
                            required
                            fullWidth
                            label="E-post"
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
                            {busy ? <CircularProgress size={20} /> : 'Send lenke'}
                        </Button>
                    </Box>
                )}
                <Link href="/login">Tilbake til innlogging</Link>
            </Box>
        </Container>
    );
};

export default ForgotPasswordPage;

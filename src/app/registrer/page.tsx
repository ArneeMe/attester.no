'use client'
export const runtime = 'edge';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, Button, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { signup } from '@/util/auth';
import { useToast } from '@/components/ToastProvider';

const RegisterPage: React.FC = () => {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [needsVerification, setNeedsVerification] = useState(false);
    const router = useRouter();
    const toast = useToast();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        if (password !== confirm) {
            toast.error('Passordene er ikke like');
            return;
        }
        setBusy(true);
        try {
            const hasSession = await signup(email, password, displayName.trim());
            if (hasSession) {
                toast.success('Kontoen er opprettet');
                router.push('/login/adminpage');
            } else {
                setNeedsVerification(true);
            }
        } catch (error) {
            console.error(error);
            toast.error((error as Error).message ?? 'Registrering feilet');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h5" gutterBottom>
                    Registrer konto
                </Typography>
                {needsVerification ? (
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        Sjekk e-posten din og bekreft kontoen. Deretter kan du logge inn —
                        og be et eksisterende medlem i organisasjonen din om å legge deg
                        til under «Medlemmer».
                    </Typography>
                ) : (
                    <>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                            En konto gir ingen tilgang i seg selv — et eksisterende medlem
                            må legge deg til i organisasjonen etterpå.
                        </Typography>
                        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                            <TextField
                                variant="outlined"
                                margin="normal"
                                fullWidth
                                label="Navn"
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
                                label="E-post"
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={busy}
                            />
                            <TextField
                                variant="outlined"
                                margin="normal"
                                required
                                fullWidth
                                label="Passord"
                                type="password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={busy}
                            />
                            <TextField
                                variant="outlined"
                                margin="normal"
                                required
                                fullWidth
                                label="Gjenta passord"
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
                                {busy ? <CircularProgress size={20} /> : 'Registrer'}
                            </Button>
                        </Box>
                    </>
                )}
                <Link href="/login">Har du konto? Logg inn</Link>
            </Box>
        </Container>
    );
};

export default RegisterPage;

'use client'
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { login, useAuth } from '@/util/auth';
import { Box, Button, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const currentUser = useAuth();
    const router = useRouter();
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
            router.push('/login/adminpage');
        } catch (error) {
            console.error('Login failed:', error);
            const msg = (error as { message?: string }).message ?? 'Innlogging feilet';
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
                    Logg inn
                </Typography>
                <Box component="form" onSubmit={handleLogin} sx={{ mt: 1, width: '100%' }}>
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        label="E-post"
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
                        label="Passord"
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
                        {busy ? <CircularProgress size={20} /> : 'Logg Inn'}
                    </Button>
                    <Link href="/login/glemt" style={{ fontSize: '0.875rem' }}>
                        Glemt passord?
                    </Link>
                </Box>
            </Box>
        </Container>
    );
};

export default LoginPage;

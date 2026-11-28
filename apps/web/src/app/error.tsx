'use client'
import { useEffect } from 'react';
import { Button, Container, Typography } from '@mui/material';
import { getStrings } from '@/strings';
import { reportBrowserError } from '@/util/reportError';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
    useEffect(() => {
        reportBrowserError(error);
    }, [error]);

    const lang = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('lang');
    const s = getStrings(lang).errorPage;

    return (
        <Container component="main" maxWidth="sm" sx={{ py: 8 }}>
            <Typography variant="h4" component="h1" gutterBottom>{s.title}</Typography>
            <Typography sx={{ mb: 3 }}>{s.body}</Typography>
            <Button variant="contained" onClick={reset}>{s.retry}</Button>
        </Container>
    );
}

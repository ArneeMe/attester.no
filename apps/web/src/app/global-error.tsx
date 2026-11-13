'use client'
import { useEffect } from 'react';
import { reportBrowserError } from '@/util/reportError';

// Replaces the root layout when the layout itself fails, so it cannot use
// the theme or the strings. Plain HTML, both languages.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
    useEffect(() => {
        reportBrowserError(error);
    }, [error]);

    return (
        <html lang="no">
            <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '80px auto', padding: 16 }}>
                <h1>Noe gikk galt</h1>
                <p>Feilen er meldt fra. Prøv igjen om litt.</p>
                <p lang="en">Something went wrong. The error has been reported. Please try again shortly.</p>
                <button onClick={reset}>Prøv igjen / Try again</button>
            </body>
        </html>
    );
}

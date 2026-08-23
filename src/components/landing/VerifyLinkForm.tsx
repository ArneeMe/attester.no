'use client';
import React, { useState } from 'react';
import { Box, InputBase } from '@mui/material';
import { useRouter } from 'next/navigation';
import { fontMono, fontSerif } from '@/app/style/landingFonts';
import { parseVerifyUrl } from '@/util/parseVerifyUrl';
import { landing } from './tokens';

/**
 * "Har du fått en attest?" — paste the link from a certificate's QR code and
 * get sent to the verify page for it.
 *
 * This only routes. The comparison between the pasted fields and the stored
 * hash happens on the verify page itself, which is the only place that knows
 * which of the two hash contracts applies.
 */
const VerifyLinkForm: React.FC = () => {
    const router = useRouter();
    const [value, setValue] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const target = parseVerifyUrl(value);
        if (!target) {
            setError(
                'Dette ser ikke ut som en attestlenke. Den skal inneholde /verify og en kode.',
            );
            return;
        }
        setError(null);
        router.push(target);
    };

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate>
            <Box component="h2" sx={{ m: 0, font: `400 22px/1.3 ${fontSerif}`, color: landing.ink }}>
                Har du fått en attest?
            </Box>
            <Box
                component="p"
                sx={{ mt: 1.25, mb: 2.25, fontSize: 14.5, lineHeight: 1.6, color: landing.inkSoft }}
            >
                Skann koden i attesten, eller lim inn lenken her for å sjekke at den er ekte.
            </Box>

            <Box sx={{ display: 'flex', gap: 1.25 }}>
                <InputBase
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        if (error) setError(null);
                    }}
                    placeholder="attester.no/org/…/verify?…"
                    inputProps={{
                        'aria-label': 'Lenke fra attesten',
                        'aria-invalid': error ? true : undefined,
                        'aria-describedby': error ? 'verify-link-error' : undefined,
                    }}
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        height: 38,
                        border: `1px solid ${error ? landing.accent : landing.border}`,
                        borderRadius: '2px',
                        background: landing.surface,
                        px: 1.5,
                        font: `400 12.5px/1 ${fontMono}`,
                        color: landing.ink,
                        '& input::placeholder': { color: landing.inkFaint, opacity: 1 },
                        '&:focus-within': { borderColor: landing.accent },
                    }}
                />
                <Box
                    component="button"
                    type="submit"
                    sx={{
                        flexShrink: 0,
                        fontFamily: 'inherit',
                        fontSize: 14,
                        fontWeight: 500,
                        color: landing.paper,
                        background: landing.accent,
                        border: 0,
                        borderRadius: '2px',
                        px: 2.25,
                        height: 38,
                        cursor: 'pointer',
                        '&:hover': { background: landing.accentHover },
                    }}
                >
                    Verifiser
                </Box>
            </Box>

            {error && (
                <Box
                    id="verify-link-error"
                    role="alert"
                    sx={{ mt: 1.25, fontSize: 13, lineHeight: 1.6, color: landing.accent }}
                >
                    {error}
                </Box>
            )}
        </Box>
    );
};

export default VerifyLinkForm;

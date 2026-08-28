'use client';
import React, { useState } from 'react';
import { Box, InputBase } from '@mui/material';
import { useRouter } from 'next/navigation';
import { fontMono } from '@/app/style/landingFonts';
import { parseVerifyUrl } from '@/util/parseVerifyUrl';
import { body, c, field, h2 } from '@/app/style/tokens';

type Props = {
    t: {
        title: string;
        body: string;
        placeholder: string;
        submit: string;
        error: string;
    };
};

const VerifyLinkForm: React.FC<Props> = ({ t }) => {
    const router = useRouter();
    const [value, setValue] = useState('');
    const [error, setError] = useState(false);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const target = parseVerifyUrl(value);
        if (target) router.push(target);
        else setError(true);
    };

    return (
        <Box component="form" onSubmit={submit} noValidate>
            <Box component="h2" sx={h2}>
                {t.title}
            </Box>
            <Box component="p" sx={{ ...body, mt: 1.25, mb: 2.25 }}>
                {t.body}
            </Box>

            <Box sx={{ display: 'flex', gap: 1.25 }}>
                <InputBase
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setError(false);
                    }}
                    placeholder={t.placeholder}
                    inputProps={{
                        'aria-label': t.title,
                        'aria-invalid': error || undefined,
                        'aria-describedby': error ? 'verify-error' : undefined,
                    }}
                    sx={{
                        ...field,
                        flex: 1,
                        minWidth: 0,
                        font: `400 12.5px/1 ${fontMono}`,
                        ...(error && { borderColor: c.accent }),
                    }}
                />
                <Box
                    component="button"
                    type="submit"
                    sx={{
                        flexShrink: 0,
                        height: 38,
                        px: 2.25,
                        fontFamily: 'inherit',
                        fontSize: 14,
                        fontWeight: 500,
                        color: c.paper,
                        background: c.accent,
                        border: 0,
                        borderRadius: '2px',
                        cursor: 'pointer',
                        '&:hover': { background: c.accentHover },
                    }}
                >
                    {t.submit}
                </Box>
            </Box>

            {error && (
                <Box
                    id="verify-error"
                    role="alert"
                    sx={{ mt: 1.25, fontSize: 13, lineHeight: 1.6, color: c.accent }}
                >
                    {t.error}
                </Box>
            )}
        </Box>
    );
};

export default VerifyLinkForm;

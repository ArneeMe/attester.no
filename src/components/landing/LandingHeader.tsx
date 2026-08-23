'use client';
import React, { useState } from 'react';
import { Box, Menu, MenuItem } from '@mui/material';
import Link from 'next/link';
import { fontSerif } from '@/app/style/landingFonts';
import { c, gutter } from './tokens';

const LANGUAGES = [{ code: 'nb', label: 'Norsk bokmål' }];

const LandingHeader: React.FC = () => {
    const [anchor, setAnchor] = useState<null | HTMLElement>(null);
    const [code, setCode] = useState(LANGUAGES[0].code);

    const current = LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

    return (
        <Box
            component="header"
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                px: gutter,
                py: 2.25,
                borderBottom: `1px solid ${c.rule}`,
            }}
        >
            <Box sx={{ font: `600 17px/1 ${fontSerif}`, letterSpacing: '0.01em' }}>attester.no</Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2.5 }, fontSize: 13 }}>
                <Box
                    component="button"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={anchor ? true : undefined}
                    aria-label="Velg språk"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => setAnchor(e.currentTarget)}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        font: 'inherit',
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                        color: c.inkSoft,
                        background: 'none',
                        border: 0,
                        p: 0,
                        cursor: 'pointer',
                        '&:hover': { color: c.ink },
                    }}
                >
                    {current.label}
                    <Box component="span" aria-hidden sx={{ fontSize: 9 }}>
                        ▾
                    </Box>
                </Box>
                <Menu
                    anchorEl={anchor}
                    open={Boolean(anchor)}
                    onClose={() => setAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {LANGUAGES.map((lang) => (
                        <MenuItem
                            key={lang.code}
                            selected={lang.code === code}
                            onClick={() => {
                                setCode(lang.code);
                                setAnchor(null);
                            }}
                            sx={{ fontSize: 13 }}
                        >
                            {lang.label}
                        </MenuItem>
                    ))}
                </Menu>

                <Box
                    component={Link}
                    href="/login"
                    sx={{
                        color: c.ink,
                        textDecoration: 'none',
                        borderBottom: `1px solid ${c.borderStrong}`,
                        pb: '2px',
                        whiteSpace: 'nowrap',
                        '&:hover': { borderBottomColor: c.ink },
                    }}
                >
                    Innlogging for admin
                </Box>
            </Box>
        </Box>
    );
};

export default LandingHeader;

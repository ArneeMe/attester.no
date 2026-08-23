'use client';
import React, { useState } from 'react';
import { Box, Menu, MenuItem } from '@mui/material';
import Link from 'next/link';
import { fontSerif } from '@/app/style/landingFonts';
import { gutter, landing } from './tokens';

/**
 * Languages the landing page is offered in.
 *
 * Norwegian bokmål only today. The menu is here because the design calls for
 * a language control and because the second entry should be a data change,
 * not a layout change — but it deliberately does not pretend to switch
 * anything it cannot actually switch.
 */
const LANGUAGES = [{ code: 'nb', label: 'Norsk bokmål' }] as const;

const LandingHeader: React.FC = () => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [langCode, setLangCode] = useState<string>(LANGUAGES[0].code);

    const current = LANGUAGES.find((l) => l.code === langCode) ?? LANGUAGES[0];

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
                borderBottom: `1px solid ${landing.rule}`,
            }}
        >
            <Box
                sx={{
                    font: `600 17px/1 ${fontSerif}`,
                    letterSpacing: '0.01em',
                    color: landing.ink,
                }}
            >
                attester.no
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 1.5, sm: 2.5 },
                    fontSize: 13,
                }}
            >
                <Box
                    component="button"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={anchorEl ? true : undefined}
                    aria-label="Velg språk"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                        setAnchorEl(e.currentTarget)
                    }
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        font: 'inherit',
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                        color: landing.inkSoft,
                        background: 'none',
                        border: 0,
                        p: 0,
                        cursor: 'pointer',
                        '&:hover': { color: landing.ink },
                    }}
                >
                    {current.label}
                    <Box component="span" aria-hidden sx={{ fontSize: 9 }}>
                        ▾
                    </Box>
                </Box>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => setAnchorEl(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {LANGUAGES.map((lang) => (
                        <MenuItem
                            key={lang.code}
                            selected={lang.code === langCode}
                            onClick={() => {
                                setLangCode(lang.code);
                                setAnchorEl(null);
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
                        color: landing.ink,
                        textDecoration: 'none',
                        borderBottom: `1px solid ${landing.borderStrong}`,
                        pb: '2px',
                        whiteSpace: 'nowrap',
                        '&:hover': { borderBottomColor: landing.ink },
                    }}
                >
                    Innlogging for admin
                </Box>
            </Box>
        </Box>
    );
};

export default LandingHeader;

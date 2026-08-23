'use client';
import React, { useMemo, useState } from 'react';
import { Box, InputBase } from '@mui/material';
import Link from 'next/link';
import { fontMono } from '@/app/style/landingFonts';
import { landing } from './tokens';
import { LANDING_ORGS, type LandingOrg } from './orgs';

/** Height of roughly ten rows — the list scrolls past that instead of growing. */
const LIST_MAX_HEIGHT = 376;

const matches = (org: LandingOrg, query: string): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q);
};

const OrgPicker: React.FC = () => {
    const [query, setQuery] = useState('');

    const visible = useMemo(
        () => LANDING_ORGS.filter((org) => matches(org, query)),
        [query],
    );

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'center' }}>
                <InputBase
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Søk etter organisasjon"
                    inputProps={{ 'aria-label': 'Søk etter organisasjon' }}
                    sx={{
                        flex: 1,
                        height: 38,
                        border: `1px solid ${landing.border}`,
                        borderRadius: '2px',
                        background: landing.surface,
                        px: 1.5,
                        fontSize: 14,
                        color: landing.ink,
                        '& input::placeholder': { color: landing.inkFaint, opacity: 1 },
                        '&:focus-within': { borderColor: landing.accent },
                    }}
                />
                <Box
                    aria-live="polite"
                    sx={{ font: `400 11px/1 ${fontMono}`, color: landing.inkFaint, whiteSpace: 'nowrap' }}
                >
                    {LANDING_ORGS.length} aktive
                </Box>
            </Box>

            <Box
                sx={{
                    mt: 1.75,
                    maxHeight: LIST_MAX_HEIGHT,
                    overflowY: 'auto',
                    borderTop: `1px solid ${landing.ruleSoft}`,
                }}
            >
                {visible.map((org) => (
                    <Box
                        key={org.slug}
                        component={Link}
                        href={`/org/${org.slug}`}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.75,
                            px: 0.5,
                            py: '13px',
                            borderBottom: `1px solid ${landing.ruleSoft}`,
                            textDecoration: 'none',
                            color: landing.ink,
                            '&:hover': { background: landing.rowHover },
                        }}
                    >
                        <Box
                            aria-hidden
                            sx={{
                                width: 30,
                                height: 30,
                                flexShrink: 0,
                                border: `1px solid ${landing.rule}`,
                                background: landing.logoPlaceholder,
                            }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ fontSize: 15, fontWeight: 500 }}>{org.name}</Box>
                            <Box sx={{ font: `400 11px/1.2 ${fontMono}`, color: landing.inkFaint }}>
                                /org/{org.slug}
                            </Box>
                        </Box>
                        <Box
                            sx={{
                                ml: 'auto',
                                pl: 1.5,
                                fontSize: 13,
                                color: landing.inkFaint,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Søk om attest →
                        </Box>
                    </Box>
                ))}

                {visible.length === 0 && (
                    <Box
                        sx={{
                            px: 0.5,
                            py: '13px',
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: landing.inkSoft,
                        }}
                    >
                        Ingen organisasjon heter det. Er den ikke satt opp ennå, send oss en
                        epost på{' '}
                        <Box
                            component="a"
                            href="mailto:hei@attester.no"
                            sx={{ color: landing.accent }}
                        >
                            hei@attester.no
                        </Box>
                        .
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default OrgPicker;

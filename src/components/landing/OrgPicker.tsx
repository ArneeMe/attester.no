'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, InputBase } from '@mui/material';
import Link from 'next/link';
import { fontMono } from '@/app/style/landingFonts';
import { body, c, field } from './tokens';

type Org = { id: string; slug: string; name: string };

const row = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.75,
    px: 0.5,
    py: '13px',
    borderBottom: `1px solid ${c.ruleSoft}`,
};

const OrgPicker: React.FC = () => {
    const [orgs, setOrgs] = useState<Org[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState('');

    useEffect(() => {
        let live = true;
        fetch('/api/organizations')
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((json: { organizations?: Org[] }) => {
                if (live) setOrgs(json.organizations ?? []);
            })
            .catch(() => live && setFailed(true));
        return () => {
            live = false;
        };
    }, []);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!orgs) return [];
        if (!q) return orgs;
        return orgs.filter(
            (o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q),
        );
    }, [orgs, query]);

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'center' }}>
                <InputBase
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Søk etter organisasjon"
                    inputProps={{ 'aria-label': 'Søk etter organisasjon' }}
                    disabled={!orgs}
                    sx={{ ...field, flex: 1, fontSize: 14 }}
                />
                <Box
                    aria-live="polite"
                    sx={{ font: `400 11px/1 ${fontMono}`, color: c.inkFaint, whiteSpace: 'nowrap' }}
                >
                    {orgs ? `${orgs.length} aktive` : ''}
                </Box>
            </Box>

            <Box
                sx={{
                    mt: 1.75,
                    maxHeight: 376,
                    overflowY: 'auto',
                    borderTop: `1px solid ${c.ruleSoft}`,
                }}
            >
                {!orgs && !failed && (
                    <Box sx={{ ...row, borderBottom: 0, justifyContent: 'center' }}>
                        <CircularProgress size={20} sx={{ color: c.inkFaint }} />
                    </Box>
                )}

                {failed && (
                    <Box sx={{ ...row, ...body, borderBottom: 0 }}>
                        Fikk ikke hentet organisasjonene. Last siden på nytt, eller gå rett til{' '}
                        <Box component="span" sx={{ font: `400 13px/1.2 ${fontMono}` }}>
                            attester.no/org/…
                        </Box>
                    </Box>
                )}

                {visible.map((org) => (
                    <Box
                        key={org.id}
                        component={Link}
                        href={`/org/${org.slug}`}
                        sx={{
                            ...row,
                            textDecoration: 'none',
                            color: c.ink,
                            '&:hover': { background: c.rowHover },
                        }}
                    >
                        <Box
                            aria-hidden
                            sx={{
                                width: 30,
                                height: 30,
                                flexShrink: 0,
                                border: `1px solid ${c.rule}`,
                                background: c.logo,
                            }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ fontSize: 15, fontWeight: 500 }}>{org.name}</Box>
                            <Box sx={{ font: `400 11px/1.2 ${fontMono}`, color: c.inkFaint }}>
                                /org/{org.slug}
                            </Box>
                        </Box>
                        <Box
                            sx={{
                                ml: 'auto',
                                pl: 1.5,
                                fontSize: 13,
                                color: c.inkFaint,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Søk om attest →
                        </Box>
                    </Box>
                ))}

                {orgs && !visible.length && (
                    <Box sx={{ ...row, ...body, borderBottom: 0 }}>
                        Ingen organisasjon heter det. Er den ikke satt opp ennå, send oss en epost
                        på&nbsp;
                        <Box component="a" href="mailto:hei@attester.no" sx={{ color: c.accent }}>
                            hei@attester.no
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default OrgPicker;

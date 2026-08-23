'use client';
import React, { useMemo, useState } from 'react';
import { Box, InputBase } from '@mui/material';
import Link from 'next/link';
import type { PublicOrg } from '@/lib/server/orgs';
import { fontMono } from '@/app/style/landingFonts';
import { body, c, field } from './tokens';

type Props = {
    orgs: PublicOrg[];
    failed: boolean;
    lang?: string;
    t: {
        search: string;
        count: string;
        cta: string;
        empty: string;
        failed: string;
    };
};

const row = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.75,
    px: 0.5,
    py: '13px',
    borderBottom: `1px solid ${c.ruleSoft}`,
};

const OrgPicker: React.FC<Props> = ({ orgs, failed, lang, t }) => {
    const [query, setQuery] = useState('');

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return orgs;
        return orgs.filter(
            (o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q),
        );
    }, [orgs, query]);

    const href = (slug: string) =>
        `/org/${encodeURIComponent(slug)}${lang === 'en' ? '?lang=en' : ''}`;

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'center' }}>
                <InputBase
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.search}
                    inputProps={{ 'aria-label': t.search }}
                    disabled={failed}
                    sx={{ ...field, flex: 1, fontSize: 14 }}
                />
                <Box sx={{ font: `400 11px/1 ${fontMono}`, color: c.inkFaint, whiteSpace: 'nowrap' }}>
                    {failed ? '' : t.count}
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
                {failed && <Box sx={{ ...row, ...body, borderBottom: 0 }}>{t.failed}</Box>}

                {visible.map((org) => (
                    <Box
                        key={org.slug}
                        component={Link}
                        href={href(org.slug)}
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
                            {t.cta} →
                        </Box>
                    </Box>
                ))}

                {!failed && !visible.length && (
                    <Box sx={{ ...row, ...body, borderBottom: 0 }}>
                        {t.empty}&nbsp;
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

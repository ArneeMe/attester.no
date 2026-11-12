'use client'
export const runtime = 'edge';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    CircularProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow,
    Typography,
} from '@mui/material';
import { authHeader } from '@/lib/nhost';
import { useToast } from '@/components/ToastProvider';
import { useAdminLang } from '@/util/useAdminLang';

type Cert = {
    id: string;
    templateId: string | null;
    issuedBy: string | null;
    createdAt: string;
};

type TemplateRow = { id: string; name: string };

const MAX_LISTED = 100;

const IssuedPage: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const { strings } = useAdminLang();
    const a = strings.admin.issued;
    const toast = useToast();
    const [certs, setCerts] = useState<Cert[] | null>(null);
    const [templates, setTemplates] = useState<TemplateRow[]>([]);

    const load = useCallback(async () => {
        try {
            const [certRes, tmplRes] = await Promise.all([
                fetch(`/api/org/${encodeURIComponent(orgSlug)}/certificates`, { headers: authHeader() }),
                fetch(`/api/org/${encodeURIComponent(orgSlug)}/templates`, { headers: authHeader() }),
            ]);
            const certJson = await certRes.json();
            if (!certRes.ok) throw new Error(certJson.error ?? `HTTP ${certRes.status}`);
            setCerts(certJson.certificates);
            if (tmplRes.ok) {
                const tmplJson = await tmplRes.json();
                setTemplates(tmplJson.templates ?? []);
            }
        } catch (e) {
            toast.error(`${a.loadError}: ${(e as Error).message}`);
            setCerts([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgSlug]);

    useEffect(() => { load(); }, [load]);

    if (certs === null) return <CircularProgress />;

    const templateName = (id: string | null) =>
        templates.find((t) => t.id === id)?.name ?? (id ? `${id.slice(0, 8)}…` : '—');

    // Per-month counts, newest first, last 12 months with any issuance.
    const byMonth = new Map<string, number>();
    for (const c of certs) {
        const month = c.createdAt.slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    }
    const months = [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 12);

    const byTemplate = new Map<string, number>();
    for (const c of certs) {
        const key = templateName(c.templateId);
        byTemplate.set(key, (byTemplate.get(key) ?? 0) + 1);
    }

    return (
        <>
            <Typography variant="h4" gutterBottom>{a.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {a.intro(certs.length)}
            </Typography>

            <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <div>
                    <Typography variant="subtitle2" gutterBottom>{a.perMonth}</Typography>
                    {months.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">{a.none}</Typography>
                    ) : months.map(([month, count]) => (
                        <Typography key={month} variant="body2">
                            {month}: <strong>{count}</strong>
                        </Typography>
                    ))}
                </div>
                <div>
                    <Typography variant="subtitle2" gutterBottom>{a.perTemplate}</Typography>
                    {[...byTemplate.entries()].sort(([, a], [, b]) => b - a).map(([name, count]) => (
                        <Typography key={name} variant="body2">
                            {name}: <strong>{count}</strong>
                        </Typography>
                    ))}
                </div>
            </Paper>

            <Paper sx={{ overflowX: 'auto' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>{a.colIssued}</TableCell>
                            <TableCell>{a.colTemplate}</TableCell>
                            <TableCell>{a.colBy}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {certs.slice(0, MAX_LISTED).map((c) => (
                            <TableRow key={c.id}>
                                <TableCell>{new Date(c.createdAt).toLocaleString('nb-NO')}</TableCell>
                                <TableCell>{templateName(c.templateId)}</TableCell>
                                <TableCell>{c.issuedBy ?? '—'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {certs.length > MAX_LISTED && (
                    <Typography variant="caption" color="text.secondary" sx={{ p: 2, display: 'block' }}>
                        {a.showingNewest(MAX_LISTED, certs.length)}
                    </Typography>
                )}
            </Paper>
        </>
    );
};

export default IssuedPage;

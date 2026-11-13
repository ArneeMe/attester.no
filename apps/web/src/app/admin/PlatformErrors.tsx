'use client'
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';
import { authHeader } from '@/lib/nhost';
import { useToast } from '@/components/ToastProvider';
import type { Strings } from '@/strings';

type PlatformError = {
    id: string;
    source: string;
    place: string;
    kind: string;
    message: string;
    stack: string;
    request_id: string | null;
    count: number;
    first_seen: string;
    last_seen: string;
};

type Props = { strings: Strings; lang: string };

const PlatformErrors: React.FC<Props> = ({ strings, lang }) => {
    const a = strings.admin.platform.errors;
    const toast = useToast();
    const [errors, setErrors] = useState<PlatformError[] | null>(null);
    const [open, setOpen] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/v1/admin/errors', { headers: authHeader() });
            if (!res.ok) return;
            setErrors((await res.json()).errors ?? []);
        } catch {
            setErrors(null);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const resolve = async (id: string) => {
        try {
            const res = await fetch(`/api/v1/admin/errors/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: authHeader(),
            });
            if (!res.ok) throw new Error();
            setErrors((prev) => (prev ?? []).filter((e) => e.id !== id));
        } catch {
            toast.error(a.resolveError);
        }
    };

    if (errors === null) return null;

    const when = (iso: string) => new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'nb-NO');

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>{a.title(errors.length)}</Typography>
            {errors.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{a.empty}</Typography>
            ) : (
                <List>
                    {errors.map((e) => (
                        <ListItem
                            key={e.id}
                            alignItems="flex-start"
                            sx={{ flexDirection: 'column', alignItems: 'stretch' }}
                            divider
                        >
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Chip size="small" label={a.count(e.count)} color="error" variant="outlined" />
                                <Chip size="small" label={e.source} variant="outlined" />
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{e.place}</Typography>
                            </Box>
                            <ListItemText
                                primary={`${e.kind}: ${e.message}`}
                                secondary={a.seen(when(e.first_seen), when(e.last_seen))}
                            />
                            {open === e.id && (
                                <Box
                                    component="pre"
                                    sx={{ fontSize: 12, overflowX: 'auto', m: 0, mb: 1, p: 1, bgcolor: 'action.hover' }}
                                >
                                    {e.stack}
                                    {e.request_id ? `\n\n${a.requestId}: ${e.request_id}` : ''}
                                </Box>
                            )}
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button size="small" onClick={() => setOpen(open === e.id ? null : e.id)}>
                                    {open === e.id ? a.hide : a.details}
                                </Button>
                                <Button size="small" onClick={() => resolve(e.id)}>{a.resolve}</Button>
                            </Box>
                        </ListItem>
                    ))}
                </List>
            )}
        </Paper>
    );
};

export default PlatformErrors;

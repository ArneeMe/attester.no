'use client'
export const runtime = 'edge';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    Box, CircularProgress, IconButton, Paper, Rating, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { authHeader } from '@/lib/nhost';
import { useToast } from '@/components/ToastProvider';
import { useAdminLang } from '@/util/useAdminLang';

type FeedbackItem = { id: string; rating: number; comment: string; created_at: string };

const FeedbackPage: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const { strings } = useAdminLang();
    const a = strings.admin.feedbackPage;
    const toast = useToast();
    const [items, setItems] = useState<FeedbackItem[] | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/feedback`, {
                headers: authHeader(),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            setItems(json.feedback);
        } catch (e) {
            toast.error(`${a.loadError}: ${(e as Error).message}`);
            setItems([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgSlug]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/feedback`, {
                method: 'DELETE',
                headers: { 'content-type': 'application/json', ...authHeader() },
                body: JSON.stringify({ id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            setItems((prev) => (prev ?? []).filter((f) => f.id !== id));
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    const average = items && items.length > 0
        ? items.reduce((sum, f) => sum + f.rating, 0) / items.length
        : null;

    return (
        <>
            <Typography variant="h4" gutterBottom>{a.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {a.intro}
            </Typography>

            {items === null ? (
                <CircularProgress />
            ) : items.length === 0 ? (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                        {a.empty}
                    </Typography>
                </Paper>
            ) : (
                <>
                    <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Rating value={average} precision={0.1} readOnly />
                        <Typography variant="body2" color="text.secondary">
                            {a.average(average?.toFixed(1) ?? '', items.length)}
                        </Typography>
                    </Paper>
                    {items.map((f) => (
                        <Paper key={f.id} sx={{ p: 2, mb: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Rating value={f.rating} readOnly size="small" />
                                    <Typography variant="caption" color="text.secondary">
                                        {new Date(f.created_at).toLocaleString('nb-NO')}
                                    </Typography>
                                </Box>
                                <IconButton
                                    size="small"
                                    aria-label={a.deleteAria}
                                    onClick={() => handleDelete(f.id)}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            {f.comment && (
                                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                                    {f.comment}
                                </Typography>
                            )}
                        </Paper>
                    ))}
                </>
            )}
        </>
    );
};

export default FeedbackPage;

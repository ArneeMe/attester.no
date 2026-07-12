'use client'
import React, { useState } from 'react';
import { Box, Button, CircularProgress, Rating, TextField, Typography } from '@mui/material';
import type { Strings } from '@/strings';

interface Props {
    orgSlug: string;
    strings: Strings['feedback'];
}

/**
 * Anonymous rating + optional comment, POSTed to the org's feedback API.
 * Shown on the volunteer confirmation screen. Deliberately carries no
 * identity — the API stores only org, rating, comment, timestamp.
 */
const FeedbackWidget: React.FC<Props> = ({ orgSlug, strings }) => {
    const [rating, setRating] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (sent) {
        return (
            <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
                {strings.thanks}
            </Typography>
        );
    }

    const handleSend = async () => {
        if (!rating || busy) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/feedback`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({} as { error?: string }));
                throw new Error(json.error ?? `HTTP ${res.status}`);
            }
            setSent(true);
        } catch (e) {
            setError(`${strings.error}: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider', textAlign: 'left' }}>
            <Typography variant="subtitle2" gutterBottom>{strings.title}</Typography>
            <Rating
                value={rating}
                onChange={(_, v) => setRating(v)}
                size="large"
                disabled={busy}
            />
            {rating !== null && (
                <>
                    <TextField
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                        label={strings.commentLabel}
                        helperText={strings.commentHint}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        disabled={busy}
                        sx={{ mt: 1 }}
                        slotProps={{ htmlInput: { maxLength: 2000 } }}
                    />
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleSend}
                        disabled={busy}
                        sx={{ mt: 1 }}
                    >
                        {busy ? <CircularProgress size={18} /> : strings.send}
                    </Button>
                </>
            )}
            {error && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>{error}</Typography>
            )}
        </Box>
    );
};

export default FeedbackWidget;

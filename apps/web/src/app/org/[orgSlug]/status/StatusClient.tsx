'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button } from '@mui/material';
import { getStrings } from '@/strings';
import { body, c, gutter, h2, lede, mono } from '@/app/style/tokens';

type Reminder = { canRemindAt: string | null; remaining: number };
type Status = {
    status: 'waiting' | 'issued';
    submittedAt: string;
    issuedAt: string | null;
    deletedAt: string | null;
    digipost: { status: 'queued' | 'sent' | 'failed'; sentAt: string | null } | null;
    reminder: Reminder | null;
};

type View = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ok'; status: Status };

// The secret sits after the "#", which a browser never sends to a server.
const tokenFromAddress = () => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));

const StatusClient: React.FC<{ orgSlug: string; lang?: string }> = ({ orgSlug, lang }) => {
    const s = getStrings(lang).status;
    const [view, setView] = useState<View>({ kind: 'loading' });
    const [busy, setBusy] = useState(false);
    const [reminded, setReminded] = useState(false);
    // Read once and kept: the header's language links drop the "#" part.
    const token = useRef('');

    const call = useCallback(
        (path: string) => {
            token.current ||= tokenFromAddress();
            return fetch(`/api/v1/org/${encodeURIComponent(orgSlug)}/${path}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token: token.current }),
            });
        },
        [orgSlug],
    );

    useEffect(() => {
        call('status')
            .then(async (res) => {
                if (res.status === 404) return setView({ kind: 'missing' });
                if (!res.ok) return setView({ kind: 'error' });
                setView({ kind: 'ok', status: await res.json() });
            })
            .catch(() => setView({ kind: 'error' }));
    }, [call]);

    useEffect(() => {
        if (token.current && !window.location.hash) {
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${token.current}`);
        }
    }, [lang]);

    const when = (iso: string) =>
        new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'nb-NO', { dateStyle: 'long', timeStyle: 'short' });
    const day = (iso: string) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nb-NO', { dateStyle: 'long' });

    const remind = async () => {
        if (view.kind !== 'ok') return;
        setBusy(true);
        try {
            const res = await call('status/remind');
            const json = await res.json().catch(() => ({}));
            if (json.reminder) setView({ kind: 'ok', status: { ...view.status, reminder: json.reminder } });
            if (res.ok) setReminded(true);
        } finally {
            setBusy(false);
        }
    };

    const Row = ({ label, value }: { label: string; value: string }) => (
        <Box sx={{ display: 'flex', gap: 3, py: 1.5, borderTop: `1px solid ${c.ruleSoft}` }}>
            <Box sx={{ ...mono, width: 150, flexShrink: 0, lineHeight: 1.6 }}>{label}</Box>
            <Box sx={{ ...body, color: c.ink }}>{value}</Box>
        </Box>
    );

    return (
        <Box component="main" sx={{ px: gutter, py: { xs: 5, md: 8 }, maxWidth: 720 }}>
            <Box component="h1" sx={{ ...h2, fontSize: 28, mb: 2 }}>{s.title}</Box>

            {view.kind === 'loading' && <Box sx={body}>{s.loading}</Box>}
            {view.kind === 'error' && <Box role="alert" sx={body}>{s.error}</Box>}
            {view.kind === 'missing' && (
                <>
                    <Box sx={{ ...lede, mb: 2 }}>{s.missingTitle}</Box>
                    <Box sx={body}>{s.missingBody}</Box>
                </>
            )}

            {view.kind === 'ok' && (
                <>
                    <Box sx={{ ...lede, mb: 3 }}>
                        {view.status.status === 'issued' ? s.issuedLede : s.waitingLede}
                    </Box>
                    <Row label={s.submitted} value={when(view.status.submittedAt)} />
                    {view.status.issuedAt && <Row label={s.issued} value={when(view.status.issuedAt)} />}
                    {view.status.digipost && (
                        <Row
                            label="Digipost"
                            value={
                                view.status.digipost.status === 'sent' && view.status.digipost.sentAt
                                    ? s.digipostSent(when(view.status.digipost.sentAt))
                                    : s.digipost[view.status.digipost.status]
                            }
                        />
                    )}
                    {view.status.deletedAt && <Row label={s.deleted} value={when(view.status.deletedAt)} />}

                    {view.status.reminder && (
                        <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${c.rule}` }}>
                            {reminded ? (
                                <Box role="status" sx={body}>{s.reminderSent}</Box>
                            ) : view.status.reminder.canRemindAt === null ? (
                                <Box sx={body}>{s.reminderUsedUp}</Box>
                            ) : Date.parse(view.status.reminder.canRemindAt) > Date.now() ? (
                                <Box sx={body}>{s.reminderLater(day(view.status.reminder.canRemindAt))}</Box>
                            ) : (
                                <>
                                    <Box sx={{ ...body, mb: 2 }}>{s.reminderOffer}</Box>
                                    <Button variant="contained" onClick={remind} disabled={busy}>
                                        {s.reminderButton}
                                    </Button>
                                </>
                            )}
                        </Box>
                    )}
                </>
            )}

            <Box sx={{ ...body, mt: 5, color: c.inkFaint }}>{s.privacy}</Box>
        </Box>
    );
};

export default StatusClient;

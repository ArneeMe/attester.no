'use client'
import React, { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    Paper,
    TextField,
    Typography,
} from '@mui/material';
import { authHeader } from '@/lib/nhost';
import { useToast } from '@/components/ToastProvider';
import type { Strings } from '@/strings';

type OrgRequest = {
    id: string;
    requestedSlug: string;
    organizationName: string;
    orgNumber: string | null;
    contactEmail: string;
    contactName: string | null;
    message: string | null;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    handledAt: string | null;
};

type Props = { strings: Strings; lang: string; onApproved: () => void };

const OrgRequests: React.FC<Props> = ({ strings, lang, onApproved }) => {
    const a = strings.admin.platform.requests;
    const toast = useToast();
    const [requests, setRequests] = useState<OrgRequest[] | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    const [slug, setSlug] = useState('');
    const [organizationName, setOrganizationName] = useState('');
    const [busy, setBusy] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/org-requests', { headers: authHeader() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setRequests(json.requests ?? []);
        } catch {
            setRequests([]);
            toast.error(a.loadError);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { load(); }, [load]);

    const startApprove = (r: OrgRequest) => {
        setEditing(r.id);
        setSlug(r.requestedSlug);
        setOrganizationName(r.organizationName);
        setInviteLink(null);
    };

    const send = async (id: string, action: 'approve' | 'reject') => {
        if (busy) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/org-requests/${encodeURIComponent(id)}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', ...authHeader() },
                body: JSON.stringify(
                    action === 'approve' ? { action, slug, organizationName } : { action },
                ),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            if (action === 'reject') {
                toast.success(a.rejected);
            } else {
                toast.success(a.approved(json.organization.name));
                setInviteLink(json.inviteLink);
                onApproved();
            }
            setEditing(null);
            await load();
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    if (requests === null) {
        return (
            <Paper sx={{ p: 3, mb: 3, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={24} />
            </Paper>
        );
    }

    const pending = requests.filter((r) => r.status === 'pending');
    const handled = requests.filter((r) => r.status !== 'pending');
    const locale = lang === 'en' ? 'en-GB' : 'nb-NO';

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>{a.title(pending.length)}</Typography>

            {inviteLink && (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>{a.inviteLink}</Typography>
                    <TextField size="small" fullWidth value={inviteLink} slotProps={{ input: { readOnly: true } }} />
                </Box>
            )}

            {pending.length === 0 && handled.length === 0 && (
                <Typography variant="body2" color="text.secondary">{a.empty}</Typography>
            )}

            <List disablePadding>
                {pending.map((r) => (
                    <ListItem key={r.id} divider sx={{ display: 'block', px: 0, py: 2 }}>
                        <ListItemText
                            primary={r.organizationName}
                            secondary={
                                <>
                                    /org/{r.requestedSlug} · {r.contactEmail}
                                    {r.contactName ? ` · ${r.contactName}` : ''}
                                    {r.orgNumber ? ` · ${a.orgNumber} ${r.orgNumber}` : ''}
                                    {' · '}
                                    {new Date(r.createdAt).toLocaleDateString(locale)}
                                </>
                            }
                        />
                        {r.message && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                {r.message}
                            </Typography>
                        )}

                        {editing === r.id ? (
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                                <TextField
                                    size="small"
                                    label={strings.admin.platform.slug}
                                    helperText={strings.admin.platform.slugHelp}
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                                    disabled={busy}
                                />
                                <TextField
                                    size="small"
                                    label={strings.admin.platform.name}
                                    value={organizationName}
                                    onChange={(e) => setOrganizationName(e.target.value)}
                                    disabled={busy}
                                    sx={{ minWidth: 240 }}
                                />
                                <Button
                                    variant="contained"
                                    onClick={() => send(r.id, 'approve')}
                                    disabled={busy || !slug || !organizationName}
                                    sx={{ alignSelf: 'flex-start', mt: 0.25 }}
                                >
                                    {busy ? <CircularProgress size={20} /> : a.confirm}
                                </Button>
                                <Button
                                    onClick={() => setEditing(null)}
                                    disabled={busy}
                                    sx={{ alignSelf: 'flex-start', mt: 0.25 }}
                                >
                                    {a.cancel}
                                </Button>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                <Button size="small" variant="contained" onClick={() => startApprove(r)}>
                                    {a.approve}
                                </Button>
                                <Button
                                    size="small"
                                    color="error"
                                    onClick={() => send(r.id, 'reject')}
                                    disabled={busy}
                                >
                                    {a.reject}
                                </Button>
                            </Box>
                        )}
                    </ListItem>
                ))}
            </List>

            {handled.length > 0 && (
                <List disablePadding sx={{ mt: 2, opacity: 0.65 }}>
                    {handled.map((r) => (
                        <ListItem key={r.id} sx={{ px: 0, py: 0.5 }}>
                            <ListItemText
                                primary={`${r.organizationName} — /org/${r.requestedSlug}`}
                                secondary={`${a.handled}: ${r.status}`}
                                slotProps={{ primary: { variant: 'body2' } }}
                            />
                            <Chip size="small" label={r.status} />
                        </ListItem>
                    ))}
                </List>
            )}
        </Paper>
    );
};

export default OrgRequests;

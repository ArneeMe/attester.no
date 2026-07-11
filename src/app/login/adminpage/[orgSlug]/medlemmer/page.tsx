'use client'
export const runtime = 'edge';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    Box, Button, CircularProgress, IconButton, List, ListItem, ListItemText,
    Paper, TextField, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { authHeader } from '@/lib/nhost';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/util/confirmDialog';

type Member = {
    userId: string;
    role: string;
    email: string | null;
    displayName: string | null;
    isSelf: boolean;
};

const MembersPage: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const toast = useToast();
    const [members, setMembers] = useState<Member[] | null>(null);
    const [newEmail, setNewEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [toRemove, setToRemove] = useState<Member | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/members`, {
                headers: authHeader(),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            setMembers(json.members);
        } catch (e) {
            toast.error(`Kunne ikke laste medlemmer: ${(e as Error).message}`);
            setMembers([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgSlug]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy || !newEmail) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/members`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', ...authHeader() },
                body: JSON.stringify({ email: newEmail }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            setNewEmail('');
            toast.success('Medlem lagt til');
            await load();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async () => {
        if (!toRemove) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/members`, {
                method: 'DELETE',
                headers: { 'content-type': 'application/json', ...authHeader() },
                body: JSON.stringify({ userId: toRemove.userId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            toast.success('Medlemmet er fjernet');
            setToRemove(null);
            await load();
        } catch (err) {
            toast.error((err as Error).message);
            setToRemove(null);
        }
    };

    return (
        <>
            <Typography variant="h4" gutterBottom>Medlemmer</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Alle medlemmer kan godkjenne innsendinger, utstede attester og
                redigere maler og innhold for organisasjonen.
            </Typography>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Legg til medlem</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Personen må ha en brukerkonto — nye brukere kan opprette en
                    selv på attester.no/registrer. Skriv inn e-postadressen
                    kontoen er registrert med.
                </Typography>
                <Box component="form" onSubmit={handleAdd} sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        size="small"
                        type="email"
                        label="E-post"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        disabled={busy}
                        sx={{ flex: 1, maxWidth: 400 }}
                    />
                    <Button type="submit" variant="contained" disabled={busy || !newEmail}>
                        {busy ? <CircularProgress size={20} /> : 'Legg til'}
                    </Button>
                </Box>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Nåværende medlemmer</Typography>
                {members === null ? (
                    <CircularProgress size={24} />
                ) : members.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Ingen medlemmer funnet.</Typography>
                ) : (
                    <List>
                        {members.map((m) => (
                            <ListItem
                                key={m.userId}
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        aria-label="Fjern medlem"
                                        onClick={() => setToRemove(m)}
                                        disabled={members.length <= 1}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                }
                            >
                                <ListItemText
                                    primary={
                                        (m.displayName || m.email || m.userId)
                                        + (m.isSelf ? ' (deg)' : '')
                                    }
                                    secondary={m.displayName ? m.email : null}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Paper>

            <ConfirmDialog
                open={toRemove !== null}
                title="Fjern medlem"
                message={
                    toRemove?.isSelf
                        ? 'Du er i ferd med å fjerne deg selv fra organisasjonen. Du mister tilgangen umiddelbart. Er du sikker?'
                        : `Vil du fjerne ${toRemove?.displayName || toRemove?.email || 'medlemmet'} fra organisasjonen?`
                }
                onConfirm={handleRemove}
                onClose={() => setToRemove(null)}
                confirmButtonText="Fjern"
            />
        </>
    );
};

export default MembersPage;

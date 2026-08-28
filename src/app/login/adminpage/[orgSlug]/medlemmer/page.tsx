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
import { useAdminLang } from '@/util/useAdminLang';

type Member = {
    userId: string;
    role: string;
    email: string | null;
    displayName: string | null;
    isSelf: boolean;
};

const MembersPage: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const { strings } = useAdminLang();
    const a = strings.admin.members;
    const toast = useToast();
    const [members, setMembers] = useState<Member[] | null>(null);
    const [newEmail, setNewEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [toRemove, setToRemove] = useState<Member | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [inviteEmailed, setInviteEmailed] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/members`, {
                headers: authHeader(),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            setMembers(json.members);
        } catch (e) {
            toast.error(`${a.loadError}: ${(e as Error).message}`);
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
            if (res.status === 404) {
                // No account yet — create an invite instead. The link joins
                // them to the org automatically once they register/log in
                // with the invited email.
                const invRes = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/invites`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', ...authHeader() },
                    body: JSON.stringify({ email: newEmail }),
                });
                const invJson = await invRes.json();
                if (!invRes.ok) throw new Error(invJson.error ?? `HTTP ${invRes.status}`);
                setInviteLink(invJson.link);
                setInviteEmailed(invJson.emailed);
                setNewEmail('');
                return;
            }
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            setNewEmail('');
            toast.success(a.added);
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
            toast.success(a.removed);
            setToRemove(null);
            await load();
        } catch (err) {
            toast.error((err as Error).message);
            setToRemove(null);
        }
    };

    return (
        <>
            <Typography variant="h4" gutterBottom>{a.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {a.intro}
            </Typography>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>{a.addTitle}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {a.addIntro}
                </Typography>
                <Box component="form" onSubmit={handleAdd} sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                        size="small"
                        type="email"
                        label={a.email}
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        disabled={busy}
                        sx={{ flex: 1, maxWidth: 400 }}
                    />
                    <Button type="submit" variant="contained" disabled={busy || !newEmail}>
                        {busy ? <CircularProgress size={20} /> : a.addButton}
                    </Button>
                </Box>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>{a.listTitle}</Typography>
                {members === null ? (
                    <CircularProgress size={24} />
                ) : members.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">{a.emptyList}</Typography>
                ) : (
                    <List>
                        {members.map((m) => (
                            <ListItem
                                key={m.userId}
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        aria-label={a.removeAria}
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
                                        + (m.isSelf ? a.you : '')
                                    }
                                    secondary={m.displayName ? m.email : null}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Paper>

            <ConfirmDialog
                open={inviteLink !== null}
                title={a.inviteTitle}
                message={inviteEmailed ? a.inviteEmailedMsg : a.inviteLinkMsg}
                details={inviteLink ? (
                    <Typography variant="body2" sx={{ wordBreak: 'break-all', mt: 1 }}>
                        <code>{inviteLink}</code>
                    </Typography>
                ) : null}
                onConfirm={async () => {
                    try {
                        await navigator.clipboard.writeText(inviteLink ?? '');
                        toast.success(a.linkCopied);
                    } catch {
                        toast.error(a.copyFailed);
                    }
                }}
                onClose={() => setInviteLink(null)}
                confirmButtonText={a.copyLink}
                secondaryAction={{ label: a.close, onClick: () => setInviteLink(null) }}
                showCancelButton={false}
            />

            <ConfirmDialog
                open={toRemove !== null}
                title={a.removeTitle}
                message={
                    toRemove?.isSelf
                        ? a.removeSelfMsg
                        : a.removeMsg(toRemove?.displayName || toRemove?.email || '')
                }
                onConfirm={handleRemove}
                onClose={() => setToRemove(null)}
                confirmButtonText={a.removeButton}
            />
        </>
    );
};

export default MembersPage;

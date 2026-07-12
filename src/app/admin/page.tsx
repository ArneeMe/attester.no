'use client'
export const runtime = 'edge';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Box, Button, CircularProgress, Container, List, ListItem, ListItemText,
    Paper, TextField, Typography,
} from '@mui/material';
import { authHeader } from '@/lib/nhost';
import { useAuth } from '@/util/auth';
import { useToast } from '@/components/ToastProvider';

type Org = { id: string; slug: string; name: string };

const PlatformAdminPage: React.FC = () => {
    const user = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [orgs, setOrgs] = useState<Org[] | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const [slug, setSlug] = useState('');
    const [name, setName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/orgs', { headers: authHeader() });
            if (res.status === 401 || res.status === 403) {
                setForbidden(true);
                return;
            }
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            setOrgs(json.organizations);
        } catch (e) {
            toast.error(`Kunne ikke laste organisasjoner: ${(e as Error).message}`);
            setOrgs([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (user === null) router.replace('/login');
        if (user) load();
    }, [user, router, load]);

    const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
            const res = await fetch('/api/admin/orgs', {
                method: 'POST',
                headers: { 'content-type': 'application/json', ...authHeader() },
                body: JSON.stringify({ slug, name, adminEmail }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            toast.success(`Organisasjonen "${json.organization.name}" er opprettet med ${json.firstMember} som første medlem`);
            setSlug(''); setName(''); setAdminEmail('');
            await load();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    if (user === undefined || (user && orgs === null && !forbidden)) {
        return (
            <Container maxWidth="md" sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    if (forbidden) {
        return (
            <Container maxWidth="md" sx={{ py: 6 }}>
                <Typography variant="h5" gutterBottom>Ingen tilgang</Typography>
                <Typography variant="body1" color="text.secondary">
                    Denne siden er kun for plattform-administratorer
                    (styrt av <code>PLATFORM_ADMIN_EMAILS</code>).
                </Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Typography variant="h4" gutterBottom>Plattform-administrasjon</Typography>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Opprett ny organisasjon</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Første medlem må allerede ha en brukerkonto (opprettes på /registrer).
                    Medlemmet kan deretter selv legge til flere under «Medlemmer».
                </Typography>
                <Box component="form" onSubmit={handleCreate}
                     sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField
                        size="small"
                        label="Slug (URL-navn)"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase())}
                        disabled={busy}
                        helperText="Små bokstaver, tall, bindestrek"
                    />
                    <TextField
                        size="small"
                        label="Navn"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                    />
                    <TextField
                        size="small"
                        type="email"
                        label="Første medlems e-post"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        disabled={busy}
                        sx={{ minWidth: 240 }}
                    />
                    <Button type="submit" variant="contained"
                            disabled={busy || !slug || !name || !adminEmail}
                            sx={{ alignSelf: 'flex-start', mt: 0.25 }}>
                        {busy ? <CircularProgress size={20} /> : 'Opprett'}
                    </Button>
                </Box>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Organisasjoner ({orgs?.length ?? 0})
                </Typography>
                <List>
                    {(orgs ?? []).map((org) => (
                        <ListItem
                            key={org.id}
                            secondaryAction={
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button size="small" component={Link} href={`/org/${org.slug}`} target="_blank">
                                        Skjema ↗
                                    </Button>
                                    <Button size="small" component={Link} href={`/login/adminpage/${org.slug}`}>
                                        Admin
                                    </Button>
                                </Box>
                            }
                        >
                            <ListItemText primary={org.name} secondary={`/org/${org.slug}`} />
                        </ListItem>
                    ))}
                </List>
            </Paper>
        </Container>
    );
};

export default PlatformAdminPage;

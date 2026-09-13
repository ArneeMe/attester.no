'use client'
export const runtime = 'edge';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Box, Button, CircularProgress, List, ListItem, ListItemText,
    Paper, TextField, Typography,
} from '@mui/material';
import { authHeader } from '@/lib/nhost';
import { useAuth } from '@/util/auth';
import { useToast } from '@/components/ToastProvider';
import { useAdminLang } from '@/util/useAdminLang';
import OrgRequests from './OrgRequests';
import Shell from '@/components/landing/SignedInShell';
import { headerLink } from '@/components/landing/SiteHeader';

type Org = { id: string; slug: string; name: string };

const PlatformAdminPage: React.FC = () => {
    const user = useAuth();
    const router = useRouter();
    const toast = useToast();
    const { lang, setLang, strings } = useAdminLang();
    const a = strings.admin.platform;

    const [orgs, setOrgs] = useState<Org[] | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const [expired, setExpired] = useState(false);
    const [slug, setSlug] = useState('');
    const [name, setName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/orgs', { headers: authHeader() });
            if (res.status === 401) {
                setExpired(true);
                return;
            }
            if (res.status === 403) {
                setForbidden(true);
                return;
            }
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
            setOrgs(json.organizations);
        } catch (e) {
            toast.error(`${a.loadError}: ${(e as Error).message}`);
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
            toast.success(a.created(json.organization.name, json.firstMember));
            setSlug(''); setName(''); setAdminEmail('');
            await load();
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    if (user === undefined || (user && orgs === null && !forbidden && !expired)) {
        return (
            <Shell><Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box></Shell>
        );
    }

    if (expired) {
        return (
            <Shell><Box>
                <Typography variant="h5" gutterBottom>{strings.admin.session.expiredTitle}</Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    {strings.admin.session.expiredBody}
                </Typography>
                <Button component={Link} href="/login" variant="contained">
                    {strings.admin.session.loginButton}
                </Button>
            </Box></Shell>
        );
    }

    if (forbidden) {
        return (
            <Shell><Box>
                <Typography variant="h5" gutterBottom>{a.forbiddenTitle}</Typography>
                <Typography variant="body1" color="text.secondary">
                    {a.forbiddenBody}
                </Typography>
            </Box></Shell>
        );
    }

    return (
        <Shell
            right={
                <Box
                    component="button"
                    type="button"
                    onClick={() => setLang(lang === 'no' ? 'en' : 'no')}
                    aria-label="Bytt språk / switch language"
                    sx={headerLink}
                >
                    {lang === 'no' ? 'EN' : 'NO'}
                </Box>
            }
        >
            <Typography variant="h4" gutterBottom>{a.title}</Typography>

            <OrgRequests strings={strings} lang={lang} onApproved={load} />

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>{a.createTitle}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {a.createIntro}
                </Typography>
                <Box component="form" onSubmit={handleCreate}
                     sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField
                        size="small"
                        label={a.slug}
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase())}
                        disabled={busy}
                        helperText={a.slugHelp}
                    />
                    <TextField
                        size="small"
                        label={a.name}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                    />
                    <TextField
                        size="small"
                        type="email"
                        label={a.firstMember}
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        disabled={busy}
                        sx={{ minWidth: 240 }}
                    />
                    <Button type="submit" variant="contained"
                            disabled={busy || !slug || !name || !adminEmail}
                            sx={{ alignSelf: 'flex-start', mt: 0.25 }}>
                        {busy ? <CircularProgress size={20} /> : a.createButton}
                    </Button>
                </Box>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                    {a.listTitle(orgs?.length ?? 0)}
                </Typography>
                <List>
                    {(orgs ?? []).map((org) => (
                        <ListItem
                            key={org.id}
                            secondaryAction={
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button size="small" component={Link} href={`/org/${org.slug}`} target="_blank">
                                        {a.formLink}
                                    </Button>
                                    <Button size="small" component={Link} href={`/login/adminpage/${org.slug}`}>
                                        {a.adminLink}
                                    </Button>
                                </Box>
                            }
                        >
                            <ListItemText primary={org.name} secondary={`/org/${org.slug}`} />
                        </ListItem>
                    ))}
                </List>
            </Paper>
        </Shell>
    );
};

export default PlatformAdminPage;

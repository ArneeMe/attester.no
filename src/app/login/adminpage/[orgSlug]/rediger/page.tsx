'use client'
export const runtime = 'edge';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControlLabel,
    Grid,
    IconButton,
    Paper,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ImageUpload from '@/app/login/adminpage/[orgSlug]/rediger/ImageUpload';
import { useToast } from '@/components/ToastProvider';
import {
    createOrgAsset,
    deleteOrgAsset,
    listOrgAssets,
    updateOrgAsset,
} from '@/util/databaseInteractions/orgAssets';
import type {
    BodyTextContent,
    LogoContent,
    LookupItem,
    LookupListContent,
    OrgAsset,
    SignatureContent,
} from '@/types/orgAssets';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
    return (
        <div hidden={value !== index}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

/**
 * Wraps an async save with consistent toast + saving-flag handling so each
 * row component doesn't need its own try/catch/finally boilerplate.
 */
function useSaveHandler(label: string, fn: () => Promise<void>) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const save = async () => {
        setSaving(true);
        try {
            await fn();
            toast.success(`${label} lagret`);
        } catch (e) {
            toast.error(`Kunne ikke lagre ${label}: ${(e as Error).message}`);
        } finally {
            setSaving(false);
        }
    };
    return { saving, save };
}

const RedigerPage: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const toast = useToast();
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<OrgAsset[]>([]);

    const reload = async () => {
        try {
            setAssets(await listOrgAssets(orgSlug));
        } catch (e) {
            toast.error('Kunne ikke laste innholdsbiblioteket: ' + (e as Error).message);
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            await reload();
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgSlug]);

    const signatures = assets.filter((a) => a.kind === 'signature');
    const logos = assets.filter((a) => a.kind === 'logo');
    const bodyTexts = assets.filter((a) => a.kind === 'body_text');
    const lookupLists = assets.filter((a) => a.kind === 'lookup_list');

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Innholdsbibliotek
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Det du legger inn her kan gjenbrukes på tvers av maler. Sett ting som
                «standard» for å bruke dem som default på nye attester.
            </Typography>

            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label={`Signaturer (${signatures.length})`} />
                <Tab label={`Logoer (${logos.length})`} />
                <Tab label={`Tekstblokker (${bodyTexts.length})`} />
                <Tab label={`Oppslagslister (${lookupLists.length})`} />
            </Tabs>

            <TabPanel value={tab} index={0}>
                <SignaturesPanel orgSlug={orgSlug} assets={signatures} reload={reload} />
            </TabPanel>
            <TabPanel value={tab} index={1}>
                <LogosPanel orgSlug={orgSlug} assets={logos} reload={reload} />
            </TabPanel>
            <TabPanel value={tab} index={2}>
                <BodyTextsPanel orgSlug={orgSlug} assets={bodyTexts} reload={reload} />
            </TabPanel>
            <TabPanel value={tab} index={3}>
                <LookupListsPanel orgSlug={orgSlug} assets={lookupLists} reload={reload} />
            </TabPanel>
        </Box>
    );
};

export default RedigerPage;

type PanelProps = { orgSlug: string; assets: OrgAsset[]; reload: () => Promise<void> };

function useAdd(orgSlug: string, reload: () => Promise<void>, label: string) {
    const toast = useToast();
    return async (
        body: { kind: OrgAsset['kind']; name: string; content: OrgAsset['content']; sortOrder?: number; isDefault?: boolean },
    ) => {
        try {
            await createOrgAsset(orgSlug, body);
            await reload();
            toast.success(`${label} lagt til`);
        } catch (e) {
            toast.error(`Kunne ikke legge til: ${(e as Error).message}`);
        }
    };
}

function useDelete(orgSlug: string, reload: () => Promise<void>, label: string) {
    const toast = useToast();
    return async (id: string) => {
        try {
            await deleteOrgAsset(orgSlug, id);
            await reload();
            toast.success(`${label} slettet`);
        } catch (e) {
            toast.error(`Kunne ikke slette: ${(e as Error).message}`);
        }
    };
}

// ───────────── Signatures ─────────────

const SignaturesPanel: React.FC<PanelProps> = ({ orgSlug, assets, reload }) => {
    const add = useAdd(orgSlug, reload, 'Signatur');
    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Signaturer
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Personer som signerer attestene (navn, rolle, telefon, bilde).
            </Typography>

            {assets.map((a) => (
                <SignatureRow key={a.id} orgSlug={orgSlug} asset={a} reload={reload} />
            ))}

            <Button
                startIcon={<AddIcon />}
                onClick={() =>
                    add({
                        kind: 'signature',
                        name: 'Ny signatur',
                        content: { photo: '', role: '', phone: '' } as SignatureContent,
                        isDefault: true,
                        sortOrder: assets.length,
                    })
                }
            >
                Legg til signatur
            </Button>
        </Paper>
    );
};

const SignatureRow: React.FC<{ orgSlug: string; asset: OrgAsset; reload: () => Promise<void> }> = ({
    orgSlug,
    asset,
    reload,
}) => {
    const c = asset.content as SignatureContent;
    const [name, setName] = useState(asset.name);
    const [role, setRole] = useState(c.role ?? '');
    const [phone, setPhone] = useState(c.phone ?? '');
    const [photo, setPhoto] = useState(c.photo ?? '');
    const [isDefault, setIsDefault] = useState(asset.isDefault);
    const remove = useDelete(orgSlug, reload, 'Signatur');
    const { saving, save } = useSaveHandler('Signatur', () =>
        updateOrgAsset(orgSlug, asset.id, { name, content: { photo, role, phone }, isDefault }).then(() => undefined),
    );

    return (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">{name || 'Uten navn'}</Typography>
                        <Box>
                            <FormControlLabel
                                control={<Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
                                label="Standard"
                            />
                            <Button size="small" onClick={save} disabled={saving}>
                                {saving ? 'Lagrer...' : 'Lagre'}
                            </Button>
                            <IconButton
                                color="error"
                                onClick={() => {
                                    if (!confirm('Slette denne signaturen?')) return;
                                    remove(asset.id);
                                }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Box>
                    </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth label="Navn" value={name} onChange={(e) => setName(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth label="Rolle" value={role} onChange={(e) => setRole(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth label="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <ImageUpload label="Signaturbilde" value={photo} onChange={setPhoto} maxSizeKB={500} />
                </Grid>
            </Grid>
        </Paper>
    );
};

// ───────────── Logos ─────────────

const LogosPanel: React.FC<PanelProps> = ({ orgSlug, assets, reload }) => {
    const add = useAdd(orgSlug, reload, 'Logo');
    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Logoer
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Bilder du vil plassere på attestene som logoer.
            </Typography>

            {assets.map((a) => (
                <LogoRow key={a.id} orgSlug={orgSlug} asset={a} reload={reload} />
            ))}

            <Button
                startIcon={<AddIcon />}
                onClick={() =>
                    add({
                        kind: 'logo',
                        name: 'Ny logo',
                        content: { image: '' } as LogoContent,
                        isDefault: true,
                        sortOrder: assets.length,
                    })
                }
            >
                Legg til logo
            </Button>
        </Paper>
    );
};

const LogoRow: React.FC<{ orgSlug: string; asset: OrgAsset; reload: () => Promise<void> }> = ({
    orgSlug,
    asset,
    reload,
}) => {
    const c = asset.content as LogoContent;
    const [name, setName] = useState(asset.name);
    const [image, setImage] = useState(c.image ?? '');
    const [isDefault, setIsDefault] = useState(asset.isDefault);
    const remove = useDelete(orgSlug, reload, 'Logo');
    const { saving, save } = useSaveHandler('Logo', () =>
        updateOrgAsset(orgSlug, asset.id, { name, content: { image }, isDefault }).then(() => undefined),
    );

    return (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <TextField label="Navn" value={name} onChange={(e) => setName(e.target.value)} size="small" />
                        <Box>
                            <FormControlLabel
                                control={<Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
                                label="Standard"
                            />
                            <Button size="small" onClick={save} disabled={saving}>
                                {saving ? 'Lagrer...' : 'Lagre'}
                            </Button>
                            <IconButton
                                color="error"
                                onClick={() => {
                                    if (!confirm('Slette denne logoen?')) return;
                                    remove(asset.id);
                                }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Box>
                    </Box>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <ImageUpload label="Logobilde" value={image} onChange={setImage} maxSizeKB={500} />
                </Grid>
            </Grid>
        </Paper>
    );
};

// ───────────── Body Texts ─────────────

const BodyTextsPanel: React.FC<PanelProps> = ({ orgSlug, assets, reload }) => {
    const add = useAdd(orgSlug, reload, 'Tekstblokk');
    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Tekstblokker
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Lengre tekstavsnitt du vil gjenbruke i attester (organisasjonsinfo, ansvarsfraskrivelser, osv.).
            </Typography>

            {assets.map((a) => (
                <BodyTextRow key={a.id} orgSlug={orgSlug} asset={a} reload={reload} />
            ))}

            <Button
                startIcon={<AddIcon />}
                onClick={() =>
                    add({
                        kind: 'body_text',
                        name: 'Ny tekstblokk',
                        content: { text: '' } as BodyTextContent,
                        isDefault: true,
                        sortOrder: assets.length,
                    })
                }
            >
                Legg til tekstblokk
            </Button>
        </Paper>
    );
};

const BodyTextRow: React.FC<{ orgSlug: string; asset: OrgAsset; reload: () => Promise<void> }> = ({
    orgSlug,
    asset,
    reload,
}) => {
    const c = asset.content as BodyTextContent;
    const [name, setName] = useState(asset.name);
    const [text, setText] = useState(c.text ?? '');
    const [isDefault, setIsDefault] = useState(asset.isDefault);
    const remove = useDelete(orgSlug, reload, 'Tekstblokk');
    const { saving, save } = useSaveHandler('Tekstblokk', () =>
        updateOrgAsset(orgSlug, asset.id, { name, content: { text }, isDefault }).then(() => undefined),
    );

    return (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <TextField label="Tittel" value={name} onChange={(e) => setName(e.target.value)} size="small" />
                        <Box>
                            <FormControlLabel
                                control={<Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
                                label="Standard"
                            />
                            <Button size="small" onClick={save} disabled={saving}>
                                {saving ? 'Lagrer...' : 'Lagre'}
                            </Button>
                            <IconButton
                                color="error"
                                onClick={() => {
                                    if (!confirm('Slette denne tekstblokken?')) return;
                                    remove(asset.id);
                                }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Box>
                    </Box>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TextField
                        fullWidth
                        multiline
                        rows={6}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Tekst..."
                    />
                </Grid>
            </Grid>
        </Paper>
    );
};

// ───────────── Lookup Lists ─────────────

const LookupListsPanel: React.FC<PanelProps> = ({ orgSlug, assets, reload }) => {
    const add = useAdd(orgSlug, reload, 'Liste');
    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Oppslagslister
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Lister med navngitte oppføringer som hver kan ha en beskrivelse. Brukes
                til nedtrekkslister i skjemaet hvor valget kan trekke inn ekstra tekst
                på attesten (f.eks. echo sine undergrupper med beskrivelse).
            </Typography>

            {assets.map((a) => (
                <LookupListRow key={a.id} orgSlug={orgSlug} asset={a} reload={reload} />
            ))}

            <Button
                startIcon={<AddIcon />}
                onClick={() =>
                    add({
                        kind: 'lookup_list',
                        name: 'Ny liste',
                        content: { items: [] } as LookupListContent,
                        isDefault: true,
                        sortOrder: assets.length,
                    })
                }
            >
                Legg til liste
            </Button>
        </Paper>
    );
};

const LookupListRow: React.FC<{ orgSlug: string; asset: OrgAsset; reload: () => Promise<void> }> = ({
    orgSlug,
    asset,
    reload,
}) => {
    const initial = asset.content as LookupListContent;
    const [name, setName] = useState(asset.name);
    const [items, setItems] = useState<LookupItem[]>(initial.items ?? []);
    const [isDefault, setIsDefault] = useState(asset.isDefault);
    const remove = useDelete(orgSlug, reload, 'Liste');
    const { saving, save } = useSaveHandler('Liste', () =>
        updateOrgAsset(orgSlug, asset.id, { name, content: { items }, isDefault }).then(() => undefined),
    );

    const setItem = (i: number, field: keyof LookupItem, value: string) => {
        const next = [...items];
        next[i] = { ...next[i], [field]: value };
        setItems(next);
    };

    return (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <TextField label="Navn på liste" value={name} onChange={(e) => setName(e.target.value)} size="small" />
                <Box>
                    <FormControlLabel
                        control={<Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
                        label="Standard"
                    />
                    <Button size="small" onClick={save} disabled={saving}>
                        {saving ? 'Lagrer...' : 'Lagre'}
                    </Button>
                    <IconButton
                        color="error"
                        onClick={() => {
                            if (!confirm('Slette denne listen?')) return;
                            remove(asset.id);
                        }}
                    >
                        <DeleteIcon />
                    </IconButton>
                </Box>
            </Box>

            {items.map((it, i) => (
                <Grid container spacing={1} key={i} sx={{ mb: 1 }} alignItems="flex-start">
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField
                            fullWidth
                            label="Navn"
                            value={it.name}
                            onChange={(e) => setItem(i, 'name', e.target.value)}
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 8 }}>
                        <TextField
                            fullWidth
                            label="Beskrivelse"
                            value={it.description ?? ''}
                            onChange={(e) => setItem(i, 'description', e.target.value)}
                            size="small"
                            multiline
                            rows={2}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 1 }}>
                        <IconButton onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
                            <DeleteIcon />
                        </IconButton>
                    </Grid>
                </Grid>
            ))}

            <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={() => setItems([...items, { name: '', description: '' }])}
            >
                Legg til oppføring
            </Button>
        </Paper>
    );
};

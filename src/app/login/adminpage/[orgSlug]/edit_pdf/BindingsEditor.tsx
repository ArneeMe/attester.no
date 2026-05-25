'use client';

import React, { useMemo } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import type { Template } from '@pdfme/common';
import type { FieldBinding, FieldBindings, SystemSlot } from '@/types/fieldBindings';
import type { OrgAsset } from '@/types/orgAssets';
import type { FormSchema } from '@/types/formSchema';
import { listTemplateFieldNames } from '@/util/templateFields';
import { resolveBinding, type ResolveContext } from '@/util/resolveBinding';
import { buildSampleSubmission } from '@/util/sampleSubmission';

const SOURCE_OPTIONS = [
    { value: 'submission_implicit', label: 'Skjemafelt (samme navn)' },
    { value: 'submission', label: 'Skjemafelt (annet navn)' },
    { value: 'composite', label: 'Sammensatt tekst' },
    { value: 'system', label: 'Systemverdi (QR, dato …)' },
    { value: 'asset', label: 'Spesifikk asset' },
    { value: 'asset_default', label: 'Standard asset av type' },
    { value: 'lookup', label: 'Oppslag i liste' },
] as const;

const SYSTEM_SLOTS: { value: SystemSlot; label: string }[] = [
    { value: 'qr_code', label: 'QR-kode (URL)' },
    { value: 'qr_info', label: 'QR-info-tekst' },
    { value: 'qr_page', label: 'QR-side-URL' },
    { value: 'today', label: 'Dagens dato (dd.mm.yyyy)' },
];

const SYSTEM_FIELD_NAMES = new Set(['qr_code', 'qr_info', 'qr_page', 'today']);

type Props = {
    schemas: Template['schemas'];
    bindings: FieldBindings;
    assets: OrgAsset[];
    formSchema: FormSchema;
    onChange: (next: FieldBindings) => void;
};

export default function BindingsEditor({ schemas, bindings, assets, formSchema, onChange }: Props) {
    const fieldNames = listTemplateFieldNames(schemas);

    // Resolve every binding against placeholder data so the admin sees a
    // live preview of what each field would render to. Recomputes when
    // bindings, form schema, or assets change.
    const previewCtx = useMemo<ResolveContext>(() => {
        return {
            submission: buildSampleSubmission(formSchema, assets),
            assets,
            system: {
                today: new Date().toLocaleDateString('nb-NO'),
                qr_code: 'https://attester.no/...preview...',
                qr_info: 'Scan for å verifisere',
                qr_page: 'https://attester.no',
            },
        };
    }, [formSchema, assets]);

    if (fieldNames.length === 0) {
        return (
            <Paper sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    Ingen felter i malen ennå. Legg til tekst-, bilde-, eller QR-felter
                    i designeren over.
                </Typography>
            </Paper>
        );
    }

    return (
        <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                For hvert felt i PDF-en, bestem hvor verdien skal komme fra. Lar du
                den stå på «Skjemafelt (samme navn)» blir verdien hentet fra
                innsenderens skjema med samme nøkkel. Forhåndsvisningen viser
                hva som ville stått der med eksempeldata.
            </Typography>
            {fieldNames.map((name) => (
                <BindingRow
                    key={name}
                    name={name}
                    binding={bindings[name]}
                    assets={assets}
                    previewCtx={previewCtx}
                    onChange={(b) => {
                        if (b === null) {
                            const { [name]: _removed, ...rest } = bindings;
                            void _removed;
                            onChange(rest);
                        } else {
                            onChange({ ...bindings, [name]: b });
                        }
                    }}
                />
            ))}
        </Box>
    );
}

type BindingRowProps = {
    name: string;
    binding: FieldBinding | undefined;
    assets: OrgAsset[];
    previewCtx: ResolveContext;
    onChange: (next: FieldBinding | null) => void;
};

function inferSourceKind(name: string, binding: FieldBinding | undefined): (typeof SOURCE_OPTIONS)[number]['value'] {
    if (binding) return binding.source;
    if (SYSTEM_FIELD_NAMES.has(name)) return 'system';
    return 'submission_implicit';
}

function BindingRow({ name, binding, assets, previewCtx, onChange }: BindingRowProps) {
    const source = inferSourceKind(name, binding);

    // Live preview: what would this field render to with the placeholder
    // submission? For unbound fields we use the implicit-fallback rule
    // (submission[name] or empty).
    const preview = binding
        ? resolveBinding(binding, previewCtx)
        : previewCtx.submission[name] ?? '';
    const previewTruncated = preview.length > 80 ? preview.slice(0, 77) + '…' : preview;

    const handleSource = (next: (typeof SOURCE_OPTIONS)[number]['value']) => {
        switch (next) {
            case 'submission_implicit':
                onChange(null);
                return;
            case 'submission':
                onChange({ source: 'submission', key: name });
                return;
            case 'composite':
                onChange({ source: 'composite', template: '' });
                return;
            case 'system':
                onChange({ source: 'system', system: SYSTEM_FIELD_NAMES.has(name) ? (name as SystemSlot) : 'today' });
                return;
            case 'asset': {
                const first = assets[0];
                if (!first) {
                    onChange({ source: 'asset', assetId: '' });
                } else {
                    onChange({ source: 'asset', assetId: first.id });
                }
                return;
            }
            case 'asset_default':
                onChange({ source: 'asset_default', kind: 'signature', position: 0 });
                return;
            case 'lookup': {
                const list = assets.find((a) => a.kind === 'lookup_list');
                onChange({
                    source: 'lookup',
                    assetId: list?.id ?? '',
                    byKey: '',
                    subField: 'description',
                });
                return;
            }
        }
    };

    return (
        <Paper sx={{ p: 2, mb: 1, bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
                <Chip
                    label={name}
                    sx={{ fontFamily: 'monospace', minWidth: 180, alignSelf: 'center' }}
                />
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>Kilde</InputLabel>
                    <Select
                        label="Kilde"
                        value={source}
                        onChange={(e) => handleSource(e.target.value as typeof source)}
                    >
                        {SOURCE_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                                {o.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Box sx={{ flex: 1, minWidth: 260 }}>
                    <BindingConfig binding={binding} assets={assets} onChange={onChange} />
                </Box>
                {binding && (
                    <Button size="small" onClick={() => onChange(null)}>
                        Tilbakestill
                    </Button>
                )}
            </Box>
            <Box sx={{ mt: 1.5, pl: 0.5 }}>
                <Typography variant="caption" color="text.secondary" component="span">
                    Forhåndsvisning:{' '}
                </Typography>
                <Typography
                    variant="caption"
                    component="span"
                    sx={{
                        fontFamily: preview.startsWith('data:') ? 'monospace' : undefined,
                        color: preview ? 'text.primary' : 'text.disabled',
                        fontStyle: preview ? 'normal' : 'italic',
                    }}
                >
                    {preview.startsWith('data:image/')
                        ? `(bilde – ${Math.round(preview.length / 1024)} KB)`
                        : previewTruncated || '(tom)'}
                </Typography>
            </Box>
        </Paper>
    );
}

function BindingConfig({
    binding,
    assets,
    onChange,
}: {
    binding: FieldBinding | undefined;
    assets: OrgAsset[];
    onChange: (next: FieldBinding) => void;
}) {
    if (!binding) {
        return (
            <Typography variant="caption" color="text.secondary">
                Henter verdien direkte fra skjemafeltet med samme navn.
            </Typography>
        );
    }

    switch (binding.source) {
        case 'system':
            return (
                <FormControl size="small" fullWidth>
                    <InputLabel>System</InputLabel>
                    <Select
                        label="System"
                        value={binding.system}
                        onChange={(e) =>
                            onChange({ source: 'system', system: e.target.value as SystemSlot })
                        }
                    >
                        {SYSTEM_SLOTS.map((s) => (
                            <MenuItem key={s.value} value={s.value}>
                                {s.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );

        case 'submission':
            return (
                <TextField
                    size="small"
                    fullWidth
                    label="Skjemanøkkel"
                    value={binding.key}
                    onChange={(e) => onChange({ source: 'submission', key: e.target.value })}
                    helperText='F.eks. "name", "role" – nøkkelen fra skjemaet'
                />
            );

        case 'composite':
            return (
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <TextField
                        size="small"
                        fullWidth
                        label="Tekst-mal"
                        value={binding.template}
                        onChange={(e) =>
                            onChange({ ...binding, template: e.target.value })
                        }
                        helperText="Bruk {key} for å sette inn skjemaverdier, {key:date} for datoformat"
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Krev disse nøklene (kommaseparert)"
                        value={(binding.requireAll ?? []).join(', ')}
                        onChange={(e) =>
                            onChange({
                                ...binding,
                                requireAll: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                            })
                        }
                        helperText="Hvis noen av disse mangler i innsendingen, vises feltet som tomt"
                    />
                </Box>
            );

        case 'asset': {
            return (
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <FormControl size="small" fullWidth>
                        <InputLabel>Asset</InputLabel>
                        <Select
                            label="Asset"
                            value={binding.assetId}
                            onChange={(e) =>
                                onChange({ ...binding, assetId: e.target.value })
                            }
                        >
                            {assets.map((a) => (
                                <MenuItem key={a.id} value={a.id}>
                                    [{a.kind}] {a.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        size="small"
                        fullWidth
                        label="Sub-felt"
                        value={binding.subField ?? ''}
                        onChange={(e) => onChange({ ...binding, subField: e.target.value })}
                        helperText='"name" gir asset-navnet. For signaturer: photo/role/phone. For tekstblokker: text. For logoer: image.'
                    />
                </Box>
            );
        }

        case 'asset_default':
            return (
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <FormControl size="small" fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select
                            label="Type"
                            value={binding.kind}
                            onChange={(e) =>
                                onChange({ ...binding, kind: e.target.value as 'signature' | 'logo' | 'body_text' })
                            }
                        >
                            <MenuItem value="signature">Signatur</MenuItem>
                            <MenuItem value="logo">Logo</MenuItem>
                            <MenuItem value="body_text">Tekstblokk</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        size="small"
                        fullWidth
                        type="number"
                        label="Posisjon (0-indeks)"
                        value={binding.position ?? 0}
                        onChange={(e) =>
                            onChange({ ...binding, position: Number(e.target.value) })
                        }
                        helperText="0 = første standard-asset av denne typen, 1 = andre osv."
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Sub-felt"
                        value={binding.subField ?? ''}
                        onChange={(e) => onChange({ ...binding, subField: e.target.value })}
                    />
                </Box>
            );

        case 'lookup': {
            const lists = assets.filter((a) => a.kind === 'lookup_list');
            return (
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    {lists.length === 0 && (
                        <Alert severity="info" sx={{ mb: 1 }}>
                            Ingen oppslagslister enda. Opprett en i «Innhold».
                        </Alert>
                    )}
                    <FormControl size="small" fullWidth>
                        <InputLabel>Liste</InputLabel>
                        <Select
                            label="Liste"
                            value={binding.assetId}
                            onChange={(e) => onChange({ ...binding, assetId: e.target.value })}
                        >
                            {lists.map((a) => (
                                <MenuItem key={a.id} value={a.id}>
                                    {a.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        size="small"
                        fullWidth
                        label="Match med skjemanøkkel"
                        value={binding.byKey}
                        onChange={(e) => onChange({ ...binding, byKey: e.target.value })}
                        helperText='F.eks. "group" – verdien i skjemaet brukes til å finne riktig oppføring i listen'
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Sub-felt fra oppføringen"
                        value={binding.subField}
                        onChange={(e) => onChange({ ...binding, subField: e.target.value })}
                        helperText='F.eks. "description"'
                    />
                </Box>
            );
        }
    }
}

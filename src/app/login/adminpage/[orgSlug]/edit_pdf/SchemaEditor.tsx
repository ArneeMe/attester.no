'use client';

import React from 'react';
import Link from 'next/link';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { FormFieldSchema, FormFieldType, FormSchema } from '@/types/formSchema';
import type { OrgAsset, LookupListContent } from '@/types/orgAssets';

const TYPE_OPTIONS: { value: FormFieldType; label: string }[] = [
    { value: 'text', label: 'Tekst' },
    { value: 'date', label: 'Dato' },
    { value: 'dropdown', label: 'Nedtrekksliste' },
    { value: 'long_text', label: 'Lang tekst' },
    { value: 'number', label: 'Tall' },
];

type Props = {
    orgSlug: string;
    schema: FormSchema;
    assets: OrgAsset[];
    onChange: (next: FormSchema) => void;
};

export default function SchemaEditor({ orgSlug, schema, assets, onChange }: Props) {
    const lookupLists = assets.filter((a) => a.kind === 'lookup_list');

    const updateField = (i: number, patch: Partial<FormFieldSchema>) => {
        const next = [...schema];
        next[i] = { ...next[i], ...patch };
        onChange(next);
    };

    const removeField = (i: number) => onChange(schema.filter((_, idx) => idx !== i));

    const addField = () =>
        onChange([
            ...schema,
            { key: `field_${schema.length + 1}`, label: 'Nytt felt', type: 'text' },
        ]);

    return (
        <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Skjemaet innsenderen ser. Nøkkelen er det interne navnet som binder
                feltet sammen med PDF-malen og verifisering. Etiketten er det
                innsenderen ser.
            </Typography>

            {schema.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Ingen felter enda. Legg til et felt under, eller la designeren
                    auto-utlede skjemaet ved lagring.
                </Typography>
            )}

            {schema.map((field, i) => (
                <Paper key={i} sx={{ p: 2, mb: 1, bgcolor: 'grey.50' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                        <TextField
                            size="small"
                            label="Nøkkel"
                            value={field.key}
                            onChange={(e) => updateField(i, { key: e.target.value.trim() })}
                            sx={{ minWidth: 140 }}
                        />
                        <TextField
                            size="small"
                            label="Etikett"
                            value={field.label}
                            onChange={(e) => updateField(i, { label: e.target.value })}
                            sx={{ minWidth: 180 }}
                        />
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel>Type</InputLabel>
                            <Select
                                label="Type"
                                value={field.type}
                                onChange={(e) =>
                                    updateField(i, { type: e.target.value as FormFieldType })
                                }
                            >
                                {TYPE_OPTIONS.map((t) => (
                                    <MenuItem key={t.value} value={t.value}>
                                        {t.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={!!field.optional}
                                    onChange={(e) => updateField(i, { optional: e.target.checked })}
                                />
                            }
                            label="Valgfritt"
                        />
                        <IconButton color="error" onClick={() => removeField(i)}>
                            <DeleteIcon />
                        </IconButton>
                    </Box>

                    {field.type === 'dropdown' && (
                        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            <FormControl size="small" sx={{ minWidth: 260 }}>
                                <InputLabel>Hent valg fra liste</InputLabel>
                                <Select
                                    label="Hent valg fra liste"
                                    value={field.optionsFromAsset ?? ''}
                                    onChange={(e) =>
                                        updateField(i, {
                                            optionsFromAsset: e.target.value || undefined,
                                            options: e.target.value ? undefined : field.options,
                                        })
                                    }
                                >
                                    <MenuItem value="">
                                        <em>(Statisk liste under)</em>
                                    </MenuItem>
                                    {lookupLists.map((l) => (
                                        <MenuItem key={l.id} value={l.id}>
                                            {l.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {!field.optionsFromAsset && (
                                <TextField
                                    size="small"
                                    fullWidth
                                    multiline
                                    rows={3}
                                    label="Statiske valg (én per linje)"
                                    value={(field.options ?? []).join('\n')}
                                    onChange={(e) =>
                                        updateField(i, {
                                            options: e.target.value
                                                .split('\n')
                                                .map((s) => s.trim())
                                                .filter(Boolean),
                                        })
                                    }
                                />
                            )}
                            {field.optionsFromAsset && (
                                <LookupListPreview
                                    list={lookupLists.find((l) => l.id === field.optionsFromAsset)}
                                    orgSlug={orgSlug}
                                />
                            )}
                        </Box>
                    )}
                </Paper>
            ))}

            <Button startIcon={<AddIcon />} onClick={addField} size="small">
                Legg til felt
            </Button>
        </Box>
    );
}

const MAX_PREVIEW = 8;

function LookupListPreview({ list, orgSlug }: { list: OrgAsset | undefined; orgSlug: string }) {
    const items = (list?.content as LookupListContent | undefined)?.items ?? [];
    const shown = items.slice(0, MAX_PREVIEW).map((it) => it.name).join(', ');
    const overflow = items.length > MAX_PREVIEW ? ` …+${items.length - MAX_PREVIEW} til` : '';
    return (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={list?.name ?? 'Ukjent liste'} size="small" color="primary" />
                <Button
                    size="small"
                    component={Link}
                    href={`/login/adminpage/${orgSlug}/rediger?tab=lookup_list`}
                    target="_blank"
                    rel="noreferrer"
                >
                    Rediger liste ↗
                </Button>
            </Box>
            {items.length > 0 ? (
                <Typography variant="caption" color="text.secondary">
                    {items.length} valg: {shown}{overflow}
                </Typography>
            ) : (
                <Typography variant="caption" color="warning.main">
                    Listen er tom — legg til oppføringer i Innhold.
                </Typography>
            )}
        </Box>
    );
}

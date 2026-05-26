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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
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

    // When the admin types a label, slugify it into the key automatically
    // — as long as they haven't already hand-edited the key (`autoKey` is
    // true). Drops the cognitive load of "what should I name this field"
    // and keeps key + label in sync for new fields.
    const updateLabel = (i: number, label: string) => {
        const field = schema[i];
        const patch: Partial<FormFieldSchema> = { label };
        if (field.autoKey !== false) {
            patch.key = slugifyKey(label) || field.key;
        }
        updateField(i, patch);
    };

    const removeField = (i: number) => onChange(schema.filter((_, idx) => idx !== i));

    const moveField = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= schema.length) return;
        const next = [...schema];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    };

    const addField = () =>
        onChange([
            ...schema,
            { key: `field_${schema.length + 1}`, label: 'Nytt felt', type: 'text', autoKey: true },
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
                            label="Etikett"
                            value={field.label}
                            onChange={(e) => updateLabel(i, e.target.value)}
                            sx={{ minWidth: 180 }}
                        />
                        <TextField
                            size="small"
                            label="Nøkkel"
                            value={field.key}
                            onChange={(e) =>
                                updateField(i, {
                                    key: slugifyKey(e.target.value),
                                    autoKey: false,
                                })
                            }
                            sx={{ minWidth: 140 }}
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
                        <IconButton
                            size="small"
                            onClick={() => moveField(i, -1)}
                            disabled={i === 0}
                            aria-label="Flytt opp"
                        >
                            <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={() => moveField(i, 1)}
                            disabled={i === schema.length - 1}
                            aria-label="Flytt ned"
                        >
                            <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
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

/**
 * Turn an admin-typed label ("Mottakers navn") into a safe key
 * ("mottakers_navn"): lowercase, ASCII-only, underscores for runs of
 * non-word chars. Used by the schema editor to keep key + label in sync
 * for newly added fields without making admins think about it.
 */
function slugifyKey(label: string): string {
    return label
        .toLowerCase()
        .replace(/[æå]/g, 'a')
        .replace(/[ø]/g, 'o')
        .replace(/[éè]/g, 'e')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

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

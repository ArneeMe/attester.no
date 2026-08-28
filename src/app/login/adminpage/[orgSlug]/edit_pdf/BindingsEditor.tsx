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
import { useAdminLang } from '@/util/useAdminLang';
import type { Strings } from '@/strings';

const SOURCE_OPTIONS = [
    { value: 'submission_implicit' },
    { value: 'submission' },
    { value: 'composite' },
    { value: 'system' },
    { value: 'asset' },
    { value: 'asset_default' },
    { value: 'lookup' },
] as const;

const SYSTEM_SLOT_VALUES: SystemSlot[] = ['qr_code', 'qr_info', 'qr_page', 'today'];

type DesignerStrings = Strings['admin']['designer'];

const SYSTEM_FIELD_NAMES = new Set(['qr_code', 'qr_info', 'qr_page', 'today']);

type Props = {
    schemas: Template['schemas'];
    bindings: FieldBindings;
    assets: OrgAsset[];
    formSchema: FormSchema;
    onChange: (next: FieldBindings) => void;
};

export default function BindingsEditor({ schemas, bindings, assets, formSchema, onChange }: Props) {
    const { strings } = useAdminLang();
    const d = strings.admin.designer;
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
                    {d.noFieldsInTemplate}
                </Typography>
            </Paper>
        );
    }

    return (
        <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {d.bindingsIntro}
            </Typography>
            {fieldNames.map((name) => (
                <BindingRow
                    key={name}
                    name={name}
                    binding={bindings[name]}
                    assets={assets}
                    previewCtx={previewCtx}
                    d={d}
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
    d: DesignerStrings;
    onChange: (next: FieldBinding | null) => void;
};

function inferSourceKind(name: string, binding: FieldBinding | undefined): (typeof SOURCE_OPTIONS)[number]['value'] {
    if (binding) return binding.source;
    if (SYSTEM_FIELD_NAMES.has(name)) return 'system';
    return 'submission_implicit';
}

function BindingRow({ name, binding, assets, previewCtx, d, onChange }: BindingRowProps) {
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
                    <InputLabel>{d.sourceLabel}</InputLabel>
                    <Select
                        label={d.sourceLabel}
                        value={source}
                        onChange={(e) => handleSource(e.target.value as typeof source)}
                    >
                        {SOURCE_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                                {d.sourceLabels[o.value]}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Box sx={{ flex: 1, minWidth: 260 }}>
                    <BindingConfig binding={binding} assets={assets} d={d} onChange={onChange} />
                </Box>
                {binding && (
                    <Button size="small" onClick={() => onChange(null)}>
                        {d.reset}
                    </Button>
                )}
            </Box>
            <Box sx={{ mt: 1.5, pl: 0.5 }}>
                <Typography variant="caption" color="text.secondary" component="span">
                    {d.previewLabel}{' '}
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
                        ? d.imagePreview(Math.round(preview.length / 1024))
                        : previewTruncated || d.emptyPreview}
                </Typography>
            </Box>
        </Paper>
    );
}

function BindingConfig({
    binding,
    assets,
    d,
    onChange,
}: {
    binding: FieldBinding | undefined;
    assets: OrgAsset[];
    d: DesignerStrings;
    onChange: (next: FieldBinding) => void;
}) {
    if (!binding) {
        return (
            <Typography variant="caption" color="text.secondary">
                {d.implicitHint}
            </Typography>
        );
    }

    switch (binding.source) {
        case 'system':
            return (
                <FormControl size="small" fullWidth>
                    <InputLabel>{d.systemLabel}</InputLabel>
                    <Select
                        label={d.systemLabel}
                        value={binding.system}
                        onChange={(e) =>
                            onChange({ source: 'system', system: e.target.value as SystemSlot })
                        }
                    >
                        {SYSTEM_SLOT_VALUES.map((s) => (
                            <MenuItem key={s} value={s}>
                                {d.systemLabels[s]}
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
                    label={d.submissionKeyLabel}
                    value={binding.key}
                    onChange={(e) => onChange({ source: 'submission', key: e.target.value })}
                    helperText={d.submissionKeyHelper}
                />
            );

        case 'composite':
            return (
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <TextField
                        size="small"
                        fullWidth
                        label={d.compositeLabel}
                        value={binding.template}
                        onChange={(e) =>
                            onChange({ ...binding, template: e.target.value })
                        }
                        helperText={d.compositeHelper}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label={d.requireAllLabel}
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
                        helperText={d.requireAllHelper}
                    />
                </Box>
            );

        case 'asset': {
            return (
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <FormControl size="small" fullWidth>
                        <InputLabel>{d.assetLabel}</InputLabel>
                        <Select
                            label={d.assetLabel}
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
                        label={d.subFieldLabel}
                        value={binding.subField ?? ''}
                        onChange={(e) => onChange({ ...binding, subField: e.target.value })}
                        helperText={d.subFieldHelper}
                    />
                </Box>
            );
        }

        case 'asset_default':
            return (
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <FormControl size="small" fullWidth>
                        <InputLabel>{d.typeLabel}</InputLabel>
                        <Select
                            label={d.typeLabel}
                            value={binding.kind}
                            onChange={(e) =>
                                onChange({ ...binding, kind: e.target.value as 'signature' | 'logo' | 'body_text' })
                            }
                        >
                            <MenuItem value="signature">{d.assetKindSignature}</MenuItem>
                            <MenuItem value="logo">{d.assetKindLogo}</MenuItem>
                            <MenuItem value="body_text">{d.assetKindBodyText}</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        size="small"
                        fullWidth
                        type="number"
                        label={d.positionLabel}
                        value={binding.position ?? 0}
                        onChange={(e) =>
                            onChange({ ...binding, position: Number(e.target.value) })
                        }
                        helperText={d.positionHelper}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label={d.subFieldLabel}
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
                            {d.noLists}
                        </Alert>
                    )}
                    <FormControl size="small" fullWidth>
                        <InputLabel>{d.listLabel}</InputLabel>
                        <Select
                            label={d.listLabel}
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
                        label={d.byKeyLabel}
                        value={binding.byKey}
                        onChange={(e) => onChange({ ...binding, byKey: e.target.value })}
                        helperText={d.byKeyHelper}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label={d.lookupSubFieldLabel}
                        value={binding.subField}
                        onChange={(e) => onChange({ ...binding, subField: e.target.value })}
                        helperText={d.lookupSubFieldHelper}
                    />
                </Box>
            );
        }
    }
}

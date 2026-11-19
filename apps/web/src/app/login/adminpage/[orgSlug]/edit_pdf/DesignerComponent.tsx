import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    MenuItem,
    Link,
    TextField,
} from '@mui/material';
import { Template, BLANK_PDF, type Schema } from '@pdfme/common';
import { saveTemplate, getFullTemplate, getTemplates, fromPdfmeTemplate } from '@/util/databaseInteractions/templateService';
import { listOrgAssets } from '@/util/databaseInteractions/orgAssets';
import { validateTemplateForSave } from '@attester/shared/validateTemplate';
import { pickDefaultAsset } from '@attester/shared/resolveBinding';
import { buildPreviewPdfUrl } from '@/util/previewPdf';
import type { TemplateSummary } from '@attester/shared/types/templateTypes';
import type { OrgAsset } from '@attester/shared/types/orgAssets';
import type { FormFieldType, FormSchema } from '@attester/shared/types/formSchema';
import StarterTemplatePicker from './StarterTemplatePicker';
import TemplateCanvas from './TemplateCanvas';
import type { StarterTemplate } from '@/app/pdfinfo/starterTemplates';
import { useAdminLang } from '@/util/useAdminLang';
import { body, c, h2, mono } from '@/app/style/tokens';
import {
    addQr, addQuestion, addSignature, addText, addToday, displayText, hasQr, items, normalize, remove, removeQuestion,
    missingForSave, setText, updateField, updateQuestion,
    type Draft, type DraftItem,
} from '@/util/templateDraft';

interface Props {
    orgSlug: string;
    templateName: string;
    templateDescription: string;
    isOffered: boolean;
    initialTemplateId?: string | null;
    onError: (msg: string | null) => void;
    onSuccess: (msg: string | null) => void;
    onTemplateLoad: (name: string, desc: string, isOffered: boolean) => void;
    saveFields: React.ReactNode;
}

type Adding = null | 'text' | 'question' | 'list';

function Step({ number, title, help, children }: {
    number: number;
    title: string;
    help?: string;
    children: React.ReactNode;
}) {
    return (
        <Box component="section" sx={{ borderTop: `1px solid ${c.rule}`, pt: 3, pb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: help ? 0.5 : 2 }}>
                <Box sx={mono}>{String(number).padStart(2, '0')}</Box>
                <Box component="h2" sx={h2}>{title}</Box>
            </Box>
            {help && <Box sx={{ ...body, mb: 2, maxWidth: 720 }}>{help}</Box>}
            {children}
        </Box>
    );
}

export default function DesignerComponent({
    orgSlug,
    templateName,
    templateDescription,
    isOffered,
    initialTemplateId,
    onError,
    onSuccess,
    onTemplateLoad,
    saveFields,
}: Props) {
    const { strings } = useAdminLang();
    const d = strings.admin.designer;
    const [draft, setDraft] = useState<Draft>({ schemas: [[]], bindings: {}, form: [] });
    const [basePdf, setBasePdf] = useState<Template['basePdf']>(BLANK_PDF);
    const [selected, setSelected] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [existingTemplates, setExistingTemplates] = useState<TemplateSummary[]>([]);
    const [assets, setAssets] = useState<OrgAsset[]>([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [adding, setAdding] = useState<Adding>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewBusy, setPreviewBusy] = useState(false);

    const apply = (next: Draft, nextBase?: Template['basePdf']) => {
        setDraft(next);
        if (nextBase) setBasePdf(nextBase);
    };

    const template = (): Template => ({ basePdf, schemas: draft.schemas });

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    useEffect(() => {
        getTemplates(orgSlug).then(setExistingTemplates).catch((e) => {
            onError(`${d.loadTemplatesError}: ${(e as Error).message}`);
        });
        listOrgAssets(orgSlug).then(setAssets).catch((e) => {
            onError(`${d.loadAssetsError}: ${(e as Error).message}`);
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgSlug]);

    const loadedDeepLinkRef = useRef<string | null>(null);
    useEffect(() => {
        if (!initialTemplateId || loadedDeepLinkRef.current === initialTemplateId) return;
        if (existingTemplates.length === 0) return;
        const found = existingTemplates.find((t) => t.id === initialTemplateId);
        if (!found) return;
        loadedDeepLinkRef.current = initialTemplateId;
        void handleLoadTemplate(found);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTemplateId, existingTemplates]);

    const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setBasePdf(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleLoadTemplate = async (summary: TemplateSummary) => {
        if (!summary.id) return;
        let template;
        try {
            template = await getFullTemplate(orgSlug, summary.id);
        } catch (e) {
            onError(`${d.loadTemplatesError}: ${(e as Error).message}`);
            return;
        }
        apply(
            normalize({ schemas: template.schemas, bindings: template.fieldBindings ?? {}, form: template.formSchema ?? [] }),
            template.basePdf,
        );
        onTemplateLoad(template.name, template.description || '', template.isOffered);
    };

    const handlePickStarter = (starter: StarterTemplate) => {
        apply(
            normalize({ schemas: starter.template.schemas, bindings: starter.fieldBindings, form: starter.formSchema }),
            starter.template.basePdf,
        );
        onTemplateLoad(starter.name, starter.description, false);
    };

    const handleSave = async () => {
        if (!templateName.trim()) {
            onError(d.nameFirst);
            return;
        }
        const pdfmeTemplate = template();
        const problems = validateTemplateForSave(pdfmeTemplate);
        if (problems.length > 0) {
            onError(problems.join(' '));
            return;
        }
        setSaving(true);
        try {
            await saveTemplate(orgSlug, fromPdfmeTemplate(pdfmeTemplate, templateName.trim(), {
                description: templateDescription || undefined,
                isOffered,
                fieldBindings: draft.bindings,
                formSchema: draft.form,
            }));
            onSuccess(d.saved(templateName));
            setExistingTemplates(await getTemplates(orgSlug));
        } catch {
            onError(d.saveError);
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        setPreviewBusy(true);
        try {
            setPreviewUrl(await buildPreviewPdfUrl(
                orgSlug,
                template(),
                draft.bindings,
                draft.form,
                assets,
            ));
        } catch (e) {
            onError(`${d.previewError}: ${(e as Error).message}`);
        } finally {
            setPreviewBusy(false);
        }
    };

    const handleExport = () => {
        const blob = new Blob([JSON.stringify(template(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `template-${templateName || 'export'}.json`;
        a.click();
    };

    const closePreview = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    };

    const list = items(draft);
    const labels = Object.fromEntries(
        list.flatMap((i) => (i.kind === 'signature' ? i.names.map((n) => [n, d.item.signatureShort(i.number)]) : [])),
    );
    const selectedField = (draft.schemas ?? []).flat().find((f) => f.name === selected) ?? null;
    const missing = missingForSave(draft);

    return (
        <>
            <Step number={1} title={d.steps.background} help={d.steps.backgroundHelp}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button variant="outlined" onClick={() => setPickerOpen(true)}>{d.startFromTemplate}</Button>
                    <Button variant="outlined" component="label">
                        {d.uploadPdf}
                        <input type="file" accept="application/pdf" hidden onChange={handlePdfUpload} />
                    </Button>
                    {existingTemplates.length > 0 && (
                        <TextField
                            select
                            size="small"
                            label={d.openExisting}
                            value=""
                            onChange={(e) => {
                                const found = existingTemplates.find((t) => t.id === e.target.value);
                                if (found) void handleLoadTemplate(found);
                            }}
                            sx={{ minWidth: 280 }}
                        >
                            {existingTemplates.map((t) => (
                                <MenuItem key={t.id} value={t.id}>
                                    {t.name}
                                    {t.isOffered && d.offeredSuffix}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}
                </Box>
            </Step>

            <Step number={2} title={d.steps.content} help={d.steps.contentHelp}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Button variant="outlined" onClick={() => setAdding('text')}>{d.add.text}</Button>
                    <Button variant="outlined" onClick={() => setAdding('question')}>{d.add.question}</Button>
                    <Button variant="outlined" onClick={() => setAdding('list')}>{d.add.list}</Button>
                    <Button variant="outlined" onClick={() => apply(addSignature(draft))}>{d.add.signature}</Button>
                    <Button variant="outlined" onClick={() => apply(addToday(draft))}>{d.add.today}</Button>
                    <Button variant="outlined" disabled={hasQr(draft)} onClick={() => apply(addQr(draft))}>{d.add.qr}</Button>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 700px) minmax(0, 1fr)' }, gap: 4, alignItems: 'start' }}>
                    <Box sx={{ bgcolor: c.rowHover, p: 2 }}>
                        <TemplateCanvas
                            basePdf={basePdf}
                            schemas={draft.schemas}
                            selected={selected}
                            labels={labels}
                            onSelect={setSelected}
                            onChange={(name, box) =>
                                setDraft((prev) => updateField(prev, name, { position: { x: box.x, y: box.y }, width: box.width, height: box.height }))}
                        />
                    </Box>
                    <Box>
                        {selectedField && (
                            <FieldSettings
                                field={selectedField}
                                text={displayText(draft, selectedField)}
                                questions={draft.form}
                                onText={(t) => setDraft((prev) => setText(prev, selectedField.name, t))}
                                onChange={(patch) => setDraft((prev) => updateField(prev, selectedField.name, patch))}
                            />
                        )}
                        <Box component="h3" sx={{ ...body, fontWeight: 600, mb: 1 }}>{d.listTitle}</Box>
                        {list.length === 0 && <Box sx={{ ...body, color: c.inkFaint }}>{d.empty}</Box>}
                        {list.map((item) => (
                            <Box
                                key={item.names.join('|')}
                                onClick={() => item.names[0] && setSelected(item.names[0])}
                                sx={{ bgcolor: selected && item.names.includes(selected) ? c.rowHover : 'transparent', px: 1 }}
                            >
                                <ItemRow
                                    orgSlug={orgSlug}
                                    item={item}
                                    assets={assets}
                                    onRemove={() => apply(item.kind === 'question' ? removeQuestion(draft, item.field.key) : remove(draft, item.names))}
                                    onChange={(patch) => setDraft(updateQuestion(draft, (item as DraftItem & { kind: 'question' }).field.key, patch))}
                                    onDone={() => apply(normalize(draft))}
                                />
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Step>

            <Step number={3} title={d.steps.save} help={d.saveHelp}>
                {missing.length > 0 && (
                    <Box sx={{ ...body, color: 'warning.dark', mb: 2 }}>
                        {d.missingBefore} {missing.map((m) => d.missingItem[m]).join(' ')}
                    </Box>
                )}
                {saveFields}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
                    <Button variant="contained" onClick={handleSave} disabled={saving || !templateName.trim() || missing.length > 0}>
                        {saving ? <CircularProgress size={20} /> : d.saveTemplate}
                    </Button>
                    <Button variant="outlined" onClick={handlePreview} disabled={previewBusy}>
                        {previewBusy ? <CircularProgress size={20} /> : d.previewPdf}
                    </Button>
                    <Button size="small" onClick={handleExport} sx={{ ml: 'auto' }}>{d.exportJson}</Button>
                </Box>
            </Step>

            <AddDialog
                adding={adding}
                onClose={() => setAdding(null)}
                onText={(t) => apply(addText(draft, t))}
                onQuestion={(q) => apply(addQuestion(draft, q))}
            />

            <StarterTemplatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePickStarter} />

            <Dialog open={!!previewUrl} onClose={closePreview} maxWidth="lg" fullWidth>
                <DialogTitle>{d.previewDialogTitle}</DialogTitle>
                <DialogContent dividers sx={{ p: 0, height: '80vh' }}>
                    {previewUrl && (
                        <iframe src={previewUrl} title="PDF-forhåndsvisning" style={{ width: '100%', height: '100%', border: 0 }} />
                    )}
                </DialogContent>
                <DialogActions>
                    {previewUrl && (
                        <Button component="a" href={previewUrl} download={`forhandsvisning-${templateName || 'mal'}.pdf`}>
                            {d.download}
                        </Button>
                    )}
                    <Button onClick={closePreview} variant="contained">{d.close}</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

function ItemRow({ orgSlug, item, assets, onRemove, onChange, onDone }: {
    orgSlug: string;
    item: DraftItem;
    assets: OrgAsset[];
    onRemove: () => void;
    onChange: (patch: { label?: string; type?: FormFieldType; optional?: boolean; options?: string[] }) => void;
    onDone: () => void;
}) {
    const { strings } = useAdminLang();
    const d = strings.admin.designer;
    const row = { display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', py: 1.5, borderBottom: `1px solid ${c.ruleSoft}` };

    const fromContent = (kind: 'signature' | 'logo' | 'body_text', position: number, found: (a: OrgAsset) => string) => {
        const asset = pickDefaultAsset(assets, kind, position);
        if (asset) return found(asset);
        return (
            <Box component="span" sx={{ color: 'warning.dark' }}>
                {d.item.missing[kind](position + 1)}{' '}
                <Link href={`/login/adminpage/${orgSlug}/rediger`} target="_blank">{d.item.goToContent}</Link>
            </Box>
        );
    };

    const describe = (): React.ReactNode => {
        switch (item.kind) {
            case 'text': return d.item.text(item.text);
            case 'image': return d.item.image;
            case 'signature':
                return fromContent('signature', item.number - 1, (a) =>
                    d.item.signatureFound(item.number, a.name, (a.content as { role?: string }).role ?? ''));
            case 'qr': return d.item.qr;
            case 'today': return d.item.today;
            case 'library':
                return fromContent(item.assetKind, item.position, (a) => `${item.assetKind === 'logo' ? d.item.logo : d.item.bodyText}: ${a.name}`);
            case 'other':
                if (item.summary?.kind === 'mixed') return d.item.mixed(item.summary.template);
                return item.summary?.kind === 'automatic' ? d.item.automatic : d.item.other;
            case 'unused': return d.item.unused;
            case 'question': return '';
        }
    };

    if (item.kind !== 'question') {
        return (
            <Box sx={row}>
                <Box sx={{ ...body, flex: 1 }}>{describe()}</Box>
                <Button size="small" color="error" onClick={onRemove}>{d.remove}</Button>
            </Box>
        );
    }

    const f = item.field;
    const list = f.optionsFromAsset ? assets.find((a) => a.id === f.optionsFromAsset) : null;
    return (
        <Box sx={row}>
            <Box sx={{ ...mono, minWidth: 70 }}>{d.item.question}</Box>
            <TextField
                size="small"
                label={d.questionLabel}
                value={f.label}
                onChange={(e) => onChange({ label: e.target.value })}
                onBlur={onDone}
                sx={{ minWidth: 240, flex: 1 }}
            />
            {f.type === 'dropdown' ? (
                f.optionsFromAsset ? (
                    <Box sx={{ ...body, color: c.inkFaint }}>{d.fromList(list?.name ?? '?')}</Box>
                ) : (
                    <OptionsEditor options={f.options ?? []} onChange={(options) => onChange({ options })} />
                )
            ) : (
                <TextField
                    select
                    size="small"
                    label={d.typeLabel}
                    value={f.type}
                    onChange={(e) => onChange({ type: e.target.value as FormFieldType })}
                    sx={{ minWidth: 140 }}
                >
                    {(['text', 'long_text', 'date', 'number'] as const).map((t) => (
                        <MenuItem key={t} value={t}>{d.typeLabels[t]}</MenuItem>
                    ))}
                </TextField>
            )}
            <FormControlLabel
                control={<Checkbox checked={!!f.optional} onChange={(e) => onChange({ optional: e.target.checked })} />}
                label={d.optionalLabel}
            />
            <Button size="small" color="error" onClick={onRemove}>{d.remove}</Button>
        </Box>
    );
}

function FieldSettings({ field, text, questions, onText, onChange }: {
    field: Schema;
    text: string | null;
    questions: FormSchema;
    onText: (text: string) => void;
    onChange: (patch: Partial<Schema>) => void;
}) {
    const { strings } = useAdminLang();
    const d = strings.admin.designer;
    if (field.type !== 'text') return null;
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3, p: 2, border: `1px solid ${c.rule}` }}>
            <Box component="h3" sx={{ ...body, fontWeight: 600, m: 0 }}>{d.selectedTitle}</Box>
            {text !== null && (
                <>
                    <TextField size="small" multiline label={d.textLabel} value={text} onChange={(e) => onText(e.target.value)} />
                    {questions.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                            <Box sx={{ ...body, fontSize: 13 }}>{d.insertAnswer}</Box>
                            {questions.map((q) => (
                                <Chip
                                    key={q.key}
                                    size="small"
                                    label={q.label}
                                    onClick={() => onText(`${text}${text && !text.endsWith(' ') ? ' ' : ''}[${q.label}]`)}
                                />
                            ))}
                        </Box>
                    )}
                </>
            )}
            <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                    size="small"
                    type="number"
                    label={d.fontSize}
                    value={Number(field.fontSize ?? 12)}
                    onChange={(e) => onChange({ fontSize: Math.min(96, Math.max(5, Number(e.target.value) || 12)) })}
                    sx={{ width: 120 }}
                />
                <TextField
                    select
                    size="small"
                    label={d.align}
                    value={(field.alignment as string) ?? 'left'}
                    onChange={(e) => onChange({ alignment: e.target.value })}
                    sx={{ width: 160 }}
                >
                    {(['left', 'center', 'right'] as const).map((a) => (
                        <MenuItem key={a} value={a}>{d.alignLabels[a]}</MenuItem>
                    ))}
                </TextField>
            </Box>
        </Box>
    );
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
    const { strings } = useAdminLang();
    const d = strings.admin.designer;
    const [next, setNext] = useState('');
    const add = () => {
        const option = next.trim();
        if (!option || options.includes(option)) return;
        onChange([...options, option]);
        setNext('');
    };
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 220 }}>
            {options.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {options.map((o) => (
                        <Chip key={o} label={o} onDelete={() => onChange(options.filter((x) => x !== o))} />
                    ))}
                </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                    size="small"
                    label={d.optionLabel}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    sx={{ flex: 1 }}
                />
                <Button variant="outlined" disabled={!next.trim()} onClick={add}>{d.addOption}</Button>
            </Box>
        </Box>
    );
}

function AddDialog({ adding, onClose, onText, onQuestion }: {
    adding: Adding;
    onClose: () => void;
    onText: (text: string) => void;
    onQuestion: (q: { label: string; type: FormFieldType; optional?: boolean; options?: string[] }) => void;
}) {
    const { strings } = useAdminLang();
    const d = strings.admin.designer;
    const [value, setValue] = useState('');
    const [type, setType] = useState<FormFieldType>('text');
    const [optional, setOptional] = useState(false);
    const [options, setOptions] = useState<string[]>([]);

    useEffect(() => {
        if (!adding) return;
        setValue('');
        setType('text');
        setOptional(false);
        setOptions([]);
    }, [adding]);

    const ready = value.trim() !== '' && (adding !== 'list' || options.length > 0);

    const submit = () => {
        if (!ready) return;
        if (adding === 'text') onText(value.trim());
        else if (adding === 'list') onQuestion({ label: value.trim(), type: 'dropdown', optional, options });
        else onQuestion({ label: value.trim(), type, optional });
        onClose();
    };

    const title = adding === 'text' ? d.add.text : adding === 'list' ? d.add.list : d.add.question;
    return (
        <Dialog open={!!adding} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
                <Box sx={body}>{adding === 'text' ? d.addHelp.text : adding === 'list' ? d.addHelp.list : d.addHelp.question}</Box>
                <TextField
                    autoFocus
                    label={adding === 'text' ? d.textLabel : d.questionLabel}
                    value={value}
                    multiline={adding === 'text'}
                    onChange={(e) => setValue(e.target.value)}
                />
                {adding === 'question' && (
                    <TextField select label={d.typeLabel} value={type} onChange={(e) => setType(e.target.value as FormFieldType)}>
                        {(['text', 'long_text', 'date', 'number'] as const).map((t) => (
                            <MenuItem key={t} value={t}>{d.typeLabels[t]}</MenuItem>
                        ))}
                    </TextField>
                )}
                {adding === 'list' && (
                    <OptionsEditor options={options} onChange={setOptions} />
                )}
                {adding !== 'text' && (
                    <FormControlLabel
                        control={<Checkbox checked={optional} onChange={(e) => setOptional(e.target.checked)} />}
                        label={d.optionalLabel}
                    />
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{strings.common.cancel}</Button>
                <Button variant="contained" disabled={!ready} onClick={submit}>{d.addButton}</Button>
            </DialogActions>
        </Dialog>
    );
}

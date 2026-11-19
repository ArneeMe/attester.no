import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    MenuItem,
    TextField,
} from '@mui/material';
import { Designer } from '@pdfme/ui';
import { text, image, barcodes } from '@pdfme/schemas';
import { Template, BLANK_PDF } from '@pdfme/common';
import { saveTemplate, getFullTemplate, getTemplates, fromPdfmeTemplate } from '@/util/databaseInteractions/templateService';
import { listOrgAssets } from '@/util/databaseInteractions/orgAssets';
import { validateTemplateForSave } from '@attester/shared/validateTemplate';
import { buildPreviewPdfUrl } from '@/util/previewPdf';
import type { TemplateSummary } from '@attester/shared/types/templateTypes';
import type { FieldBindings } from '@attester/shared/types/fieldBindings';
import type { OrgAsset } from '@attester/shared/types/orgAssets';
import type { FormFieldType, FormSchema } from '@attester/shared/types/formSchema';
import StarterTemplatePicker from './StarterTemplatePicker';
import type { StarterTemplate } from '@/app/pdfinfo/starterTemplates';
import { useAdminLang } from '@/util/useAdminLang';
import { body, c, h2, mono } from '@/app/style/tokens';
import {
    addQr, addQuestion, addSignature, addText, addToday, hasQr, items, normalize, prune, remove, updateQuestion,
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
    const containerRef = useRef<HTMLDivElement>(null);
    const designerRef = useRef<Designer | null>(null);
    const metaRef = useRef<{ bindings: FieldBindings; form: FormSchema }>({ bindings: {}, form: [] });
    const [draft, setDraft] = useState<Draft>({ schemas: [[]], bindings: {}, form: [] });
    const [saving, setSaving] = useState(false);
    const [existingTemplates, setExistingTemplates] = useState<TemplateSummary[]>([]);
    const [assets, setAssets] = useState<OrgAsset[]>([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [adding, setAdding] = useState<Adding>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewBusy, setPreviewBusy] = useState(false);

    const remember = (next: Draft) => {
        metaRef.current = { bindings: next.bindings, form: next.form };
        setDraft(next);
    };

    const current = (): Draft => ({
        schemas: designerRef.current?.getTemplate().schemas ?? [[]],
        ...metaRef.current,
    });

    const apply = (next: Draft, basePdf?: Template['basePdf']) => {
        const designer = designerRef.current;
        if (!designer) return;
        designer.updateTemplate({ basePdf: basePdf ?? designer.getTemplate().basePdf, schemas: next.schemas });
        remember(next);
    };

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    useEffect(() => {
        if (!containerRef.current || designerRef.current) return;

        designerRef.current = new Designer({
            domContainer: containerRef.current,
            template: { basePdf: BLANK_PDF, schemas: [[]] },
            options: { sidebarOpen: false },
            plugins: { Text: text, Image: image, QR: barcodes.qrcode },
        });
        designerRef.current.onChangeTemplate((t) => remember(prune({ schemas: t.schemas, ...metaRef.current })));

        getTemplates(orgSlug).then(setExistingTemplates).catch((e) => {
            onError(`${d.loadTemplatesError}: ${(e as Error).message}`);
        });
        listOrgAssets(orgSlug).then(setAssets).catch((e) => {
            onError(`${d.loadAssetsError}: ${(e as Error).message}`);
        });

        return () => {
            designerRef.current?.destroy();
            designerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgSlug]);

    const loadedDeepLinkRef = useRef<string | null>(null);
    useEffect(() => {
        if (!initialTemplateId || loadedDeepLinkRef.current === initialTemplateId) return;
        if (!designerRef.current || existingTemplates.length === 0) return;
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
        reader.onload = (ev) => apply(current(), ev.target?.result as string);
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
        if (!designerRef.current || !templateName.trim()) {
            onError(d.nameFirst);
            return;
        }
        const pdfmeTemplate = designerRef.current.getTemplate();
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
                fieldBindings: metaRef.current.bindings,
                formSchema: metaRef.current.form,
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
        if (!designerRef.current) {
            onError(d.notReady);
            return;
        }
        setPreviewBusy(true);
        try {
            setPreviewUrl(await buildPreviewPdfUrl(
                orgSlug,
                designerRef.current.getTemplate(),
                metaRef.current.bindings,
                metaRef.current.form,
                assets,
            ));
        } catch (e) {
            onError(`${d.previewError}: ${(e as Error).message}`);
        } finally {
            setPreviewBusy(false);
        }
    };

    const handleExport = () => {
        if (!designerRef.current) return;
        const blob = new Blob([JSON.stringify(designerRef.current.getTemplate(), null, 2)], { type: 'application/json' });
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
                    <Button variant="outlined" onClick={() => apply(addSignature(current()))}>{d.add.signature}</Button>
                    <Button variant="outlined" onClick={() => apply(addToday(current()))}>{d.add.today}</Button>
                    <Button variant="outlined" disabled={hasQr(draft)} onClick={() => apply(addQr(current()))}>{d.add.qr}</Button>
                </Box>
                <Box
                    ref={containerRef}
                    sx={{ width: '100%', minHeight: 420, border: `1px solid ${c.ruleSoft}` }}
                />
                <Box sx={{ mt: 3 }}>
                    <Box component="h3" sx={{ ...body, fontWeight: 600, mb: 1 }}>{d.listTitle}</Box>
                    {list.length === 0 && <Box sx={{ ...body, color: c.inkFaint }}>{d.empty}</Box>}
                    {list.map((item) => (
                        <ItemRow
                            key={item.names.join('|')}
                            item={item}
                            assets={assets}
                            onRemove={() => apply(remove(current(), item.names))}
                            onChange={(patch) => remember(updateQuestion(current(), (item as DraftItem & { kind: 'question' }).field.key, patch))}
                            onDone={() => apply(normalize(current()))}
                        />
                    ))}
                </Box>
            </Step>

            <Step number={3} title={d.steps.save}>
                {saveFields}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
                    <Button variant="contained" onClick={handleSave} disabled={saving || !templateName.trim()}>
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
                onText={(t) => apply(addText(current(), t))}
                onQuestion={(q) => apply(addQuestion(current(), q))}
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

function ItemRow({ item, assets, onRemove, onChange, onDone }: {
    item: DraftItem;
    assets: OrgAsset[];
    onRemove: () => void;
    onChange: (patch: { label?: string; type?: FormFieldType; optional?: boolean; options?: string[] }) => void;
    onDone: () => void;
}) {
    const { strings } = useAdminLang();
    const d = strings.admin.designer;
    const row = { display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', py: 1.5, borderBottom: `1px solid ${c.ruleSoft}` };

    const describe = (): string => {
        switch (item.kind) {
            case 'text': return d.item.text(item.text);
            case 'image': return d.item.image;
            case 'signature': return d.item.signature(item.number);
            case 'qr': return d.item.qr;
            case 'today': return d.item.today;
            case 'library': return item.assetKind === 'logo' ? d.item.logo : d.item.bodyText;
            case 'other': return item.summary?.kind === 'mixed' ? d.item.mixed(item.summary.template) : d.item.other;
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
                    <TextField
                        size="small"
                        label={d.optionsLabel}
                        multiline
                        value={(f.options ?? []).join('\n')}
                        onChange={(e) => onChange({ options: e.target.value.split('\n') })}
                        onBlur={() => onChange({ options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) })}
                        sx={{ minWidth: 200 }}
                    />
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
    const [options, setOptions] = useState('');

    useEffect(() => {
        if (!adding) return;
        setValue('');
        setType('text');
        setOptional(false);
        setOptions('');
    }, [adding]);

    const choices = options.split('\n').map((o) => o.trim()).filter(Boolean);
    const ready = value.trim() !== '' && (adding !== 'list' || choices.length > 0);

    const submit = () => {
        if (!ready) return;
        if (adding === 'text') onText(value.trim());
        else if (adding === 'list') onQuestion({ label: value.trim(), type: 'dropdown', optional, options: choices });
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
                    <TextField label={d.optionsLabel} multiline minRows={4} value={options} onChange={(e) => setOptions(e.target.value)} />
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

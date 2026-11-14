import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TextField,
} from '@mui/material';
import { Designer } from '@pdfme/ui';
import { text, image, barcodes } from '@pdfme/schemas';
import { Template, BLANK_PDF } from '@pdfme/common';
import { saveTemplate, getFullTemplate, getTemplates, fromPdfmeTemplate } from '@/util/databaseInteractions/templateService';
import { listOrgAssets } from '@/util/databaseInteractions/orgAssets';
import { deriveFormSchema } from '@attester/shared/templateFields';
import { validateTemplateForSave } from '@attester/shared/validateTemplate';
import { buildPreviewPdfUrl } from '@/util/previewPdf';
import type { TemplateSummary } from '@attester/shared/types/templateTypes';
import type { FieldBindings } from '@attester/shared/types/fieldBindings';
import type { OrgAsset } from '@attester/shared/types/orgAssets';
import type { FormSchema } from '@attester/shared/types/formSchema';
import BindingsEditor from './BindingsEditor';
import SchemaEditor from './SchemaEditor';
import StarterTemplatePicker from './StarterTemplatePicker';
import type { StarterTemplate } from '@/app/pdfinfo/starterTemplates';
import { useAdminLang } from '@/util/useAdminLang';
import { body, c, h2, mono } from '@/app/style/tokens';

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

function Step({ number, title, help, action, children }: {
    number: number;
    title: string;
    help?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <Box component="section" sx={{ borderTop: `1px solid ${c.rule}`, pt: 3, pb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: help ? 0.5 : 2 }}>
                <Box sx={mono}>{String(number).padStart(2, '0')}</Box>
                <Box component="h2" sx={h2}>{title}</Box>
                {action && <Box sx={{ ml: 'auto' }}>{action}</Box>}
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
    const [saving, setSaving] = useState(false);
    const [existingTemplates, setExistingTemplates] = useState<TemplateSummary[]>([]);
    const [assets, setAssets] = useState<OrgAsset[]>([]);
    const [bindings, setBindings] = useState<FieldBindings>({});
    const [formSchema, setFormSchema] = useState<FormSchema>([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewBusy, setPreviewBusy] = useState(false);
    // Bump this counter to force BindingsEditor to re-read the designer's schema.
    const [schemaRev, setSchemaRev] = useState(0);

    // Revoke the previous preview URL when it's replaced or the page unmounts
    // — otherwise the blob hangs around in memory.
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    useEffect(() => {
        if (!containerRef.current || designerRef.current) return;

        const template: Template = {
            basePdf: BLANK_PDF,
            schemas: [[]],
        };

        designerRef.current = new Designer({
            domContainer: containerRef.current,
            template,
            plugins: {
                Text: text,
                Image: image,
                QR: barcodes.qrcode,
            },
        });

        designerRef.current.onChangeTemplate(() => setSchemaRev((r) => r + 1));

        getTemplates(orgSlug).then(setExistingTemplates).catch((e) => {
            onError(`${d.loadTemplatesError}: ${(e as Error).message}`);
        });
        listOrgAssets(orgSlug).then(setAssets).catch((e) => {
            onError(`${d.loadAssetsError}: ${(e as Error).message}`);
        });

        return () => {
            if (designerRef.current) {
                designerRef.current.destroy();
                designerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgSlug]);

    // Deep-link: if the URL contains ?id=<template-id>, auto-load it once
    // when both the designer and the templates list are ready. The ref
    // guards against re-loading the same template if the templates list
    // refreshes (e.g. after a Save).
    const loadedDeepLinkRef = useRef<string | null>(null);
    useEffect(() => {
        if (!initialTemplateId) return;
        if (loadedDeepLinkRef.current === initialTemplateId) return;
        if (!designerRef.current || existingTemplates.length === 0) return;
        const found = existingTemplates.find((t) => t.id === initialTemplateId);
        if (!found) return;
        loadedDeepLinkRef.current = initialTemplateId;
        void handleLoadTemplate(found);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTemplateId, existingTemplates]);

    const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !designerRef.current) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target?.result as string;
            designerRef.current?.updateTemplate({
                basePdf: base64,
                schemas: [[]],
            });
            setSchemaRev((r) => r + 1);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!designerRef.current || !templateName.trim()) {
            onError(d.nameFirst);
            return;
        }

        setSaving(true);
        try {
            const pdfmeTemplate = designerRef.current.getTemplate();
            const validationErrors = validateTemplateForSave(pdfmeTemplate);
            if (validationErrors.length > 0) {
                onError(validationErrors.join(' '));
                setSaving(false);
                return;
            }
            const data = fromPdfmeTemplate(pdfmeTemplate, templateName.trim(), {
                description: templateDescription || undefined,
                isOffered,
                fieldBindings: bindings,
                formSchema: formSchema.length > 0 ? formSchema : undefined,
            });

            await saveTemplate(orgSlug, data);
            onSuccess(d.saved(templateName));

            const templates = await getTemplates(orgSlug);
            setExistingTemplates(templates);
        } catch {
            onError(d.saveError);
        } finally {
            setSaving(false);
        }
    };

    const handleLoadTemplate = async (summary: TemplateSummary) => {
        if (!designerRef.current || !summary.id) return;
        let template;
        try {
            template = await getFullTemplate(orgSlug, summary.id);
        } catch (e) {
            onError(`${d.loadTemplatesError}: ${(e as Error).message}`);
            return;
        }
        if (!designerRef.current) return;

        designerRef.current.updateTemplate({
            basePdf: template.basePdf,
            schemas: template.schemas,
        });
        setBindings(template.fieldBindings ?? {});
        setFormSchema(template.formSchema ?? []);
        setSchemaRev((r) => r + 1);

        onTemplateLoad(template.name, template.description || '', template.isOffered);
    };

    const handlePickStarter = (starter: StarterTemplate) => {
        if (!designerRef.current) return;
        designerRef.current.updateTemplate(starter.template);
        setBindings(starter.fieldBindings);
        setFormSchema(starter.formSchema);
        setSchemaRev((r) => r + 1);
        onTemplateLoad(starter.name, starter.description, false);
    };

    const handleExport = () => {
        if (!designerRef.current) return;

        const template = designerRef.current.getTemplate();
        const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `template-${templateName || 'export'}.json`;
        a.click();
    };

    const handlePreview = async () => {
        if (!designerRef.current) {
            onError(d.notReady);
            return;
        }
        setPreviewBusy(true);
        try {
            const url = await buildPreviewPdfUrl(
                orgSlug,
                designerRef.current.getTemplate(),
                bindings,
                formSchema,
                assets,
            );
            setPreviewUrl(url);
        } catch (e) {
            onError(`${d.previewError}: ${(e as Error).message}`);
        } finally {
            setPreviewBusy(false);
        }
    };

    const closePreview = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
    };

    // Read schemas from the live designer for the bindings editor. The
    // schemaRev counter forces re-renders when the designer mutates its state.
    const currentSchemas: Template['schemas'] = (() => {
        if (!designerRef.current) return [[]];
        try {
            return designerRef.current.getTemplate().schemas;
        } catch {
            return [[]];
        }
    })();
    // schemaRev is read here so React re-renders when it changes; the value
    // itself isn't used.
    void schemaRev;

    return (
        <>
            <Step number={1} title={d.steps.look} help={d.steps.lookHelp}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                    <Button variant="outlined" onClick={() => setPickerOpen(true)}>
                        {d.startFromTemplate}
                    </Button>

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
                            {existingTemplates.map((template) => (
                                <MenuItem key={template.id} value={template.id}>
                                    {template.name}
                                    {template.isOffered && d.offeredSuffix}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}
                </Box>
                <Box
                    ref={containerRef}
                    // No fixed height: pdfme sizes itself to what is left of the
                    // window below this box, and a taller box only adds a gap.
                    sx={{ width: '100%', minHeight: 420, border: `1px solid ${c.ruleSoft}` }}
                />
            </Step>

            <Step number={2} title={d.steps.fields} help={d.bindingsIntro}>
                <BindingsEditor
                    schemas={currentSchemas}
                    bindings={bindings}
                    assets={assets}
                    formSchema={formSchema}
                    onChange={setBindings}
                />
            </Step>

            <Step
                number={3}
                title={d.steps.form}
                help={d.steps.formHelp}
                action={
                    <Button size="small" onClick={() => setFormSchema(deriveFormSchema(currentSchemas, bindings))}>
                        {d.autoDerive}
                    </Button>
                }
            >
                <SchemaEditor orgSlug={orgSlug} schema={formSchema} assets={assets} onChange={setFormSchema} />
            </Step>

            <Step number={4} title={d.steps.save}>
                {saveFields}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving || !templateName.trim()}
                    >
                        {saving ? <CircularProgress size={20} /> : d.saveTemplate}
                    </Button>
                    <Button variant="outlined" onClick={handlePreview} disabled={previewBusy}>
                        {previewBusy ? <CircularProgress size={20} /> : d.previewPdf}
                    </Button>
                    <Button size="small" onClick={handleExport} sx={{ ml: 'auto' }}>
                        {d.exportJson}
                    </Button>
                </Box>
            </Step>

            <StarterTemplatePicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onPick={handlePickStarter}
            />

            <Dialog open={!!previewUrl} onClose={closePreview} maxWidth="lg" fullWidth>
                <DialogTitle>{d.previewDialogTitle}</DialogTitle>
                <DialogContent dividers sx={{ p: 0, height: '80vh' }}>
                    {previewUrl && (
                        <iframe
                            src={previewUrl}
                            title="PDF-forhåndsvisning"
                            style={{ width: '100%', height: '100%', border: 0 }}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    {previewUrl && (
                        <Button
                            component="a"
                            href={previewUrl}
                            download={`forhandsvisning-${templateName || 'mal'}.pdf`}
                        >
                            {d.download}
                        </Button>
                    )}
                    <Button onClick={closePreview} variant="contained">
                        {d.close}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

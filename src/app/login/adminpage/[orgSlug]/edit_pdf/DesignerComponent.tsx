import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Paper,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material';
import { Designer } from '@pdfme/ui';
import { text, image, barcodes } from '@pdfme/schemas';
import { Template, BLANK_PDF } from '@pdfme/common';
import { saveTemplate, getTemplates, fromPdfmeTemplate } from '@/util/databaseInteractions/templateService';
import { listOrgAssets } from '@/util/databaseInteractions/orgAssets';
import { deriveFormSchema } from '@/util/templateFields';
import { validateTemplateForSave } from '@/util/validateTemplate';
import { buildPreviewPdfUrl } from '@/util/previewPdf';
import type { PDFTemplate } from '@/types/templateTypes';
import type { FieldBindings } from '@/types/fieldBindings';
import type { OrgAsset } from '@/types/orgAssets';
import type { FormSchema } from '@/types/formSchema';
import BindingsEditor from './BindingsEditor';
import SchemaEditor from './SchemaEditor';
import StarterTemplatePicker from './StarterTemplatePicker';
import type { StarterTemplate } from '@/app/pdfinfo/starterTemplates';

interface Props {
    orgSlug: string;
    templateName: string;
    templateDescription: string;
    isDefault: boolean;
    initialTemplateId?: string | null;
    onError: (msg: string | null) => void;
    onSuccess: (msg: string | null) => void;
    onTemplateLoad: (name: string, desc: string, isDefault: boolean) => void;
}

export default function DesignerComponent({
                                              orgSlug,
                                              templateName,
                                              templateDescription,
                                              isDefault,
                                              initialTemplateId,
                                              onError,
                                              onSuccess,
                                              onTemplateLoad,
                                          }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const designerRef = useRef<Designer | null>(null);
    const [saving, setSaving] = useState(false);
    const [existingTemplates, setExistingTemplates] = useState<PDFTemplate[]>([]);
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

        getTemplates(orgSlug).then(setExistingTemplates).catch(() => {});
        listOrgAssets(orgSlug).then(setAssets).catch(() => {});

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
        designerRef.current.updateTemplate({
            basePdf: found.basePdf,
            schemas: found.schemas,
        });
        setBindings(found.fieldBindings ?? {});
        setFormSchema(found.formSchema ?? []);
        setSchemaRev((r) => r + 1);
        onTemplateLoad(found.name, found.description || '', found.isDefault);
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
            onError('Gi malen et navn først');
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
                isDefault,
                fieldBindings: bindings,
                formSchema: formSchema.length > 0 ? formSchema : undefined,
            });

            await saveTemplate(orgSlug, data);
            onSuccess(`Mal "${templateName}" lagret!`);

            const templates = await getTemplates(orgSlug);
            setExistingTemplates(templates);
        } catch {
            onError('Kunne ikke lagre mal');
        } finally {
            setSaving(false);
        }
    };

    const handleLoadTemplate = (template: PDFTemplate) => {
        if (!designerRef.current) return;

        designerRef.current.updateTemplate({
            basePdf: template.basePdf,
            schemas: template.schemas,
        });
        setBindings(template.fieldBindings ?? {});
        setFormSchema(template.formSchema ?? []);
        setSchemaRev((r) => r + 1);

        onTemplateLoad(template.name, template.description || '', template.isDefault);
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
            onError('Designeren er ikke klar enda');
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
            onError(`Kunne ikke generere forhåndsvisning: ${(e as Error).message}`);
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
            <Paper sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                    <Button variant="outlined" onClick={() => setPickerOpen(true)}>
                        Start fra mal
                    </Button>

                    <Button variant="outlined" component="label">
                        Last opp PDF
                        <input type="file" accept="application/pdf" hidden onChange={handlePdfUpload} />
                    </Button>

                    <Button variant="outlined" onClick={handlePreview} disabled={previewBusy}>
                        {previewBusy ? <CircularProgress size={20} /> : 'Forhåndsvis PDF'}
                    </Button>

                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving || !templateName.trim()}
                    >
                        {saving ? <CircularProgress size={20} /> : 'Lagre mal'}
                    </Button>

                    <Button variant="outlined" color="secondary" onClick={handleExport}>
                        Eksporter JSON
                    </Button>
                </Box>

                {existingTemplates.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {existingTemplates.map((template) => (
                            <Button
                                key={template.id}
                                variant={template.isDefault ? 'contained' : 'outlined'}
                                size="small"
                                onClick={() => handleLoadTemplate(template)}
                            >
                                {template.name}
                                {template.isDefault && ' (standard)'}
                            </Button>
                        ))}
                    </Box>
                )}
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Box
                    ref={containerRef}
                    sx={{
                        width: '100%',
                        height: '70vh',
                        minHeight: 600,
                    }}
                />
            </Paper>

            <Paper sx={{ p: 2, mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                    Felter (PDF → data)
                </Typography>
                <BindingsEditor
                    schemas={currentSchemas}
                    bindings={bindings}
                    assets={assets}
                    formSchema={formSchema}
                    onChange={setBindings}
                />
            </Paper>

            <Paper sx={{ p: 2, mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6">Skjema (innsender → data)</Typography>
                    <Button
                        size="small"
                        onClick={() => setFormSchema(deriveFormSchema(currentSchemas, bindings))}
                    >
                        Auto-utled fra PDF
                    </Button>
                </Box>
                <SchemaEditor schema={formSchema} assets={assets} onChange={setFormSchema} />
            </Paper>

            <StarterTemplatePicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onPick={handlePickStarter}
            />

            <Dialog open={!!previewUrl} onClose={closePreview} maxWidth="lg" fullWidth>
                <DialogTitle>Forhåndsvisning av PDF</DialogTitle>
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
                            Last ned
                        </Button>
                    )}
                    <Button onClick={closePreview} variant="contained">
                        Lukk
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

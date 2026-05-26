import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Paper,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Designer } from '@pdfme/ui';
import { text, image, barcodes, rectangle } from '@pdfme/schemas';
import { Template, BLANK_PDF } from '@pdfme/common';
import { saveTemplate, getTemplates, fromPdfmeTemplate } from '@/util/databaseInteractions/templateService';
import { listOrgAssets } from '@/util/databaseInteractions/orgAssets';
import { deriveFormSchema } from '@/util/templateFields';
import { validateTemplateForSave } from '@/util/validateTemplate';

/**
 * Boil the (often verbose) validateTemplateForSave error sentences down to
 * a short chip label. Falls back to the count of missing items for
 * anything we don't have a shorter phrasing for.
 */
function summariseValidationErrors(errors: string[]): string {
    const short: string[] = [];
    for (const e of errors) {
        if (/QR-kode/i.test(e)) short.push('Mangler QR-kode');
        else if (/attester\.no/i.test(e)) short.push('Mangler attester.no-tekst');
        else short.push('Ufullstendig mal');
    }
    return short.join(' · ');
}
import { buildPreviewPdfUrl } from '@/util/previewPdf';
import { applyBackground, readBackgroundColor, BACKGROUNDS } from '@/util/templateBackground';
import {
    quickAddBodyText,
    quickAddBrand,
    quickAddLogo,
    quickAddQrCode,
    quickAddSignature,
    type QuickAddResult,
} from '@/util/quickAddFields';
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
    // True whenever the in-memory template has been edited since the last save.
    // Drives the beforeunload prompt + a soft visual cue on the Lagre button.
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (!dirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            // Modern browsers ignore the custom message and show their own.
            // Returning a string is enough to trigger the prompt.
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

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
                Rectangle: rectangle,
            },
        });

        designerRef.current.onChangeTemplate(() => {
            setSchemaRev((r) => r + 1);
            setDirty(true);
        });

        getTemplates(orgSlug).then(setExistingTemplates).catch((e) => {
            onError(`Kunne ikke laste maler: ${(e as Error).message}`);
        });
        listOrgAssets(orgSlug).then(setAssets).catch((e) => {
            onError(`Kunne ikke laste innhold (signaturer/logoer/…): ${(e as Error).message}`);
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
            setDirty(true);
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
            setDirty(false);

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
        // Loading isn't editing — reset the unsaved-changes flag.
        setDirty(false);
    };

    const handlePickStarter = (starter: StarterTemplate) => {
        if (!designerRef.current) return;
        designerRef.current.updateTemplate(starter.template);
        setBindings(starter.fieldBindings);
        setFormSchema(starter.formSchema);
        setSchemaRev((r) => r + 1);
        onTemplateLoad(starter.name, starter.description, false);
        // Starting from a starter is a load, not an edit — admin hasn't
        // changed anything yet. Mark fresh.
        setDirty(false);
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

    // Which of the asset kinds the quick-add buttons assume a default for
    // are NOT yet set up in this org's Innhold. Drives the small hint
    // below the toolbar so admins know upfront why a slot may render
    // empty after they click "+ Signatur".
    const missingDefaults: string[] = (() => {
        const haveDefault = (kind: OrgAsset['kind']) =>
            assets.some((a) => a.kind === kind && a.isDefault);
        const out: string[] = [];
        if (!haveDefault('signature')) out.push('signatur');
        if (!haveDefault('logo')) out.push('logo');
        if (!haveDefault('body_text')) out.push('tekstblokk');
        return out;
    })();

    const currentValidationErrors = (() => {
        if (!designerRef.current) return ['Designeren laster …'];
        try {
            return validateTemplateForSave(designerRef.current.getTemplate());
        } catch {
            return [];
        }
    })();

    const currentBackground = (() => {
        if (!designerRef.current) return null;
        try {
            return readBackgroundColor(designerRef.current.getTemplate());
        } catch {
            return null;
        }
    })();

    const handlePickBackground = (color: string | null) => {
        if (!designerRef.current) return;
        const patched = applyBackground(designerRef.current.getTemplate(), color);
        designerRef.current.updateTemplate(patched);
        setSchemaRev((r) => r + 1);
        setDirty(true);
    };

    // Wrappers passed to BindingsEditor / SchemaEditor so admin edits in
    // those panels also flip the unsaved-changes flag. Internal places
    // (load, quick-add) bypass these and manage `dirty` explicitly.
    const handleBindingsChange = (next: FieldBindings) => {
        setBindings(next);
        setDirty(true);
    };
    const handleFormSchemaChange = (next: FormSchema) => {
        setFormSchema(next);
        setDirty(true);
    };

    const handleQuickAdd = (factory: (schemas: Template['schemas']) => QuickAddResult) => {
        if (!designerRef.current) return;
        const current = designerRef.current.getTemplate();
        const { fields, bindings: newBindings } = factory(current.schemas);
        if (fields.length === 0) return; // idempotent factories may return empty
        const firstPage = [...(current.schemas[0] ?? []), ...fields];
        const nextSchemas = [firstPage, ...current.schemas.slice(1)];
        designerRef.current.updateTemplate({ ...current, schemas: nextSchemas });
        setBindings((prev) => ({ ...prev, ...newBindings }));
        setSchemaRev((r) => r + 1);
        setDirty(true);
    };

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
                        {saving ? <CircularProgress size={20} /> : (dirty ? 'Lagre mal *' : 'Lagre mal')}
                    </Button>

                    {currentValidationErrors.length === 0 ? (
                        <Chip
                            icon={<CheckCircleIcon />}
                            label="Klar til lagring"
                            color="success"
                            variant="outlined"
                            size="small"
                        />
                    ) : (
                        <Chip
                            icon={<WarningAmberIcon />}
                            label={summariseValidationErrors(currentValidationErrors)}
                            color="warning"
                            variant="outlined"
                            size="small"
                        />
                    )}

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

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                        Hurtig-felter:
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => handleQuickAdd(quickAddQrCode)}>
                        + QR-kode
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleQuickAdd(quickAddSignature)}>
                        + Signatur
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleQuickAdd(quickAddLogo)}>
                        + Logo
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleQuickAdd(quickAddBodyText)}>
                        + Tekstblokk
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleQuickAdd(quickAddBrand)}>
                        + attester.no-merke
                    </Button>
                </Box>

                {missingDefaults.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Ingen standard {missingDefaults.join(' / ')} satt opp enda — feltet rendres tomt før du legger til en i{' '}
                        <a
                            href={`/login/adminpage/${orgSlug}/rediger`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'inherit' }}
                        >
                            Innhold ↗
                        </a>.
                    </Typography>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                        Bakgrunn:
                    </Typography>
                    <Box
                        onClick={() => handlePickBackground(null)}
                        title="Ingen"
                        sx={{
                            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                            border: currentBackground === null ? '2px solid' : '1px dashed',
                            borderColor: currentBackground === null ? 'primary.main' : 'grey.400',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: 'transparent', fontSize: 18, color: 'grey.500',
                        }}
                    >
                        ✕
                    </Box>
                    {BACKGROUNDS.map((b) => (
                        <Box
                            key={b.id}
                            onClick={() => handlePickBackground(b.color)}
                            title={b.name}
                            sx={{
                                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                                bgcolor: b.color,
                                border: currentBackground === b.color ? '2px solid' : '1px solid',
                                borderColor: currentBackground === b.color ? 'primary.main' : 'grey.400',
                            }}
                        />
                    ))}
                </Box>
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
                    onChange={handleBindingsChange}
                />
            </Paper>

            <Paper sx={{ p: 2, mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6">Skjema (innsender → data)</Typography>
                    <Button
                        size="small"
                        onClick={() => handleFormSchemaChange(deriveFormSchema(currentSchemas, bindings))}
                    >
                        Auto-utled fra PDF
                    </Button>
                </Box>
                <SchemaEditor orgSlug={orgSlug} schema={formSchema} assets={assets} onChange={handleFormSchemaChange} />
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

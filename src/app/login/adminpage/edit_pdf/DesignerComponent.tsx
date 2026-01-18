import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Paper, CircularProgress } from '@mui/material';
import { Designer } from '@pdfme/ui';
import { text, image, barcodes } from '@pdfme/schemas';
import { Template, BLANK_PDF } from '@pdfme/common';
import { saveTemplate, getTemplates, fromPdfmeTemplate } from '@/util/databaseInteractions/templateService';
import type { PDFTemplate } from '@/types/templateTypes';

interface Props {
    templateName: string;
    templateDescription: string;
    isDefault: boolean;
    onError: (msg: string | null) => void;
    onSuccess: (msg: string | null) => void;
    onTemplateLoad: (name: string, desc: string, isDefault: boolean) => void;
}

export default function DesignerComponent({
                                              templateName,
                                              templateDescription,
                                              isDefault,
                                              onError,
                                              onSuccess,
                                              onTemplateLoad,
                                          }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const designerRef = useRef<Designer | null>(null);
    const [saving, setSaving] = useState(false);
    const [existingTemplates, setExistingTemplates] = useState<PDFTemplate[]>([]);

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

        getTemplates()
            .then(setExistingTemplates)
            .catch(() => {});

        return () => {
            if (designerRef.current) {
                designerRef.current.destroy();
                designerRef.current = null;
            }
        };
    }, []);

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
            const data = fromPdfmeTemplate(pdfmeTemplate, templateName.trim(), {
                description: templateDescription || undefined,
                isDefault,
            });

            await saveTemplate(data);
            onSuccess(`Mal "${templateName}" lagret!`);

            const templates = await getTemplates();
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

        onTemplateLoad(template.name, template.description || '', template.isDefault);
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

    return (
        <>
            <Paper sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                    <Button variant="outlined" component="label">
                        Last opp PDF
                        <input type="file" accept="application/pdf" hidden onChange={handlePdfUpload} />
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
        </>
    );
}
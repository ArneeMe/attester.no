'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Box,
    Container,
    Typography,
    Paper,
    TextField,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Button,
    CircularProgress,
    Alert,
    IconButton,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {
    getTemplateById,
    updateTemplateFields,
} from '@/util/databaseInteractions/templateService';
import {
    extractConfigurableFields,
    type PDFTemplate,
    type TemplateField,
    type TemplateFieldType,
} from '@/types/templateTypes';

export default function ConfigureFieldsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const templateId = searchParams.get('id');

    const [template, setTemplate] = useState<PDFTemplate | null>(null);
    const [fields, setFields] = useState<TemplateField[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!templateId) {
            setError('Ingen mal-ID spesifisert');
            setLoading(false);
            return;
        }

        loadTemplate();
    }, [templateId]);

    const loadTemplate = async () => {
        try {
            const loaded = await getTemplateById(templateId!);
            if (!loaded) {
                setError('Fant ikke malen');
                return;
            }

            setTemplate(loaded);

            if (loaded.fields && loaded.fields.length > 0) {
                setFields(loaded.fields);
            } else {
                const schemaFields = extractConfigurableFields(loaded.schemas);
                setFields(
                    schemaFields.map((key, index) => ({
                        key,
                        label: '',
                        type: 'text' as TemplateFieldType,
                        required: false,
                        order: index,
                    }))
                );
            }
        } catch (err) {
            setError('Kunne ikke laste mal');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateField = (index: number, updates: Partial<TemplateField>) => {
        setFields((prev) =>
            prev.map((field, i) => (i === index ? { ...field, ...updates } : field))
        );
    };

    const updateOption = (fieldIndex: number, optionIndex: number, value: string) => {
        setFields((prev) =>
            prev.map((field, i) => {
                if (i !== fieldIndex) return field;
                const options = [...(field.options || [])];
                options[optionIndex] = value;
                return { ...field, options };
            })
        );
    };

    const addOption = (fieldIndex: number) => {
        setFields((prev) =>
            prev.map((field, i) => {
                if (i !== fieldIndex) return field;
                return { ...field, options: [...(field.options || []), ''] };
            })
        );
    };

    const removeOption = (fieldIndex: number, optionIndex: number) => {
        setFields((prev) =>
            prev.map((field, i) => {
                if (i !== fieldIndex) return field;
                const options = (field.options || []).filter((_, oi) => oi !== optionIndex);
                return { ...field, options };
            })
        );
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= fields.length) return;

        setFields((prev) => {
            const updated = [...prev];
            [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
            return updated.map((f, i) => ({ ...f, order: i }));
        });
    };

    const handleSave = async () => {
        if (!templateId) return;

        const emptyLabels = fields.filter((f) => !f.label.trim());
        if (emptyLabels.length > 0) {
            setError('Alle felt må ha en ledetekst');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            await updateTemplateFields(templateId, fields);
            setSuccess('Feltkonfigurasjon lagret!');
        } catch (err) {
            setError('Kunne ikke lagre');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Container sx={{ py: 4, textAlign: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    if (!template) {
        return (
            <Container sx={{ py: 4 }}>
                <Alert severity="error">{error || 'Fant ikke malen'}</Alert>
                <Button onClick={() => router.push('/login/adminpage/edit_pdf')} sx={{ mt: 2 }}>
                    Tilbake til editor
                </Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>
                Konfigurer feltene
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Mal: <strong>{template.name}</strong>
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                    {success}
                </Alert>
            )}

            {fields.length === 0 ? (
                <Alert severity="info">
                    Ingen konfigurerbare felt funnet. Gå tilbake og legg til felt i PDF-designeren.
                </Alert>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {fields.map((field, index) => (
                        <Paper key={field.key} sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <DragIndicatorIcon color="disabled" />
                                <Typography variant="subtitle1" sx={{ fontFamily: 'monospace' }}>
                                    {field.key}
                                </Typography>
                                <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
                                    <Button
                                        size="small"
                                        disabled={index === 0}
                                        onClick={() => moveField(index, 'up')}
                                    >
                                        ↑
                                    </Button>
                                    <Button
                                        size="small"
                                        disabled={index === fields.length - 1}
                                        onClick={() => moveField(index, 'down')}
                                    >
                                        ↓
                                    </Button>
                                </Box>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <TextField
                                    label="Ledetekst (vises til bruker)"
                                    value={field.label}
                                    onChange={(e) => updateField(index, { label: e.target.value })}
                                    sx={{ flexGrow: 1, minWidth: 200 }}
                                    required
                                />

                                <Select
                                    value={field.type}
                                    onChange={(e) =>
                                        updateField(index, {
                                            type: e.target.value as TemplateFieldType,
                                            options: e.target.value === 'select' ? [''] : undefined,
                                        })
                                    }
                                    sx={{ minWidth: 120 }}
                                >
                                    <MenuItem value="text">Tekst</MenuItem>
                                    <MenuItem value="textarea">Lang tekst</MenuItem>
                                    <MenuItem value="date">Dato</MenuItem>
                                    <MenuItem value="select">Nedtrekksliste</MenuItem>
                                </Select>

                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={field.required}
                                            onChange={(e) =>
                                                updateField(index, { required: e.target.checked })
                                            }
                                        />
                                    }
                                    label="Påkrevd"
                                />
                            </Box>

                            {field.type === 'select' && (
                                <Box sx={{ mt: 2, pl: 2 }}>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        Alternativer:
                                    </Typography>
                                    {(field.options || []).map((option, optIndex) => (
                                        <Box
                                            key={optIndex}
                                            sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
                                        >
                                            <TextField
                                                size="small"
                                                value={option}
                                                onChange={(e) =>
                                                    updateOption(index, optIndex, e.target.value)
                                                }
                                                placeholder={`Alternativ ${optIndex + 1}`}
                                                sx={{ width: 200 }}
                                            />
                                            <IconButton
                                                size="small"
                                                onClick={() => removeOption(index, optIndex)}
                                                disabled={(field.options?.length || 0) <= 1}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    ))}
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => addOption(index)}
                                    >
                                        Legg til alternativ
                                    </Button>
                                </Box>
                            )}
                        </Paper>
                    ))}
                </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                    variant="outlined"
                    onClick={() => router.push('/login/adminpage/edit_pdf')}
                >
                    Tilbake
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || fields.length === 0}
                >
                    {saving ? <CircularProgress size={20} /> : 'Lagre konfigurasjon'}
                </Button>
            </Box>
        </Container>
    );
}
'use client'
export const runtime = 'edge';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useToast } from '@/components/ToastProvider';
import {
    deleteTemplate,
    getTemplates,
    saveTemplate,
    setTemplateDefault,
} from '@/util/databaseInteractions/templateService';
import type { PDFTemplate } from '@/types/templateTypes';

export default function MalerPage() {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const toast = useToast();
    const [templates, setTemplates] = useState<PDFTemplate[] | null>(null);

    const reload = async () => {
        try {
            setTemplates(await getTemplates(orgSlug));
        } catch (e) {
            toast.error('Kunne ikke laste maler: ' + (e as Error).message);
            setTemplates([]);
        }
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgSlug]);

    const handleSetDefault = async (t: PDFTemplate) => {
        if (!t.id) return;
        try {
            await setTemplateDefault(orgSlug, t.id, true);
            toast.success(`«${t.name}» er nå standardmal`);
            await reload();
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    const handleDuplicate = async (t: PDFTemplate) => {
        try {
            await saveTemplate(orgSlug, {
                name: `${t.name} (kopi)`,
                description: t.description,
                basePdf: t.basePdf,
                schemas: t.schemas,
                formSchema: t.formSchema,
                fieldBindings: t.fieldBindings,
                isDefault: false,
            });
            toast.success(`Kopi av «${t.name}» opprettet`);
            await reload();
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    const handleDelete = async (t: PDFTemplate) => {
        if (!t.id) return;
        if (!confirm(`Slette malen «${t.name}»?\n\nNB: Maler med eksisterende sertifikater kan ikke slettes.`)) {
            return;
        }
        try {
            await deleteTemplate(orgSlug, t.id);
            toast.success(`«${t.name}» slettet`);
            await reload();
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    if (templates === null) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Maler
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Alle PDF-malene i organisasjonen din. Standardmalen er den
                innsendere får når de besøker det offentlige skjemaet uten å
                spesifisere en mal i URL-en.
            </Typography>

            {templates.length === 0 ? (
                <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                    <Typography variant="body1" gutterBottom>
                        Ingen maler enda.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Gå til «PDF-mal» og start fra et gallerivalg eller en blank canvas.
                    </Typography>
                    <Button
                        component={Link}
                        href={`/login/adminpage/${orgSlug}/edit_pdf`}
                        variant="contained"
                    >
                        Lag en mal
                    </Button>
                </Paper>
            ) : (
                <Stack spacing={2}>
                    {templates.map((t) => (
                        <Paper key={t.id} sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <Typography variant="h6">{t.name}</Typography>
                                        {t.isDefault && (
                                            <Chip
                                                icon={<StarIcon />}
                                                label="Standard"
                                                size="small"
                                                color="primary"
                                            />
                                        )}
                                    </Box>
                                    {t.description && (
                                        <Typography variant="body2" color="text.secondary">
                                            {t.description}
                                        </Typography>
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                        Oppdatert {t.updatedAt.toLocaleDateString('nb-NO')}
                                        {' · '}
                                        {(t.formSchema?.length ?? 0)} skjemafelt
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        component={Link}
                                        href={`/login/adminpage/${orgSlug}/edit_pdf?id=${encodeURIComponent(t.id ?? '')}`}
                                        startIcon={<EditIcon />}
                                        size="small"
                                    >
                                        Åpne
                                    </Button>
                                    <Button
                                        startIcon={<ContentCopyIcon />}
                                        size="small"
                                        onClick={() => handleDuplicate(t)}
                                    >
                                        Dupliser
                                    </Button>
                                    {!t.isDefault && (
                                        <Button
                                            startIcon={<StarBorderIcon />}
                                            size="small"
                                            onClick={() => handleSetDefault(t)}
                                        >
                                            Sett som standard
                                        </Button>
                                    )}
                                    <IconButton
                                        color="error"
                                        onClick={() => handleDelete(t)}
                                        aria-label={`Slett ${t.name}`}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                        </Paper>
                    ))}
                </Stack>
            )}
        </Box>
    );
}

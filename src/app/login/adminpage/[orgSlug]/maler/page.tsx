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
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useToast } from '@/components/ToastProvider';
import {
    getTemplates,
    saveTemplate,
    setTemplateDefault,
} from '@/util/databaseInteractions/templateService';
import type { PDFTemplate } from '@/types/templateTypes';
import { useAdminLang } from '@/util/useAdminLang';

export default function MalerPage() {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const { lang, strings } = useAdminLang();
    const a = strings.admin.templates;
    const toast = useToast();
    const [templates, setTemplates] = useState<PDFTemplate[] | null>(null);

    const reload = async () => {
        try {
            setTemplates(await getTemplates(orgSlug));
        } catch (e) {
            toast.error(a.loadError + (e as Error).message);
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
            toast.success(a.nowDefault(t.name));
            await reload();
        } catch (e) {
            toast.error((e as Error).message);
        }
    };

    const handleDuplicate = async (t: PDFTemplate) => {
        try {
            await saveTemplate(orgSlug, {
                name: a.copyOf(t.name),
                description: t.description,
                basePdf: t.basePdf,
                schemas: t.schemas,
                formSchema: t.formSchema,
                fieldBindings: t.fieldBindings,
                isDefault: false,
            });
            toast.success(a.copyCreated(t.name));
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
                {a.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {a.intro}
            </Typography>

            {templates.length === 0 ? (
                <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
                    <Typography variant="body1" gutterBottom>
                        {a.emptyTitle}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {a.emptyBody}
                    </Typography>
                    <Button
                        component={Link}
                        href={`/login/adminpage/${orgSlug}/edit_pdf`}
                        variant="contained"
                    >
                        {a.create}
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
                                                label={a.standard}
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
                                        {a.updated(t.updatedAt.toLocaleDateString(lang === 'en' ? 'en-GB' : 'nb-NO'), t.formSchema?.length ?? 0)}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        component={Link}
                                        href={`/login/adminpage/${orgSlug}/edit_pdf?id=${encodeURIComponent(t.id ?? '')}`}
                                        startIcon={<EditIcon />}
                                        size="small"
                                    >
                                        {a.open}
                                    </Button>
                                    <Button
                                        startIcon={<ContentCopyIcon />}
                                        size="small"
                                        onClick={() => handleDuplicate(t)}
                                    >
                                        {a.duplicate}
                                    </Button>
                                    {!t.isDefault && (
                                        <Button
                                            startIcon={<StarBorderIcon />}
                                            size="small"
                                            onClick={() => handleSetDefault(t)}
                                        >
                                            {a.setDefault}
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        </Paper>
                    ))}
                </Stack>
            )}
        </Box>
    );
}

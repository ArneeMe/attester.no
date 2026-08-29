'use client'
import React, { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import Link from "next/link";
import { useRouter, useSearchParams } from 'next/navigation';
import { getOrgBySlug } from '@/lib/nhost';
import type { FormSchema } from '@/types/formSchema';
import type { OfferedTemplate } from '@/util/offeredTemplates';
import SchemaForm from '@/components/SchemaForm';
import SchemaDetails from '@/components/SchemaDetails';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from "@/util/confirmDialog";
import { getStrings } from '@/strings';
import LanguageToggle from '@/components/LanguageToggle';
import OrgLogo from '@/components/OrgLogo';

interface Props {
    orgSlug: string;
}

type TemplateForForm = { id: string; name: string; form_schema: FormSchema | null };

const OrgSubmissionForm: React.FC<Props> = ({ orgSlug }) => {
    const searchParams = useSearchParams();
    const templateIdOverride = searchParams.get('t');
    const lang = searchParams.get('lang');
    const strings = getStrings(lang);
    const s = strings.form;
    const withLang = (path: string) => (lang === 'en' ? `${path}?lang=en` : path);
    const toast = useToast();
    const router = useRouter();

    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [openHelpDialog, setOpenHelpDialog] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [orgName, setOrgName] = useState<string>(orgSlug);
    const [template, setTemplate] = useState<TemplateForForm | null>(null);
    const [offered, setOffered] = useState<OfferedTemplate[]>([]);
    const [chosenId, setChosenId] = useState<string | null>(templateIdOverride);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const orgPromise = getOrgBySlug(orgSlug).catch(() => null);
                const offeredPromise = fetch(
                    `/api/org/${encodeURIComponent(orgSlug)}/offered-templates`,
                )
                    .then((r) => (r.ok ? r.json() : { templates: [] }))
                    .catch(() => ({ templates: [] }));

                const [org, offeredJson] = await Promise.all([orgPromise, offeredPromise]);
                if (org?.name) setOrgName(org.name);

                const list: OfferedTemplate[] = offeredJson.templates ?? [];
                setOffered(list);

                // One offering, or the visitor arrived with ?t= — load straight
                // into the form. Only a genuine choice shows the chooser.
                const only = list.length === 1 ? list[0].id : null;
                const target = chosenId ?? only;
                if (!target) {
                    setLoading(false);
                    return;
                }

                const tmplRes = await fetch(
                    `/api/org/${encodeURIComponent(orgSlug)}/templates/${encodeURIComponent(target)}`,
                );
                if (tmplRes.ok) {
                    const json = await tmplRes.json();
                    if (json.template) setTemplate(json.template);
                }
            } catch (e) {
                console.error('Failed to load template:', e);
            }
            setLoading(false);
        };
        fetchData();
    }, [orgSlug, chosenId]);

    const schema = template?.form_schema ?? null;

    const setTemplateParam = (id: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (id) params.set('t', id); else params.delete('t');
        const qs = params.toString();
        router.replace(qs ? `?${qs}` : window.location.pathname);
    };

    const chooseTemplate = (id: string) => {
        setChosenId(id);
        setTemplateParam(id);
    };

    const backToChooser = () => {
        setTemplate(null);
        setChosenId(null);
        setTemplateParam(null);
    };

    const handleSubmit = (data: Record<string, string>) => {
        setFormData(data);
        setOpenConfirmDialog(true);
    };

    const handleConfirmSubmit = async () => {
        if (!template) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/submissions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ templateId: template.id, data: formData }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Server error');
            setOpenConfirmDialog(false);
            setSubmitted(true);
            window.scrollTo({ top: 0 });
        } catch (e) {
            console.error('Error adding submission:', e);
            toast.error(s.submitError + ((e as Error).message ?? ''));
        }
    };

    if (loading) {
        return (
            <Container component="main">
                <CircularProgress sx={{ mt: 4 }} />
            </Container>
        );
    }

    if (!chosenId && offered.length > 1) {
        return (
            <Container component="main" maxWidth="sm">
                <OrgLogo orgSlug={orgSlug} />
                <Grid container spacing={0} alignItems="baseline">
                    <Grid size={{ xs: 8 }}>
                        <Typography variant="h5">{s.chooseTitle}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>
                        <LanguageToggle />
                    </Grid>
                </Grid>
                <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                    {s.chooseIntro(orgName)}
                </Typography>
                <Stack spacing={1.5}>
                    {offered.map((t) => (
                        <Button
                            key={t.id}
                            onClick={() => chooseTemplate(t.id)}
                            variant="outlined"
                            fullWidth
                            sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1.5 }}
                        >
                            <Box>
                                <Typography sx={{ fontWeight: 500 }}>{t.name}</Typography>
                                {t.description && (
                                    <Typography variant="body2" color="text.secondary">
                                        {t.description}
                                    </Typography>
                                )}
                            </Box>
                        </Button>
                    ))}
                </Stack>
            </Container>
        );
    }

    if (!template || !schema) {
        return (
            <Container component="main">
                <Typography variant="h5">{s.title(orgName)}</Typography>
                <Typography color="error" sx={{ mt: 2 }}>
                    {s.noTemplate(templateIdOverride)}
                </Typography>
            </Container>
        );
    }

    if (submitted) {
        return (
            <Container component="main" maxWidth="sm">
                <Paper elevation={2} sx={{ p: 4, mt: 6, textAlign: 'center' }}>
                    <Typography variant="h2" component="div" aria-hidden sx={{ mb: 1 }}>✅</Typography>
                    <Typography variant="h5" gutterBottom>{s.receivedTitle}</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                        {s.receivedWhatNext}
                    </Typography>
                    <Typography component="ol" variant="body2" color="text.secondary" sx={{ textAlign: 'left', pl: 3, mb: 3 }}>
                        {s.receivedSteps(orgName).map((step) => <li key={step}>{step}</li>)}
                    </Typography>
                    <Button variant="outlined" onClick={() => { setFormData({}); setSubmitted(false); }}>
                        {s.sendAnother}
                    </Button>
                </Paper>
            </Container>
        );
    }

    return (
        <Container component="main">
            <OrgLogo orgSlug={orgSlug} />
            <Grid container spacing={0} alignItems="baseline">
                <Grid size={{ xs: 8 }}>
                    <Typography variant="h5">{s.title(orgName)}</Typography>
                </Grid>
                <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>
                    <LanguageToggle />
                </Grid>
                <Grid size={{ xs: 7 }}>
                    <Typography>{s.intro(orgName)}</Typography>
                </Grid>
                <Grid size={{ xs: 1 }}>
                    <Button onClick={() => setOpenHelpDialog(true)} color="primary">{s.help}</Button>
                </Grid>
                <Grid size={{ xs: 2 }}>
                    <Link href="/login" passHref>
                        <Button variant="contained" color="primary">{s.adminLogin}</Button>
                    </Link>
                </Grid>
            </Grid>

            {offered.length > 1 && (
                <Button variant="text" size="small" onClick={backToChooser} sx={{ px: 0, mb: 1 }}>
                    ← {s.chooseBack}
                </Button>
            )}

            <SchemaForm
                schema={schema}
                onSubmit={handleSubmit}
                submitLabel={s.submit}
                validation={strings.validation}
            />

            <ConfirmDialog
                open={openConfirmDialog}
                title={s.confirmTitle}
                message={s.confirmMessage}
                onConfirm={handleConfirmSubmit}
                onClose={() => setOpenConfirmDialog(false)}
                details={<SchemaDetails schema={schema} data={formData} />}
                confirmButtonText={s.confirmButton}
                cancelButtonText={strings.common.cancel}
            />

            <ConfirmDialog
                open={openHelpDialog}
                title={s.helpTitle}
                message=""
                onConfirm={() => setOpenHelpDialog(false)}
                details={
                    <>
                        <Typography sx={{ mb: 2 }}>{s.helpBody(orgName)}</Typography>
                        <Link href={withLang('/om')}>{s.helpMore}</Link>
                    </>
                }
                onClose={() => setOpenHelpDialog(false)}
                confirmButtonText={s.helpClose}
                showCancelButton={false}
            />
        </Container>
    );
};

export default OrgSubmissionForm;

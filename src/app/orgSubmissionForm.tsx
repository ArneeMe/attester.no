'use client'
import React, { useEffect, useState } from 'react';
import { Button, CircularProgress, Container, Grid, Paper, Typography } from '@mui/material';
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { getOrgBySlug } from '@/lib/nhost';
import type { FormSchema } from '@/types/formSchema';
import SchemaForm from '@/components/SchemaForm';
import SchemaDetails from '@/components/SchemaDetails';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from "@/util/confirmDialog";
import { getStrings } from '@/strings';
import LanguageToggle from '@/components/LanguageToggle';

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

    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [openHelpDialog, setOpenHelpDialog] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [orgName, setOrgName] = useState<string>(orgSlug);
    const [template, setTemplate] = useState<TemplateForForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const orgPromise = getOrgBySlug(orgSlug).catch(() => null);

                const templateUrl = templateIdOverride
                    ? `/api/org/${encodeURIComponent(orgSlug)}/templates/${encodeURIComponent(templateIdOverride)}`
                    : `/api/org/${encodeURIComponent(orgSlug)}/default-template`;

                const [org, tmplRes] = await Promise.all([orgPromise, fetch(templateUrl)]);

                if (org?.name) setOrgName(org.name);
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
    }, [orgSlug, templateIdOverride]);

    const schema = template?.form_schema ?? null;

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

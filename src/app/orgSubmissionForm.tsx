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

interface Props {
    orgSlug: string;
}

type TemplateForForm = { id: string; name: string; form_schema: FormSchema | null };

const OrgSubmissionForm: React.FC<Props> = ({ orgSlug }) => {
    const searchParams = useSearchParams();
    const templateIdOverride = searchParams.get('t');
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
            toast.error('Feil ved lagring av data: ' + ((e as Error).message ?? 'ukjent feil'));
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
                <Typography variant="h5">Søk om attest til {orgName}</Typography>
                <Typography color="error" sx={{ mt: 2 }}>
                    Ingen mal funnet for denne organisasjonen
                    {templateIdOverride ? ` (id ${templateIdOverride})` : ''}.
                </Typography>
            </Container>
        );
    }

    if (submitted) {
        return (
            <Container component="main" maxWidth="sm">
                <Paper elevation={2} sx={{ p: 4, mt: 6, textAlign: 'center' }}>
                    <Typography variant="h2" component="div" aria-hidden sx={{ mb: 1 }}>✅</Typography>
                    <Typography variant="h5" gutterBottom>Innsendingen er mottatt</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                        Dette skjer videre:
                    </Typography>
                    <Typography component="ol" variant="body2" color="text.secondary" sx={{ textAlign: 'left', pl: 3, mb: 3 }}>
                        <li>{orgName} kontrollerer opplysningene dine.</li>
                        <li>Godkjennes de, lages attesten som PDF med QR-kode, og du får den fra {orgName}.</li>
                        <li>I samme øyeblikk slettes opplysningene dine fra databasen — bare en
                            kryptografisk hash blir igjen, så attesten kan verifiseres.</li>
                    </Typography>
                    <Button variant="outlined" onClick={() => { setFormData({}); setSubmitted(false); }}>
                        Send inn en ny
                    </Button>
                </Paper>
            </Container>
        );
    }

    return (
        <Container component="main">
            <Grid container spacing={0}>
                <Grid size={{ xs: 8 }}>
                    <Typography variant="h5">Søk om attest til {orgName}</Typography>
                </Grid>
                <Grid size={{ xs: 7 }}>
                    <Typography>
                        Her kan du sende inn din informasjon for å få en attest fra {orgName}!
                    </Typography>
                </Grid>
                <Grid size={{ xs: 1 }}>
                    <Button onClick={() => setOpenHelpDialog(true)} color="primary">Hjelp</Button>
                </Grid>
                <Grid size={{ xs: 2 }}>
                    <Link href="/login" passHref>
                        <Button variant="contained" color="primary">Admin innlogging</Button>
                    </Link>
                </Grid>
            </Grid>

            <SchemaForm schema={schema} onSubmit={handleSubmit} submitLabel="Send inn" />

            <ConfirmDialog
                open={openConfirmDialog}
                title="Bekreft innsending"
                message="Er du sikker på at du vil lagre disse dataene?"
                onConfirm={handleConfirmSubmit}
                onClose={() => setOpenConfirmDialog(false)}
                details={<SchemaDetails schema={schema} data={formData} />}
                confirmButtonText="Ja, lagre"
            />

            <ConfirmDialog
                open={openHelpDialog}
                title="Hva er denne nettsiden??"
                message=""
                onConfirm={() => setOpenHelpDialog(false)}
                details={
                    <Typography>
                        Dette er en nettside for å gi deg attest fra {orgName}. Du sender inn din informasjon i en database,
                        en admin vil inspisere det du har sendt inn.
                        Hvis dette ser bra ut vil det bli generert en PDF, og din informasjon vil bli slettet fra
                        databasen. Vi unngår å lagre dataen din lenge.

                        Vi kommer derimot til å lagre hash-verdien til
                        sertifikatet slik at attesten din kan verifiseres.

                        Spørsmål? Send epost til hei@attester.no da vel!
                    </Typography>
                }
                onClose={() => setOpenHelpDialog(false)}
                confirmButtonText="takk for info 😊"
                showCancelButton={false}
            />
        </Container>
    );
};

export default OrgSubmissionForm;

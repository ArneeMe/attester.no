'use client'
export const runtime = 'edge';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { authHeader } from '@/lib/nhost';
import {
    Button, Checkbox, FormControlLabel, Grid, Link, MenuItem, Paper, TextField, Typography
} from '@mui/material';
import { generatePDF, previewPDF, TemplateData } from '@/app/login/adminpage/generatePDF';
import { deleteSubmission } from "@/util/deleteSubmission";
import ConfirmDialog from "@/util/confirmDialog";
import { generateURL } from "@/app/login/adminpage/generateURL";
import { submitHash } from "@/app/login/adminpage/submitHash";
import SchemaDetails from '@/components/SchemaDetails';
import { useToast } from '@/components/ToastProvider';
import type { Submission } from '@/types/submission';
import type { FormSchema } from '@/types/formSchema';
import { hoursUntilDeletion } from '@/util/retention';

type SubmissionRow = {
    id: string;
    organization_id: string;
    template_id: string;
    data: Record<string, string>;
    created_at: string;
};

type FullTemplate = TemplateData & {
    name: string;
    form_schema: FormSchema | null;
    is_default: boolean;
};

const AdminPage: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const toast = useToast();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [templates, setTemplates] = useState<FullTemplate[]>([]);

    const [openDialog, setOpenDialog] = useState(false);
    const [selected, setSelected] = useState<Submission | null>(null);
    const [selectedIDs, setSelectedIDs] = useState<string[]>([]);

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openBatchDeleteDialog, setOpenBatchDeleteDialog] = useState(false);
    const [openPDFDialog, setOpenPDFDialog] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');

    const [searchText, setSearchText] = useState('');
    const [templateFilter, setTemplateFilter] = useState('');
    const [newestFirst, setNewestFirst] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [subRes, tmplRes] = await Promise.all([
                    fetch(`/api/org/${encodeURIComponent(orgSlug)}/submissions`, { headers: authHeader() }),
                    fetch(`/api/org/${encodeURIComponent(orgSlug)}/templates`, { headers: authHeader() }),
                ]);

                if (subRes.ok) {
                    const json = await subRes.json() as { submissions: SubmissionRow[] };
                    setSubmissions((json.submissions ?? []).map((row): Submission => ({
                        id: row.id,
                        organizationId: row.organization_id,
                        templateId: row.template_id,
                        data: row.data,
                        createdAt: new Date(row.created_at),
                    })));
                } else {
                    const json = await subRes.json().catch(() => ({} as { error?: string }));
                    toast.error(`Kunne ikke laste innsendinger: ${json.error ?? `HTTP ${subRes.status}`}`);
                }

                if (tmplRes.ok) {
                    const json = await tmplRes.json() as { templates: FullTemplate[] };
                    setTemplates(json.templates ?? []);
                } else {
                    const json = await tmplRes.json().catch(() => ({} as { error?: string }));
                    toast.error(`Kunne ikke laste maler: ${json.error ?? `HTTP ${tmplRes.status}`}`);
                }
            } catch (error) {
                toast.error(`Kunne ikke laste data: ${(error as Error).message ?? 'nettverksfeil'}`);
            }
        };
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgSlug]);

    const templateById = (id: string) => templates.find((t) => t.id === id) ?? null;

    const handleSelectID = (id: string) => {
        setSelectedIDs((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const handleDelete = async (id: string) => {
        await deleteSubmission(orgSlug, id);
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
    };

    const handleDeleteClick = (sub: Submission) => {
        setSelected(sub);
        setOpenDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selected) return;
        try {
            await handleDelete(selected.id);
            setOpenDeleteDialog(false);
            setSelected(null);
            toast.success('Innsendingen er slettet');
        } catch (error) {
            console.error(error);
            toast.error((error as Error).message ?? 'Feil ved sletting');
        }
    };

    const openBatchDeleteClick = () => setOpenBatchDeleteDialog(true);

    const handleBatchDeleteConfirm = async () => {
        if (selectedIDs.length === 0) return;
        try {
            for (const id of selectedIDs) await handleDelete(id);
            setOpenBatchDeleteDialog(false);
            const n = selectedIDs.length;
            setSelectedIDs([]);
            toast.success(`${n} innsending${n === 1 ? '' : 'er'} slettet`);
        } catch (error) {
            console.error(error);
            toast.error((error as Error).message ?? 'Feil ved sletting');
        }
    };

    const handleClick = (sub: Submission) => {
        setSelected(sub);
        setOpenDialog(true);
    };

    // Submissions whose cert hash is already registered this session. The
    // server deletes the submission row when the cert is inserted, so a
    // PDF-generation retry must NOT call submitHash again (the row is gone
    // and the ownership check would reject it) — but the data is still in
    // memory here, so the PDF itself can be regenerated.
    const issuedIds = useRef(new Set<string>());

    const handleConfirm = async () => {
        if (!selected) return;
        const tmpl = templateById(selected.templateId);
        if (!tmpl) {
            toast.error('Malen finnes ikke lenger. Velg en annen mal eller opprett den på nytt.');
            return;
        }
        if (!issuedIds.current.has(selected.id)) {
            try {
                await submitHash(orgSlug, tmpl.id, selected.id, selected.data);
                issuedIds.current.add(selected.id);
                setSubmissions((prev) => prev.filter((s) => s.id !== selected.id));
            } catch (error) {
                console.error(error);
                toast.error('Feil ved registrering av sertifikat: ' + ((error as Error).message ?? 'ukjent feil'));
                return;
            }
        }
        try {
            await generatePDF(orgSlug, tmpl, selected.id, selected.data);
            setPdfUrl(generateURL(orgSlug, tmpl.id, selected.id, selected.data));
            setOpenPDFDialog(true);
            setOpenDialog(false);
        } catch (error) {
            console.error(error);
            toast.error('Feil ved generering av PDF: ' + ((error as Error).message ?? 'ukjent feil')
                + '. Attesten er registrert og dataene er fortsatt i minnet – trykk «Generer PDF» for å prøve igjen. Ikke last siden på nytt.');
        }
    };

    const handleClose = () => {
        setOpenDialog(false);
        setSelected(null);
    };

    const selectedTemplate = selected ? templateById(selected.templateId) : null;
    const selectedSchema = selectedTemplate?.form_schema ?? null;

    const query = searchText.trim().toLowerCase();
    const visibleSubmissions = submissions
        .filter((s) => !templateFilter || s.templateId === templateFilter)
        .filter((s) => !query
            || Object.values(s.data).some((v) => v.toLowerCase().includes(query)))
        .sort((a, b) => newestFirst
            ? b.createdAt.getTime() - a.createdAt.getTime()
            : a.createdAt.getTime() - b.createdAt.getTime());

    return (
        <>
            <Grid container alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ sm: 10 }}>
                    <Typography variant="h4" gutterBottom>Oversikt</Typography>
                </Grid>
                <Grid size={{ sm: 2 }}>
                    <Button onClick={openBatchDeleteClick} disabled={selectedIDs.length === 0}>
                        Slett valgte
                    </Button>
                </Grid>
            </Grid>

            {submissions.length > 0 && (
                <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <Grid size={{ xs: 12, sm: 5 }}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Søk i innsendinger"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth
                            select
                            size="small"
                            label="Mal"
                            value={templateFilter}
                            onChange={(e) => setTemplateFilter(e.target.value)}
                        >
                            <MenuItem value="">Alle maler</MenuItem>
                            {templates.map((t) => (
                                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <Button size="small" onClick={() => setNewestFirst((v) => !v)}>
                            {newestFirst ? 'Nyeste først ↓' : 'Eldste først ↑'}
                        </Button>
                    </Grid>
                    {visibleSubmissions.length !== submissions.length && (
                        <Grid size={{ xs: 12 }}>
                            <Typography variant="caption" color="text.secondary">
                                Viser {visibleSubmissions.length} av {submissions.length} innsendinger
                            </Typography>
                        </Grid>
                    )}
                </Grid>
            )}

            {submissions.length === 0 && (
                <Paper elevation={1} sx={{ p: 3, mb: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="h6" gutterBottom>Ingen innsendinger enda</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Folk fyller ut skjemaet på <code>/org/{orgSlug}</code>.
                        Når de sender inn, dukker innsendingene opp her klare for godkjenning.
                    </Typography>
                    {templates.length === 0 && (
                        <Typography variant="body2" color="warning.main">
                            Du har ingen PDF-mal enda. Gå til «PDF-mal» og lag en
                            (eller velg en ferdig fra galleriet) før du sender ut
                            skjemalenken.
                        </Typography>
                    )}
                </Paper>
            )}

            <Grid container spacing={2}>
                {visibleSubmissions.map((sub) => {
                    const tmpl = templateById(sub.templateId);
                    const schema = tmpl?.form_schema ?? null;
                    return (
                        <Grid size={{ xs: 12, sm: 6 }} key={sub.id}>
                            <Paper elevation={3} style={{ padding: '20px', marginTop: '10px' }}>
                                <Grid>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={selectedIDs.includes(sub.id)}
                                                onChange={() => handleSelectID(sub.id)}
                                                color="primary"
                                            />
                                        }
                                        label=""
                                    />
                                    {tmpl && (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Mal: {tmpl.name}
                                        </Typography>
                                    )}
                                    <Typography variant="caption" color="warning.main" display="block">
                                        Slettes automatisk om {hoursUntilDeletion(sub.createdAt)} t
                                    </Typography>
                                    {schema ? (
                                        <SchemaDetails schema={schema} data={sub.data} />
                                    ) : (
                                        <Typography variant="body2" color="error">
                                            Skjema ikke funnet for malen.
                                        </Typography>
                                    )}
                                </Grid>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => handleClick(sub)}
                                    disabled={!tmpl}
                                >
                                    <Typography>Generer PDF</Typography>
                                </Button>
                                <Button
                                    onClick={() => handleDeleteClick(sub)}
                                    color="primary"
                                    size="small"
                                >
                                    <Typography color="error">Slett data</Typography>
                                </Button>
                            </Paper>
                        </Grid>
                    );
                })}
            </Grid>

            <ConfirmDialog
                open={openDialog}
                title="Bekreft generering av PDF"
                message="Når du genererer PDF-en, registreres attesten og innsendingen slettes automatisk. Bruk forhåndsvisningen hvis du vil se resultatet først."
                details={selected && selectedSchema ? (
                    <SchemaDetails schema={selectedSchema} data={selected.data} />
                ) : null}
                onConfirm={handleConfirm}
                onClose={handleClose}
                confirmButtonText="Generer PDF"
                secondaryAction={
                    selected && selectedTemplate
                        ? {
                              label: 'Forhåndsvis',
                              onClick: async () => {
                                  try {
                                      await previewPDF(orgSlug, selectedTemplate, selected.id, selected.data);
                                  } catch (e) {
                                      console.error(e);
                                      toast.error('Feil ved forhåndsvisning: ' + ((e as Error).message ?? 'ukjent feil'));
                                  }
                              },
                          }
                        : undefined
                }
            />

            <ConfirmDialog
                open={openDeleteDialog}
                title="Bekreft sletting"
                message="Er du sikker på at du vil slette denne innsendingen?"
                onConfirm={handleDeleteConfirm}
                onClose={() => setOpenDeleteDialog(false)}
                confirmButtonText="Slett"
            />

            <ConfirmDialog
                open={openBatchDeleteDialog}
                title="Bekreft sletting av alle"
                message={`Vil du slette ${selectedIDs.length} valgte innsendinger?`}
                onConfirm={handleBatchDeleteConfirm}
                onClose={() => setOpenBatchDeleteDialog(false)}
                confirmButtonText="Slett"
            />

            <ConfirmDialog
                open={openPDFDialog}
                title="PDF-en er generert"
                message="Innsendingen er slettet automatisk – personinformasjonen er fjernet fra databasen. Sjekk at PDF-en ser riktig ut før du lukker."
                details={<Typography variant="body1">
                    Her er verifiserings-URL-en:{' '}
                    <Link href={pdfUrl} target="_blank" rel="noreferrer">{pdfUrl}</Link>
                </Typography>}
                onConfirm={() => { setOpenPDFDialog(false); setSelected(null); }}
                onClose={() => { setOpenPDFDialog(false); setSelected(null); }}
                confirmButtonText="Lukk"
                showCancelButton={false}
                secondaryAction={{
                    label: 'Kopier lenke',
                    onClick: async () => {
                        try {
                            await navigator.clipboard.writeText(pdfUrl);
                            toast.success('Verifiseringslenken er kopiert');
                        } catch {
                            toast.error('Kunne ikke kopiere – marker lenken manuelt');
                        }
                    },
                }}
            />
        </>
    );
};

export default AdminPage;

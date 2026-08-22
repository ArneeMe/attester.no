'use client'
export const runtime = 'edge';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { authHeader } from '@/lib/nhost';
import {
    Button, Checkbox, Chip, FormControlLabel, Grid, Link, MenuItem, Paper, TextField, Typography
} from '@mui/material';
import { buildAttestPdfBlob, downloadBlob, generatePDF, previewPDF, TemplateData } from '@/app/login/adminpage/generatePDF';
import { deleteSubmission } from "@/util/deleteSubmission";
import ConfirmDialog from "@/util/confirmDialog";
import { generateURL } from "@/app/login/adminpage/generateURL";
import { submitHash } from "@/app/login/adminpage/submitHash";
import SchemaDetails from '@/components/SchemaDetails';
import { useToast } from '@/components/ToastProvider';
import type { Submission } from '@/types/submission';
import type { FormSchema } from '@/types/formSchema';
import { hoursUntilDeletion } from '@/util/retention';
import { useAdminLang } from '@/util/useAdminLang';

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
    const { strings } = useAdminLang();
    const a = strings.admin.dashboard;
    const toast = useToast();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [templates, setTemplates] = useState<FullTemplate[]>([]);

    const [openDialog, setOpenDialog] = useState(false);
    const [selected, setSelected] = useState<Submission | null>(null);
    const [selectedIDs, setSelectedIDs] = useState<string[]>([]);

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openBatchDeleteDialog, setOpenBatchDeleteDialog] = useState(false);
    const [openBatchIssueDialog, setOpenBatchIssueDialog] = useState(false);
    const [batchBusy, setBatchBusy] = useState(false);
    const [openPDFDialog, setOpenPDFDialog] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');

    const [searchText, setSearchText] = useState('');
    const [templateFilter, setTemplateFilter] = useState('');
    const [newestFirst, setNewestFirst] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [subRes, tmplRes, certRes] = await Promise.all([
                    fetch(`/api/org/${encodeURIComponent(orgSlug)}/submissions`, { headers: authHeader() }),
                    fetch(`/api/org/${encodeURIComponent(orgSlug)}/templates`, { headers: authHeader() }),
                    fetch(`/api/org/${encodeURIComponent(orgSlug)}/certificates`, { headers: authHeader() }),
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
                    toast.error(`${a.loadSubmissionsError}: ${json.error ?? `HTTP ${subRes.status}`}`);
                }

                if (tmplRes.ok) {
                    const json = await tmplRes.json() as { templates: FullTemplate[] };
                    setTemplates(json.templates ?? []);
                } else {
                    const json = await tmplRes.json().catch(() => ({} as { error?: string }));
                    toast.error(`${a.loadTemplatesError}: ${json.error ?? `HTTP ${tmplRes.status}`}`);
                }

                // Seed which still-present submissions already have a cert,
                // so a page reload keeps showing the "Utstedt" chip — a
                // submission and its certificate now coexist until the
                // retention sweep removes the submission.
                if (certRes.ok) {
                    const json = await certRes.json() as { certificates: Array<{ submissionId: string }> };
                    setIssuedIds(new Set((json.certificates ?? []).map((c) => c.submissionId)));
                }
            } catch (error) {
                toast.error(`${a.loadError}: ${(error as Error).message ?? ''}`);
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
            toast.success(a.deleted);
        } catch (error) {
            console.error(error);
            toast.error((error as Error).message ?? a.deleteError);
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
            toast.success(a.batchDeleted(n));
        } catch (error) {
            console.error(error);
            toast.error((error as Error).message ?? a.deleteError);
        }
    };

    const handleClick = (sub: Submission) => {
        setSelected(sub);
        setOpenDialog(true);
    };

    // Submissions with an issued certificate. Issuing does NOT delete the
    // submission (see CLAUDE.md "Volunteer deletion") — a submission stays
    // visible, marked "Utstedt", until the retention sweep removes it. The
    // certificates POST route is idempotent per submission, so re-running
    // "Generer PDF" for an already-issued one (retry after a failed render,
    // or a deliberate regenerate) is always safe.
    const [issuedIds, setIssuedIds] = useState<Set<string>>(new Set());

    const handleConfirm = async () => {
        if (!selected) return;
        const tmpl = templateById(selected.templateId);
        if (!tmpl) {
            toast.error(a.templateGone);
            return;
        }
        try {
            await submitHash(orgSlug, tmpl.id, selected.id, selected.data);
            setIssuedIds((prev) => new Set(prev).add(selected.id));
        } catch (error) {
            console.error(error);
            toast.error(a.registerError + ((error as Error).message ?? a.unknownError));
            return;
        }
        try {
            await generatePDF(orgSlug, tmpl, selected.id, selected.data);
            setPdfUrl(generateURL(orgSlug, tmpl.id, selected.id, selected.data));
            setOpenPDFDialog(true);
            setOpenDialog(false);
        } catch (error) {
            console.error(error);
            toast.error(a.pdfError + ((error as Error).message ?? a.unknownError) + a.pdfRetryHint);
        }
    };

    const handleClose = () => {
        setOpenDialog(false);
        setSelected(null);
    };

    // Batch issue: for each selected submission, register the cert (which
    // deletes the row server-side) and collect the PDF into one ZIP. A
    // failure on one item never blocks the others.
    const handleBatchIssueConfirm = async () => {
        if (batchBusy) return;
        setBatchBusy(true);
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const failures: string[] = [];
        const newlyIssued: string[] = [];
        let issued = 0;
        for (const id of selectedIDs) {
            const sub = submissions.find((s) => s.id === id);
            if (!sub) continue;
            const tmpl = templateById(sub.templateId);
            const label = sub.data.name || id.slice(0, 8);
            if (!tmpl) {
                failures.push(`${label}: ${a.templateMissingShort}`);
                continue;
            }
            try {
                await submitHash(orgSlug, tmpl.id, sub.id, sub.data);
                newlyIssued.push(sub.id);
                const { blob, filename } = await buildAttestPdfBlob(orgSlug, tmpl, sub.id, sub.data);
                const unique = zip.files[filename] ? `${id.slice(0, 8)}_${filename}` : filename;
                zip.file(unique, blob);
                issued++;
            } catch (e) {
                console.error(e);
                failures.push(`${label}: ${(e as Error).message ?? a.unknownError}`);
            }
        }
        if (issued > 0) {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(zipBlob, 'attester.zip');
            setIssuedIds((prev) => {
                const next = new Set(prev);
                newlyIssued.forEach((id) => next.add(id));
                return next;
            });
            toast.success(a.batchDone(issued));
        }
        for (const f of failures) toast.error(f);
        setSelectedIDs([]);
        setOpenBatchIssueDialog(false);
        setBatchBusy(false);
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
                    <Typography variant="h4" gutterBottom>{a.title}</Typography>
                </Grid>
                <Grid size={{ sm: 2 }}>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={() => setOpenBatchIssueDialog(true)}
                        disabled={selectedIDs.length === 0 || batchBusy}
                        sx={{ mr: 1 }}
                    >
                        {a.batchIssue}
                    </Button>
                    <Button size="small" onClick={openBatchDeleteClick} disabled={selectedIDs.length === 0 || batchBusy}>
                        {a.batchDelete}
                    </Button>
                </Grid>
            </Grid>

            {submissions.length > 0 && (
                <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <Grid size={{ xs: 12, sm: 5 }}>
                        <TextField
                            fullWidth
                            size="small"
                            label={a.search}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth
                            select
                            size="small"
                            label={a.template}
                            value={templateFilter}
                            onChange={(e) => setTemplateFilter(e.target.value)}
                        >
                            <MenuItem value="">{a.allTemplates}</MenuItem>
                            {templates.map((t) => (
                                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <Button size="small" onClick={() => setNewestFirst((v) => !v)}>
                            {newestFirst ? a.newestFirst : a.oldestFirst}
                        </Button>
                    </Grid>
                    {visibleSubmissions.length !== submissions.length && (
                        <Grid size={{ xs: 12 }}>
                            <Typography variant="caption" color="text.secondary">
                                {a.showing(visibleSubmissions.length, submissions.length)}
                            </Typography>
                        </Grid>
                    )}
                </Grid>
            )}

            {submissions.length === 0 && (
                <Paper elevation={1} sx={{ p: 3, mb: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="h6" gutterBottom>{a.emptyTitle}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {a.emptyBody(orgSlug)}
                    </Typography>
                    {templates.length === 0 && (
                        <Typography variant="body2" color="warning.main">
                            {a.noTemplateWarn}
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
                                    {issuedIds.has(sub.id) && (
                                        <Chip label="Utstedt" color="success" size="small" sx={{ mb: 0.5 }} />
                                    )}
                                    {tmpl && (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            {a.templateCaption(tmpl.name)}
                                        </Typography>
                                    )}
                                    <Typography variant="caption" color="warning.main" display="block">
                                        {a.deletesIn(hoursUntilDeletion(sub.createdAt))}
                                    </Typography>
                                    {schema ? (
                                        <SchemaDetails schema={schema} data={sub.data} />
                                    ) : (
                                        <Typography variant="body2" color="error">
                                            {a.schemaMissing}
                                        </Typography>
                                    )}
                                </Grid>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => handleClick(sub)}
                                    disabled={!tmpl}
                                >
                                    <Typography>{a.generate}</Typography>
                                </Button>
                                <Button
                                    onClick={() => handleDeleteClick(sub)}
                                    color="primary"
                                    size="small"
                                >
                                    <Typography color="error">{a.deleteData}</Typography>
                                </Button>
                            </Paper>
                        </Grid>
                    );
                })}
            </Grid>

            <ConfirmDialog
                open={openDialog}
                title={a.confirmGenTitle}
                message={a.confirmGenMsg}
                details={selected && selectedSchema ? (
                    <SchemaDetails schema={selectedSchema} data={selected.data} />
                ) : null}
                onConfirm={handleConfirm}
                onClose={handleClose}
                confirmButtonText={a.generate}
                secondaryAction={
                    selected && selectedTemplate
                        ? {
                              label: a.preview,
                              onClick: async () => {
                                  try {
                                      await previewPDF(orgSlug, selectedTemplate, selected.id, selected.data);
                                  } catch (e) {
                                      console.error(e);
                                      toast.error(a.previewError + ((e as Error).message ?? a.unknownError));
                                  }
                              },
                          }
                        : undefined
                }
            />

            <ConfirmDialog
                open={openDeleteDialog}
                title={a.confirmDeleteTitle}
                message={a.confirmDeleteMsg}
                onConfirm={handleDeleteConfirm}
                onClose={() => setOpenDeleteDialog(false)}
                confirmButtonText={a.deleteButton}
            />

            <ConfirmDialog
                open={openBatchIssueDialog}
                title={a.batchTitle}
                message={a.batchMsg(selectedIDs.length)}
                onConfirm={handleBatchIssueConfirm}
                onClose={() => { if (!batchBusy) setOpenBatchIssueDialog(false); }}
                confirmButtonText={batchBusy ? a.batchBusy : a.batchButton}
            />

            <ConfirmDialog
                open={openBatchDeleteDialog}
                title={a.confirmBatchDeleteTitle}
                message={a.confirmBatchDeleteMsg(selectedIDs.length)}
                onConfirm={handleBatchDeleteConfirm}
                onClose={() => setOpenBatchDeleteDialog(false)}
                confirmButtonText={a.deleteButton}
            />

            <ConfirmDialog
                open={openPDFDialog}
                title={a.pdfDoneTitle}
                message={a.pdfDoneMsg}
                details={<Typography variant="body1">
                    {a.verifyUrlLabel}{' '}
                    <Link href={pdfUrl} target="_blank" rel="noreferrer">{pdfUrl}</Link>
                </Typography>}
                onConfirm={() => { setOpenPDFDialog(false); setSelected(null); }}
                onClose={() => { setOpenPDFDialog(false); setSelected(null); }}
                confirmButtonText={a.close}
                showCancelButton={false}
                secondaryAction={{
                    label: a.copyLink,
                    onClick: async () => {
                        try {
                            await navigator.clipboard.writeText(pdfUrl);
                            toast.success(a.linkCopied);
                        } catch {
                            toast.error(a.copyFailed);
                        }
                    },
                }}
            />
        </>
    );
};

export default AdminPage;

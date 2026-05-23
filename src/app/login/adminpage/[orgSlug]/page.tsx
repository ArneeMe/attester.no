'use client'
export const runtime = 'edge';

import React, {useEffect, useState} from 'react';
import { useParams } from 'next/navigation';
import { authHeader } from '@/lib/nhost';
import {
    Button, Checkbox, FormControlLabel, Grid, Link, MenuItem,
    Paper, Select, SelectChangeEvent, Typography
} from '@mui/material';
import {Volunteer} from '@/util/Volunteer'
import {generatePDF, TemplateData} from '@/app/login/adminpage/generatePDF'
import {deleteVolunteer} from "@/util/deleteVolunteer";
import ConfirmDialog from "@/util/confirmDialog";
import {generateURL} from "@/app/login/adminpage/generateURL";
import {submitHash} from "@/app/login/adminpage/submitHash";
import {formatVolunteerDetails} from "@/util/formatVolunteer";


const AdminPage: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
    const [templates, setTemplates] = useState<TemplateData[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

    const [openDialog, setOpenDialog] = useState(false);
    const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
    const [selectedIDs, setSelectedIDs] = useState<string[]>([]);

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openBatchDeleteDialog, setOpenBatchDeleteDialog] = useState(false);
    const [openPDFDialog, setOpenPDFDialog] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [volRes, tmplRes] = await Promise.all([
                    fetch(`/api/org/${encodeURIComponent(orgSlug)}/volunteers`, { headers: authHeader() }),
                    fetch(`/api/org/${encodeURIComponent(orgSlug)}/templates`, { headers: authHeader() }),
                ]);

                if (volRes.ok) {
                    const json = await volRes.json() as {
                        volunteers: Array<{
                            id: string; person_name: string; group_name: string;
                            start_date: string; end_date: string; role: string;
                            extra_roles: Volunteer['extraRole'];
                        }>;
                    };
                    setVolunteers((json.volunteers ?? []).map((v) => ({
                        id: v.id,
                        personName: v.person_name,
                        groupName: v.group_name,
                        startDate: v.start_date,
                        endDate: v.end_date,
                        role: v.role,
                        extraRole: v.extra_roles ?? [],
                    })));
                }

                if (tmplRes.ok) {
                    const json = await tmplRes.json() as { templates: TemplateData[] };
                    const tmplList = json.templates ?? [];
                    setTemplates(tmplList);
                    const def = tmplList.find((t) => (t as TemplateData & { is_default: boolean }).is_default);
                    setSelectedTemplateId((def ?? tmplList[tmplList.length - 1])?.id ?? '');
                }
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        };
        fetchData();
    }, [orgSlug]);

    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

    const handleSelectID = (id: string) => {
        if (selectedIDs.includes(id)) {
            setSelectedIDs(selectedIDs.filter(volId => volId !== id));
        } else {
            setSelectedIDs([...selectedIDs, id]);
        }
    };

    const handleDelete = async (id: string) => {
        await deleteVolunteer(orgSlug, id);
        setVolunteers(volunteers.filter(volunteer => volunteer.id !== id));
    }

    const handleDeleteClick = (volunteer: Volunteer) => {
        setSelectedVolunteer(volunteer);
        setOpenDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (selectedVolunteer) {
            try {
                await handleDelete(selectedVolunteer.id);
                setOpenDeleteDialog(false);
                setSelectedVolunteer(null);
            } catch (error) {
                console.log(error);
                alert('Feil ved sletting av data');
            }
        }
    };

    const openBatchDeleteClick = () => setOpenBatchDeleteDialog(true);

    const handleBatchDeleteConfirm = async () => {
        if (selectedIDs.length > 0) {
            try {
                for (const id of selectedIDs) {
                    await handleDelete(id);
                }
                setOpenBatchDeleteDialog(false);
                setSelectedIDs([]);
            } catch (error) {
                console.log(error);
                alert('Feil ved sletting av data');
            }
        }
    };

    const handleClick = (volunteer: Volunteer) => {
        setSelectedVolunteer(volunteer);
        setOpenDialog(true);
    };

    const handleConfirm = async () => {
        if (selectedVolunteer && selectedTemplate) {
            try {
                await submitHash(orgSlug, selectedTemplate.id, selectedVolunteer);
                await generatePDF(orgSlug, selectedTemplate, selectedVolunteer);
                setPdfUrl(generateURL(orgSlug, selectedTemplate.id, selectedVolunteer));
                setOpenPDFDialog(true);
                setOpenDialog(false);
            } catch (error) {
                console.log(error);
                alert('Feil ved generering av PDF');
            }
        }
    };

    const handleClose = () => {
        setOpenDialog(false);
        setSelectedVolunteer(null);
    };

    return (
        <>
            <Grid container alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ sm: 6 }}>
                    <Typography variant="h4" gutterBottom>
                        Oversikt
                    </Typography>
                </Grid>
                <Grid size={{ sm: 4 }}>
                    {templates.length > 0 ? (
                        <Select
                            size="small"
                            value={selectedTemplateId}
                            onChange={(e: SelectChangeEvent) => setSelectedTemplateId(e.target.value)}
                            fullWidth
                            displayEmpty
                        >
                            {templates.map((t) => (
                                <MenuItem key={t.id} value={t.id}>
                                    {(t as TemplateData & { name: string }).name}
                                    {(t as TemplateData & { is_default: boolean }).is_default ? ' (standard)' : ''}
                                </MenuItem>
                            ))}
                        </Select>
                    ) : (
                        <Typography variant="body2" color="error">
                            Ingen maler funnet — opprett en mal først
                        </Typography>
                    )}
                </Grid>
                <Grid size={{ sm: 2 }}>
                    <Button onClick={openBatchDeleteClick}>
                        Slett valgte
                    </Button>
                </Grid>
            </Grid>
            <Grid container spacing={2}>
                {volunteers.map((volunteer: Volunteer) => (
                    <Grid size={{xs:12, sm:6}} key={volunteer.id}>
                        <Paper elevation={3} style={{ padding: '20px', marginTop: '10px' }}>
                            <Grid>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={selectedIDs.includes(volunteer.id)}
                                            onChange={() => handleSelectID(volunteer.id)}
                                            color="primary"
                                        />
                                    }
                                    label=""
                                />
                                {formatVolunteerDetails(volunteer)}
                            </Grid>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => handleClick(volunteer)}
                                disabled={!selectedTemplate}
                            >
                                <Typography>
                                    Generer PDF
                                </Typography>
                            </Button>
                            <Button
                                onClick={() => handleDeleteClick(volunteer)}
                                color="primary"
                                size="small"
                            >
                                <Typography color={"error"}>
                                    Slett data
                                </Typography>
                            </Button>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            <ConfirmDialog
                open={openDialog}
                title="Bekreft generering av PDF"
                message={`Er du sikker på at du vil generere PDF for ${selectedVolunteer?.personName}?`}
                details={selectedVolunteer && formatVolunteerDetails(selectedVolunteer)}
                onConfirm={handleConfirm}
                onClose={handleClose}
                confirmButtonText="Generer PDF"
            />

            <ConfirmDialog
                open={openDeleteDialog}
                title="Bekreft sletting"
                message={`Er du sikker på at du vil slette denne PDF-en til ${selectedVolunteer?.personName}`}
                onConfirm={handleDeleteConfirm}
                onClose={() => setOpenDeleteDialog(false)}
                confirmButtonText="Slett"
            />
            <ConfirmDialog
                open={openBatchDeleteDialog}
                title="Bekreft sletting av alle"
                message={`Vil du slette ${selectedIDs.length} valgte PDF-er?`}
                onConfirm={handleBatchDeleteConfirm}
                onClose={() => setOpenBatchDeleteDialog(false)}
                confirmButtonText="Slett"
            />

            <ConfirmDialog
                open={openPDFDialog}
                title="PDF-en er Generert"
                message="Husk å les over og sørg for at alt er riktig, så slett brukeren fra databasen."
                details={<Typography variant="body1">
                    Her er verifiserings URL-en:
                    <Link href={pdfUrl} target="_blank" rel="">
                        {pdfUrl}
                    </Link>
                </Typography>}
                onConfirm={() => setOpenPDFDialog(false)}
                onClose={() => setOpenPDFDialog(false)}
                confirmButtonText="OK"
                showCancelButton={false}
            />
        </>
    );
};

export default AdminPage;

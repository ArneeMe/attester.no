'use client'
import React, { useEffect, useState } from 'react';
import {
    Button,
    Container,
    FormHelperText,
    Grid,
    MenuItem,
    Select,
    SelectChangeEvent,
    TextField,
    Typography,
    CircularProgress,
} from '@mui/material';
import { getOrgBySlug } from '@/lib/nhost';
import Link from "next/link";
import { v4 as uuidv4 } from 'uuid';
import { Volunteer } from "@/util/Volunteer";
import ConfirmDialog from "@/util/confirmDialog";
import { formatVolunteerDetails } from "@/util/formatVolunteer";
import { getGroupInfo } from "@/util/databaseInteractions/fetchInfo";

interface Props {
    orgSlug: string;
}

const VolunteerForm: React.FC<Props> = ({ orgSlug }) => {
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [openSummaryDialog, setOpenSummaryDialog] = useState(false);
    const [openHelpDialog, setOpenHelpDialog] = useState(false);
    const [showExtraRoles, setShowExtraRoles] = useState(false);

    const [orgName, setOrgName] = useState<string>(orgSlug);
    const [groups, setGroups] = useState<{ [key: string]: string }>({});
    const [loadingGroups, setLoadingGroups] = useState(true);

    const [formData, setformData] = useState<Volunteer>({
        id: '',
        personName: '',
        groupName: '',
        startDate: '',
        endDate: '',
        role: '',
        extraRole: [
            { groupName: '', startDate: '', endDate: '', role: '' },
            { groupName: '', startDate: '', endDate: '', role: '' },
            { groupName: '', startDate: '', endDate: '', role: '' },
        ],
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoadingGroups(true);
            try {
                const [groupData, org] = await Promise.all([
                    getGroupInfo(orgSlug),
                    getOrgBySlug(orgSlug).catch(() => null),
                ]);
                setGroups(groupData);
                if (org?.name) setOrgName(org.name);
            } catch (error) {
                console.error('Error fetching org data:', error);
                setGroups({});
            }
            setLoadingGroups(false);
        };
        fetchData();
    }, [orgSlug]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setformData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSelectChange = (event: SelectChangeEvent<string>) => {
        const { name, value } = event.target;
        setformData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleIndexChange = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const { name, value } = event.target;
        setformData(prevState => {
            const updatedRoles = [...(prevState.extraRole || [])];
            updatedRoles[index] = { ...updatedRoles[index], [name]: value };
            return { ...prevState, extraRole: updatedRoles };
        });
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setOpenConfirmDialog(true);
    };

    const handleCloseSummary = () => {
        setOpenSummaryDialog(false);
    };

    const handleHelpSummary = () => {
        setOpenHelpDialog(false);
    };

    const handleConfirmSubmit = async () => {
        const uuid = uuidv4();
        try {
            const { id: organizationId } = await getOrgBySlug(orgSlug);
            const res = await fetch("/api/volunteers", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    id: uuid,
                    organizationId,
                    personName: formData.personName,
                    groupName: formData.groupName,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    role: formData.role,
                    extraRoles: formData.extraRole ?? [],
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Server error");
            setformData(prev => ({ ...prev, id: uuid }));
            setOpenConfirmDialog(false);
            setOpenSummaryDialog(true);
        } catch (error) {
            console.error('Error adding document:', error);
            alert('Feil ved lagring av data.');
        }
    };

    return (
        <Container component="main">
            <Grid container spacing={0}>
                <Grid size={{ xs: 8 }}>
                    <Typography variant="h5">
                        Søk om attest til {orgName}
                    </Typography>
                </Grid>
                <Grid size={{ xs: 7 }}>
                    <Typography>
                        Her kan du sende inn din informasjon for å få en attest fra {orgName}!
                    </Typography>
                </Grid>
                <Grid size={{ xs: 1 }}>
                    <Button onClick={() => setOpenHelpDialog(true)} color="primary">
                        Hjelp
                    </Button>
                </Grid>
                <Grid size={{ xs: 2 }}>
                    <Link href="/login" passHref>
                        <Button variant="contained" color="primary">
                            Admin innlogging
                        </Button>
                    </Link>
                </Grid>
            </Grid>
            <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 10 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Fulle navn"
                            name="personName"
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, md: 5 }}>
                        {loadingGroups ? (
                            <CircularProgress size={24} sx={{ mt: 3 }} />
                        ) : (
                            <Select
                                required
                                fullWidth
                                label="Gruppe"
                                name="groupName"
                                value={formData.groupName}
                                onChange={handleSelectChange}
                                sx={{ marginTop: '16px' }}
                            >
                                {Object.keys(groups).map((key) => (
                                    <MenuItem key={key} value={key}>
                                        {key}
                                    </MenuItem>
                                ))}
                            </Select>
                        )}
                        <FormHelperText>
                            Velg UGP eller HS
                        </FormHelperText>
                    </Grid>
                    <Grid size={{ xs: 6, md: 5 }}>
                        <TextField
                            required
                            margin="normal"
                            fullWidth
                            label="Rolle/Stilling"
                            name="role"
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, md: 5 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Når startet du?"
                            name="startDate"
                            type="date"
                            slotProps={{ inputLabel: { shrink: true } }}
                            onChange={handleChange}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, md: 5 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Når sluttet du?"
                            name="endDate"
                            type="date"
                            slotProps={{ inputLabel: { shrink: true } }}
                            onChange={handleChange}
                        />
                    </Grid>

                    <Grid size={{ xs: 6, md: 5 }}>
                        <Button
                            type="button"
                            onClick={() => setShowExtraRoles(prev => !prev)}
                            style={{ marginTop: '16px' }}
                        >
                            {showExtraRoles ? 'Skjul andre roller' : 'Legg til andre roller'}
                        </Button>
                    </Grid>
                    {showExtraRoles && (formData.extraRole || []).map((role, index) => (
                        <Grid container spacing={2} key={index}>
                            <Grid size={{ xs: 12 }}>
                                <Typography variant={"h6"}>Ekstra rolle {index + 1}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, md: 5 }}>
                                <TextField
                                    margin="normal"
                                    fullWidth
                                    label={"Hvilken UGP / Interessegruppe / Komite?"}
                                    name={"groupName"}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleIndexChange(e, index)}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, md: 5 }}>
                                <TextField
                                    margin="normal"
                                    fullWidth
                                    label="Rolle/Stilling"
                                    name={"role"}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleIndexChange(e, index)}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, md: 5 }}>
                                <TextField
                                    margin="normal"
                                    fullWidth
                                    label="Når startet du?"
                                    name="startDate"
                                    type="date"
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleIndexChange(e, index)}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, md: 5 }}>
                                <TextField
                                    margin="normal"
                                    fullWidth
                                    label="Når sluttet du?"
                                    name="endDate"
                                    type="date"
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleIndexChange(e, index)}
                                />
                            </Grid>
                        </Grid>
                    ))}
                    <Grid size={{ xs: 6, md: 5 }}>
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                        >
                            Send inn PDF
                        </Button>
                    </Grid>
                </Grid>
            </form>

            <ConfirmDialog
                open={openConfirmDialog}
                title="Bekreft innsending"
                message="Er du sikker på at du vil lagre disse dataene?"
                onConfirm={handleConfirmSubmit}
                onClose={() => setOpenConfirmDialog(false)}
                details={formatVolunteerDetails(formData)}
                confirmButtonText="Ja, lagre"
            />

            <ConfirmDialog
                open={openSummaryDialog}
                title="PDF sendt inn"
                message="Denne PDF-en ble sendt inn:"
                onConfirm={handleCloseSummary}
                details={formatVolunteerDetails(formData)}
                onClose={handleCloseSummary}
                confirmButtonText="OK"
                showCancelButton={false}
            />
            <ConfirmDialog
                open={openHelpDialog}
                title="Hva er denne nettsiden??"
                message=""
                onConfirm={handleHelpSummary}
                details={
                    <Typography>
                        Dette er en nettside for å gi deg attest fra {orgName}. Du sender inn din informasjon i en database,
                        en admin vil inspisere det du har sendt inn.
                        Fyll ut info om deg, dine roller. Du kan velge inntil 3 ekstra roller.
                        Bruk din &quot;hovedrolle&quot; først, den blir mest synlig på PDF-en.
                        Hvis dette ser bra ut vil det bli generert en PDF, og din informasjon vil bli slettet fra
                        databasen. Vi unngår å lagre dataen din lenge.

                        Vi kommer derimot til å lagre hash-verdien til
                        sertifikatet slik at attesten din kan verifiseres.

                        Spørsmål? Send epost til hei@attester.no da vel!
                    </Typography>
                }
                onClose={handleHelpSummary}
                confirmButtonText="takk for info 😊"
                showCancelButton={false}
            />
        </Container>
    );
};

export default VolunteerForm;
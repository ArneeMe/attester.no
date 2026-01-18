'use client'
import React, { useEffect, useState } from 'react';
import {
    Button,
    TextField,
    Typography,
    Paper,
    Grid,
    Tabs,
    Tab,
    Box,
    IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {SignatureInfo} from "@/types/pdfTypes";
import {
    fallbackValues,
    getGroupInfo,
    getOrganizationInfo,
    getSignatureInfo
} from "@/util/databaseInteractions/fetchInfo";
import {updateGroupInfo, updateOrganizationInfo, updateSignatureInfo} from "@/util/databaseInteractions/insertData";
import ImageUpload from "@/app/login/adminpage/rediger/ImageUpload";

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
    return (
        <div hidden={value !== index}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const RedigerPage: React.FC = () => {
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Organization state
    const [genericText, setGenericText] = useState('');

    // Signatures state
    const [signatures, setSignatures] = useState<SignatureInfo[]>([]);

    // Groups state
    const [groups, setGroups] = useState<{ [key: string]: string }>({});
    const [newGroupName, setNewGroupName] = useState('');

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Use existing fetch functions
            const [orgData, sigData, groupData] = await Promise.all([
                getOrganizationInfo(),
                getSignatureInfo(),
                getGroupInfo(),
            ]);

            setGenericText(orgData.generic_text || fallbackValues.organization.generic_text);
            setSignatures(sigData.length > 0 ? sigData : fallbackValues.signatures);
            setGroups(Object.keys(groupData).length > 0 ? groupData : fallbackValues.groups);
        } catch (error) {
            console.error('Error fetching data:', error);
            // Use fallback values on error
            setGenericText(fallbackValues.organization.generic_text);
            setSignatures(fallbackValues.signatures);
            setGroups(fallbackValues.groups);
        }
        setLoading(false);
    };

    const saveOrganizationInfo = async () => {
        setSaving(true);
        try {
            await updateOrganizationInfo({ generic_text: genericText });
            alert('Organisasjonsinfo lagret!');
        } catch (error) {
            console.error('Error saving:', error);
            alert('Feil ved lagring');
        }
        setSaving(false);
    };

    const saveSignatures = async () => {
        setSaving(true);
        try {
            await updateSignatureInfo(signatures);
            alert('Signaturer lagret!');
        } catch (error) {
            console.error('Error saving:', error);
            alert('Feil ved lagring');
        }
        setSaving(false);
    };

    const saveGroups = async () => {
        setSaving(true);
        try {
            await updateGroupInfo(groups);
            alert('Grupper lagret!');
        } catch (error) {
            console.error('Error saving:', error);
            alert('Feil ved lagring');
        }
        setSaving(false);
    };

    const updateSignature = (index: number, field: keyof SignatureInfo, value: string) => {
        const updated = [...signatures];
        updated[index] = { ...updated[index], [field]: value };
        setSignatures(updated);
    };

    const addSignature = () => {
        setSignatures([...signatures, { name: '', role: '', phone: '', photo: '' }]);
    };

    const removeSignature = (index: number) => {
        setSignatures(signatures.filter((_, i) => i !== index));
    };

    const updateGroup = (key: string, value: string) => {
        setGroups({ ...groups, [key]: value });
    };

    const addGroup = () => {
        if (newGroupName && !groups[newGroupName]) {
            setGroups({ ...groups, [newGroupName]: '' });
            setNewGroupName('');
        }
    };

    const removeGroup = (key: string) => {
        const updated = { ...groups };
        delete updated[key];
        setGroups(updated);
    };

    if (loading) {
        return <Typography>Laster...</Typography>;
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Rediger innhold
            </Typography>

            <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)}>
                <Tab label="Organisasjon" />
                <Tab label="Signaturer" />
                <Tab label="Grupper" />
            </Tabs>

            {/* Organization Tab */}
            <TabPanel value={tab} index={0}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Generell organisasjonstekst
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={10}
                        value={genericText}
                        onChange={(e) => setGenericText(e.target.value)}
                        placeholder="Tekst som vises på PDF-er..."
                    />
                    <Button
                        variant="contained"
                        onClick={saveOrganizationInfo}
                        disabled={saving}
                        sx={{ mt: 2 }}
                    >
                        Lagre
                    </Button>
                </Paper>
            </TabPanel>

            {/* Signatures Tab */}
            <TabPanel value={tab} index={1}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Signaturer
                    </Typography>
                    {signatures.map((sig, index) => (
                        <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid size={{ xs: 12 }}>
                                    <Typography variant="subtitle1">
                                        Signatur {index + 1}
                                        <IconButton
                                            onClick={() => removeSignature(index)}
                                            color="error"
                                            size="small"
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Typography>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Navn"
                                        value={sig.name}
                                        onChange={(e) => updateSignature(index, 'name', e.target.value)}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Rolle"
                                        value={sig.role}
                                        onChange={(e) => updateSignature(index, 'role', e.target.value)}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Telefon"
                                        value={sig.phone}
                                        onChange={(e) => updateSignature(index, 'phone', e.target.value)}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <ImageUpload
                                        label="Signaturbilde"
                                        value={sig.photo}
                                        onChange={(base64) => updateSignature(index, 'photo', base64)}
                                        maxSizeKB={500}
                                    />
                                </Grid>
                            </Grid>
                        </Paper>
                    ))}
                    <Button startIcon={<AddIcon />} onClick={addSignature} sx={{ mr: 2 }}>
                        Legg til signatur
                    </Button>
                    <Button variant="contained" onClick={saveSignatures} disabled={saving}>
                        Lagre signaturer
                    </Button>
                </Paper>
            </TabPanel>

            {/* Groups Tab */}
            <TabPanel value={tab} index={2}>
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Gruppebeskrivelser
                    </Typography>
                    {Object.entries(groups).map(([key, value]) => (
                        <Paper key={key} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid size={{ xs: 11 }}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        {key}
                                    </Typography>
                                </Grid>
                                <Grid size={{ xs: 1 }}>
                                    <IconButton onClick={() => removeGroup(key)} color="error" size="small">
                                        <DeleteIcon />
                                    </IconButton>
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={3}
                                        value={value}
                                        onChange={(e) => updateGroup(key, e.target.value)}
                                        placeholder="Beskrivelse av gruppen..."
                                    />
                                </Grid>
                            </Grid>
                        </Paper>
                    ))}
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                        <Grid size={{ xs: 8 }}>
                            <TextField
                                fullWidth
                                label="Nytt gruppenavn"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                            />
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                            <Button
                                startIcon={<AddIcon />}
                                onClick={addGroup}
                                disabled={!newGroupName}
                                fullWidth
                                sx={{ height: '100%' }}
                            >
                                Legg til
                            </Button>
                        </Grid>
                    </Grid>
                    <Button
                        variant="contained"
                        onClick={saveGroups}
                        disabled={saving}
                        sx={{ mt: 2 }}
                    >
                        Lagre grupper
                    </Button>
                </Paper>
            </TabPanel>
        </Box>
    );
};

export default RedigerPage;
'use client';
export const runtime = 'edge';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
    Box,
    Container,
    Paper,
    TextField,
    Typography,
    Alert,
    CircularProgress,
    Snackbar,
    FormControlLabel,
    Switch,
} from '@mui/material';
import dynamic from 'next/dynamic';

const DesignerComponent = dynamic(() => import('./DesignerComponent'), {
    ssr: false,
    loading: () => (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
        </Box>
    ),
});

export default function TemplateEditorPage() {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>
                PDF Mal Editor
            </Typography>

            <Typography variant="body1" color="text.secondary">
                Last opp en PDF og definer feltene som skal fylles inn.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Mal-informasjon
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField
                        label="Navn på mal"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        required
                        sx={{ minWidth: 250 }}
                    />

                    <TextField
                        label="Beskrivelse (valgfritt)"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        sx={{ minWidth: 300, flexGrow: 1 }}
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={isDefault}
                                onChange={(e) => setIsDefault(e.target.checked)}
                            />
                        }
                        label="Standard mal"
                    />
                </Box>
            </Paper>

            <DesignerComponent
                orgSlug={orgSlug}
                templateName={templateName}
                templateDescription={templateDescription}
                isDefault={isDefault}
                onError={setError}
                onSuccess={setSuccessMessage}
                onTemplateLoad={(name, desc, def) => {
                    setTemplateName(name);
                    setTemplateDescription(desc);
                    setIsDefault(def);
                }}
            />

            <Paper sx={{ p: 2, mt: 2, bgcolor: 'info.light' }}>
                <Typography variant="subtitle2" gutterBottom>
                    Slik kobler du PDF-felter til data:
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                    Gi PDF-feltet samme navn som et skjemafelt (f.eks. <code>name</code>,{' '}
                    <code>role</code>), så fylles det automatisk inn. For mer avansert
                    oppførsel (sammensatte tekster, signaturer fra biblioteket,
                    oppslagslister) – bruk «Felter»-panelet under designeren.
                </Typography>
            </Paper>

            <Snackbar
                open={!!successMessage}
                autoHideDuration={4000}
                onClose={() => setSuccessMessage(null)}
                message={successMessage}
            />
        </Container>
    );
}
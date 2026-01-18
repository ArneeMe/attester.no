'use client';

import React, { useState } from 'react';
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
                    Tips for feltnavn:
                </Typography>
                <Typography variant="body2" component="ul" sx={{ mt: 1 }}>
                    <li><code>student_name_date</code> - Tittel med studentens navn</li>
                    <li><code>student_role</code> - Rolle-beskrivelse</li>
                    <li><code>signature_date</code> - Dagens dato</li>
                    <li><code>group_info</code> - Beskrivelse av gruppen</li>
                    <li><code>echo_info</code> - Generell organisasjonstekst</li>
                    <li><code>signature_name_1</code>, <code>signature_role_1</code>, <code>signature_photo_1</code> - Signatur 1</li>
                    <li><code>signature_name_2</code>, <code>signature_role_2</code>, <code>signature_photo_2</code> - Signatur 2</li>
                    <li><code>qr_code</code> - QR-kode for verifisering</li>
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
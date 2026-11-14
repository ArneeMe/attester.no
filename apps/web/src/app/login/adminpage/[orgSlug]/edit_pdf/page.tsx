'use client';
export const runtime = 'edge';

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
    Box,
    Container,
    TextField,
    Typography,
    Alert,
    CircularProgress,
    Snackbar,
    FormControlLabel,
    Switch,
} from '@mui/material';
import dynamic from 'next/dynamic';
import { useAdminLang } from '@/util/useAdminLang';

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
    const searchParams = useSearchParams();
    const loadTemplateId = searchParams.get('id');
    const { strings } = useAdminLang();
    const d = strings.admin.designer;
    const [templateName, setTemplateName] = useState('');
    const [templateDescription, setTemplateDescription] = useState('');
    const [isOffered, setIsOffered] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>
                {d.title}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
                {d.intro}
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <DesignerComponent
                orgSlug={orgSlug}
                templateName={templateName}
                templateDescription={templateDescription}
                isOffered={isOffered}
                initialTemplateId={loadTemplateId}
                onError={setError}
                onSuccess={setSuccessMessage}
                saveFields={
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField
                        label={d.nameLabel}
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        required
                        sx={{ minWidth: 250 }}
                    />

                    <TextField
                        label={d.descLabel}
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        sx={{ minWidth: 300, flexGrow: 1 }}
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={isOffered}
                                onChange={(e) => setIsOffered(e.target.checked)}
                            />
                        }
                        label={d.offeredLabel}
                    />
                </Box>
                }
                onTemplateLoad={(name, desc, def) => {
                    setTemplateName(name);
                    setTemplateDescription(desc);
                    setIsOffered(def);
                }}
            />

            <Snackbar
                open={!!successMessage}
                autoHideDuration={4000}
                onClose={() => setSuccessMessage(null)}
                message={successMessage}
            />
        </Container>
    );
}
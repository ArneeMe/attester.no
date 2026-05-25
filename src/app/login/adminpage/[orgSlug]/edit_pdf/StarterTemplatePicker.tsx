'use client';

import React from 'react';
import {
    Button,
    Card,
    CardActionArea,
    CardContent,
    Dialog,
    DialogContent,
    DialogTitle,
    Grid,
    Typography,
} from '@mui/material';
import { STARTER_TEMPLATES, type StarterTemplate } from '@/app/pdfinfo/starterTemplates';

type Props = {
    open: boolean;
    onClose: () => void;
    onPick: (starter: StarterTemplate) => void;
};

export default function StarterTemplatePicker({ open, onClose, onPick }: Props) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Start fra en ferdig mal</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Velg en mal som utgangspunkt. Layouten, feltbindingene, og
                    skjemaet blir fylt inn — du kan redigere alt etterpå.
                </Typography>
                <Grid container spacing={2}>
                    {STARTER_TEMPLATES.map((s) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={s.id}>
                            <Card variant="outlined">
                                <CardActionArea
                                    onClick={() => {
                                        onPick(s);
                                        onClose();
                                    }}
                                    sx={{ height: '100%' }}
                                >
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            {s.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {s.description}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                            {s.formSchema.length} skjemafelt
                                            {' · '}
                                            {Object.keys(s.fieldBindings).length} bindinger
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </DialogContent>
            <Grid container justifyContent="flex-end" sx={{ p: 2 }}>
                <Button onClick={onClose}>Avbryt</Button>
            </Grid>
        </Dialog>
    );
}

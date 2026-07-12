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
import { useAdminLang } from '@/util/useAdminLang';

type Props = {
    open: boolean;
    onClose: () => void;
    onPick: (starter: StarterTemplate) => void;
};

export default function StarterTemplatePicker({ open, onClose, onPick }: Props) {
    const { strings } = useAdminLang();
    const d = strings.admin.designer;
    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{d.pickerTitle}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {d.pickerIntro}
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
                                            {d.starterMeta(s.formSchema.length, Object.keys(s.fieldBindings).length)}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </DialogContent>
            <Grid container justifyContent="flex-end" sx={{ p: 2 }}>
                <Button onClick={onClose}>{strings.common.cancel}</Button>
            </Grid>
        </Dialog>
    );
}

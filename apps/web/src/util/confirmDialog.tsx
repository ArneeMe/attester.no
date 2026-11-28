import React, { useState } from 'react';
import {Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CircularProgress} from '@mui/material';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    details?: React.ReactNode;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
    confirmButtonText?: string;
    cancelButtonText?: string;
    showCancelButton?: boolean;
    // Optional second action button rendered alongside the primary confirm.
    // Useful for "Lukk" + "Slett innsendingen" style dialogs where neither
    // action is destructive enough to be the cancel button.
    secondaryAction?: {
        label: string;
        onClick: () => void;
        color?: 'primary' | 'error' | 'warning' | 'info';
    };
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
                                                         open,
                                                         title,
                                                         message,
                                                         details,
                                                         onConfirm,
                                                         onClose,
                                                         confirmButtonText,
                                                         cancelButtonText,
                                                         showCancelButton = true,
                                                         secondaryAction,
                                                     }: ConfirmDialogProps) => {
    const [busy, setBusy] = useState(false);

    // The dialog owns the in-flight guard so no caller has to: a confirm that
    // returns a promise locks every button until it settles. Without it two
    // quick clicks both reach the server, which on issuance means two
    // certificate rows.
    const handleConfirm = async () => {
        if (busy) return;
        const result = onConfirm();
        if (!(result instanceof Promise)) return;
        setBusy(true);
        try {
            await result;
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
                {details}
            </DialogContent>
            <DialogActions>
                {showCancelButton &&
                    <Button onClick={onClose} color="primary" disabled={busy}>
                        {cancelButtonText ?? 'Avbryt'}
                    </Button>}
                {secondaryAction && (
                    <Button
                        onClick={secondaryAction.onClick}
                        color={secondaryAction.color ?? 'primary'}
                        disabled={busy}
                    >
                        {secondaryAction.label}
                    </Button>
                )}
                <Button variant="contained" onClick={handleConfirm} color="primary" disabled={busy}>
                    {busy ? <CircularProgress size={20} /> : (confirmButtonText || 'Bekreft')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;

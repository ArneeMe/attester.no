import React from 'react';
import {Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button} from '@mui/material';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    details?: React.ReactNode;
    onConfirm: () => void;
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
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
                {details}
            </DialogContent>
            <DialogActions>
                {showCancelButton &&
                    <Button onClick={onClose} color="primary">
                        {cancelButtonText ?? 'Avbryt'}
                    </Button>}
                {secondaryAction && (
                    <Button
                        onClick={secondaryAction.onClick}
                        color={secondaryAction.color ?? 'primary'}
                    >
                        {secondaryAction.label}
                    </Button>
                )}
                <Button variant="contained" onClick={onConfirm} color="primary">
                    {confirmButtonText || 'Bekreft'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;

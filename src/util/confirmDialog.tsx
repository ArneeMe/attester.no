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
    showCancelButton?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
                                                         open,
                                                         title,
                                                         message,
                                                         details,
                                                         onConfirm,
                                                         onClose,
                                                         confirmButtonText,
                                                         showCancelButton = true,
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
                        Avbryt
                    </Button>}
                <Button variant="contained" onClick={onConfirm} color="primary">
                    {confirmButtonText || 'Bekreft'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
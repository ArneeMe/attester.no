'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

type Severity = 'success' | 'info' | 'warning' | 'error';

type Toast = {
    id: number;
    message: string;
    severity: Severity;
};

type ToastApi = {
    success: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
    error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        // Defensive: callers outside the provider get a no-op rather than a
        // crash. Logs to console so devs notice the missing provider.
        return {
            success: (m) => console.log('[toast]', m),
            info: (m) => console.log('[toast]', m),
            warning: (m) => console.warn('[toast]', m),
            error: (m) => console.error('[toast]', m),
        };
    }
    return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [queue, setQueue] = useState<Toast[]>([]);

    const push = useCallback((severity: Severity, message: string) => {
        setQueue((q) => [...q, { id: Date.now() + Math.random(), message, severity }]);
    }, []);

    const api = useMemo<ToastApi>(
        () => ({
            success: (m) => push('success', m),
            info: (m) => push('info', m),
            warning: (m) => push('warning', m),
            error: (m) => push('error', m),
        }),
        [push],
    );

    const current = queue[0];

    return (
        <ToastContext.Provider value={api}>
            {children}
            <Snackbar
                key={current?.id ?? 'empty'}
                open={!!current}
                autoHideDuration={current?.severity === 'error' ? 8000 : 4000}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                onClose={(_, reason) => {
                    if (reason === 'clickaway') return;
                    setQueue((q) => q.slice(1));
                }}
            >
                {current ? (
                    <Alert
                        severity={current.severity}
                        variant="filled"
                        onClose={() => setQueue((q) => q.slice(1))}
                        sx={{ width: '100%' }}
                    >
                        {current.message}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </ToastContext.Provider>
    );
}

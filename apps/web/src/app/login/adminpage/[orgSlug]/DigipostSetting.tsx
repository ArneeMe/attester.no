'use client'
import React, { useEffect, useState } from 'react';
import { FormControlLabel, Paper, Switch, Typography } from '@mui/material';
import { authHeader } from '@/lib/nhost';
import { useToast } from '@/components/ToastProvider';
import { useAdminLang } from '@/util/useAdminLang';

type Settings = { digipostAvailable: boolean; digipostEnabled: boolean };

const DigipostSetting: React.FC<{ orgSlug: string }> = ({ orgSlug }) => {
    const { strings } = useAdminLang();
    const a = strings.admin.dashboard;
    const toast = useToast();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [busy, setBusy] = useState(false);
    const url = `/api/v1/org/${encodeURIComponent(orgSlug)}/settings`;

    useEffect(() => {
        fetch(url, { headers: authHeader() })
            .then((res) => (res.ok ? res.json() : null))
            .then(setSettings)
            .catch(() => setSettings(null));
    }, [url]);

    if (!settings?.digipostAvailable) return null;

    const toggle = async (enabled: boolean) => {
        setBusy(true);
        try {
            const res = await fetch(url, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json', ...authHeader() },
                body: JSON.stringify({ digipostEnabled: enabled }),
            });
            if (!res.ok) throw new Error();
            setSettings(await res.json());
        } catch {
            toast.error(a.digipostSettingError);
        }
        setBusy(false);
    };

    return (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <FormControlLabel
                control={
                    <Switch
                        checked={settings.digipostEnabled}
                        disabled={busy}
                        onChange={(e) => toggle(e.target.checked)}
                    />
                }
                label={a.digipostSettingLabel}
            />
            <Typography variant="body2" color="text.secondary">
                {a.digipostSettingHelp}
            </Typography>
        </Paper>
    );
};

export default DigipostSetting;

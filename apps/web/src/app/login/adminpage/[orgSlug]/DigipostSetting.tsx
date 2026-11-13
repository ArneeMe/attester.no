'use client'
import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import { authHeader } from '@/lib/nhost';
import { useAdminLang } from '@/util/useAdminLang';

type Settings = { digipostAvailable: boolean; digipostEnabled: boolean };

const DigipostSetting: React.FC<{ orgSlug: string }> = ({ orgSlug }) => {
    const { strings } = useAdminLang();
    const a = strings.admin.dashboard;
    const [settings, setSettings] = useState<Settings | null>(null);

    useEffect(() => {
        fetch(`/api/v1/org/${encodeURIComponent(orgSlug)}/settings`, { headers: authHeader() })
            .then((res) => (res.ok ? res.json() : null))
            .then(setSettings)
            .catch(() => setSettings(null));
    }, [orgSlug]);

    if (!settings?.digipostAvailable) return null;

    return (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {settings.digipostEnabled ? a.digipostOn : a.digipostOff}
        </Typography>
    );
};

export default DigipostSetting;

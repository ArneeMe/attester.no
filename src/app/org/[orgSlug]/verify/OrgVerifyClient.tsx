'use client'
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Box, Grid, TextField, Typography } from '@mui/material';
import { canonicalHash } from '@/util/canonicalHash';
import { buildCertParams } from '@/util/certParams';
import { customTheme } from '@/app/style/customTheme';

type ExtraRole = { groupName: string; startDate: string; endDate: string; role: string };
type FormData = {
    personName: string;
    groupName: string;
    startDate: string;
    endDate: string;
    role: string;
    extraRoles: ExtraRole[];
};

const OrgVerifyClient: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const searchParams = useSearchParams();
    const colorTheme = customTheme.palette;
    const volunteerId = searchParams.get('id') ?? '';
    const templateId = searchParams.get('t') ?? '';

    const [storedHash, setStoredHash] = useState<string | null | undefined>(undefined);
    const [verificationResult, setVerificationResult] = useState<'verified' | 'invalid' | null>(null);

    const [formData, setFormData] = useState<FormData>(() => ({
        personName: searchParams.get('name') ?? '',
        groupName: searchParams.get('group') ?? '',
        startDate: searchParams.get('start') ?? '',
        endDate: searchParams.get('end') ?? '',
        role: searchParams.get('role') ?? '',
        extraRoles: [1, 2, 3].map((i) => ({
            groupName: searchParams.get(`group${i}`) ?? '',
            startDate: searchParams.get(`start${i}`) ?? '',
            endDate: searchParams.get(`end${i}`) ?? '',
            role: searchParams.get(`role${i}`) ?? '',
        })),
    }));

    useEffect(() => {
        if (!volunteerId) { setStoredHash(null); return; }
        fetch(`/api/org/${encodeURIComponent(orgSlug)}/certificates/verify?volunteerId=${encodeURIComponent(volunteerId)}`)
            .then((r) => r.json())
            .then((json: { hash: string | null }) => setStoredHash(json.hash))
            .catch(() => setStoredHash(null));
    }, [orgSlug, volunteerId]);

    useEffect(() => {
        if (storedHash === undefined) return;
        if (!storedHash) { setVerificationResult('invalid'); return; }

        const params = buildCertParams(templateId, {
            id: volunteerId,
            personName: formData.personName,
            groupName: formData.groupName,
            startDate: formData.startDate,
            endDate: formData.endDate,
            role: formData.role,
            extraRole: formData.extraRoles,
        });

        canonicalHash(params).then((computed) => {
            setVerificationResult(computed === storedHash ? 'verified' : 'invalid');
        });
    }, [formData, storedHash, templateId, volunteerId]);

    const getColor = () => {
        if (verificationResult === 'verified') return colorTheme.primary.main;
        if (verificationResult === 'invalid') return colorTheme.error.main;
        return colorTheme.secondary.main;
    };

    const updateField = (key: keyof Omit<FormData, 'extraRoles'>, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const updateExtraRole = (index: number, key: keyof ExtraRole, value: string) => {
        setFormData((prev) => ({
            ...prev,
            extraRoles: prev.extraRoles.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
        }));
    };

    const visibleExtraRoles = useMemo(
        () =>
            formData.extraRoles
                .map((r, i) => ({ r, i }))
                .filter(({ i }) =>
                    ['group', 'start', 'end', 'role'].some((k) => searchParams.has(`${k}${i + 1}`)),
                ),
        [formData.extraRoles, searchParams],
    );

    return (
        <Box sx={{ border: `5px solid ${getColor()}`, padding: 1, borderRadius: 2, margin: 2 }}>
            <Typography variant="h3">Verifikasjon</Typography>
            <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" color={getColor()}>
                    {verificationResult === null
                        ? 'Laster...'
                        : verificationResult === 'verified'
                            ? 'Attesten er gyldig!'
                            : 'Attesten er ugyldig.'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Endre feltene under for å verifisere mot lagret hash.
                </Typography>
            </Grid>
            <Box>
                <Grid container spacing={2} paddingTop={2}>
                    <Grid size={{ xs: 10, md: 12 }}>
                        <TextField
                            label="Navn"
                            variant="outlined"
                            fullWidth
                            value={formData.personName}
                            onChange={(e) => updateField('personName', e.target.value)}
                        />
                    </Grid>
                </Grid>
                <Grid container spacing={2} paddingTop={3}>
                    <Grid size={{ xs: 5, md: 3 }}>
                        <TextField label="Rolle" variant="outlined" fullWidth
                            value={formData.role}
                            onChange={(e) => updateField('role', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 5, md: 3 }}>
                        <TextField label="Gruppe" variant="outlined" fullWidth
                            value={formData.groupName}
                            onChange={(e) => updateField('groupName', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 5, md: 3 }}>
                        <TextField label="Startdato" variant="outlined" fullWidth
                            value={formData.startDate}
                            onChange={(e) => updateField('startDate', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 5, md: 3 }}>
                        <TextField label="Sluttdato" variant="outlined" fullWidth
                            value={formData.endDate}
                            onChange={(e) => updateField('endDate', e.target.value)} />
                    </Grid>
                </Grid>
                {visibleExtraRoles.map(({ r, i }) => (
                    <Box key={i} sx={{ marginTop: 2 }}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 5, md: 3 }}>
                                <TextField label={`Rolle ${i + 1}`} variant="outlined" fullWidth
                                    value={r.role}
                                    onChange={(e) => updateExtraRole(i, 'role', e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 5, md: 3 }}>
                                <TextField label={`Gruppe ${i + 1}`} variant="outlined" fullWidth
                                    value={r.groupName}
                                    onChange={(e) => updateExtraRole(i, 'groupName', e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 5, md: 3 }}>
                                <TextField label={`Startdato ${i + 1}`} variant="outlined" fullWidth
                                    value={r.startDate}
                                    onChange={(e) => updateExtraRole(i, 'startDate', e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 5, md: 3 }}>
                                <TextField label={`Sluttdato ${i + 1}`} variant="outlined" fullWidth
                                    value={r.endDate}
                                    onChange={(e) => updateExtraRole(i, 'endDate', e.target.value)} />
                            </Grid>
                        </Grid>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default OrgVerifyClient;

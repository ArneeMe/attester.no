'use client'
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Box, CircularProgress, Grid, TextField, Typography } from '@mui/material';
import { canonicalHash } from '@/util/canonicalHash';
import { customTheme } from '@/app/style/customTheme';
import type { FormSchema, FormFieldSchema } from '@/types/formSchema';

const OrgVerifyClient: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const searchParams = useSearchParams();
    const colorTheme = customTheme.palette;
    const submissionId = searchParams.get('id') ?? '';
    const templateId = searchParams.get('t') ?? '';

    const [storedHash, setStoredHash] = useState<string | null | undefined>(undefined);
    const [verificationResult, setVerificationResult] = useState<'verified' | 'invalid' | null>(null);
    const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
    const [schemaLoading, setSchemaLoading] = useState(!!templateId);

    // All URL params except 't' — includes 'id' (part of hash) and all cert fields
    const [fields, setFields] = useState<Record<string, string>>(() => {
        const result: Record<string, string> = {};
        searchParams.forEach((value, key) => {
            if (key !== 't') result[key] = value;
        });
        return result;
    });

    useEffect(() => {
        if (!templateId) { setSchemaLoading(false); return; }
        fetch(`/api/org/${encodeURIComponent(orgSlug)}/templates/${encodeURIComponent(templateId)}`)
            .then((r) => r.json())
            .then((json: { template?: { form_schema: FormSchema } }) => {
                if (json.template?.form_schema) setFormSchema(json.template.form_schema);
            })
            .catch(() => {})
            .finally(() => setSchemaLoading(false));
    }, [orgSlug, templateId]);

    useEffect(() => {
        if (!submissionId) { setStoredHash(null); return; }
        fetch(`/api/org/${encodeURIComponent(orgSlug)}/certificates/verify?submissionId=${encodeURIComponent(submissionId)}`)
            .then((r) => r.json())
            .then((json: { hash: string | null }) => setStoredHash(json.hash))
            .catch(() => setStoredHash(null));
    }, [orgSlug, submissionId]);

    useEffect(() => {
        if (storedHash === undefined) return;
        if (!storedHash) { setVerificationResult('invalid'); return; }
        canonicalHash(new URLSearchParams(fields)).then((computed) => {
            setVerificationResult(computed === storedHash ? 'verified' : 'invalid');
        });
    }, [fields, storedHash]);

    const getColor = () => {
        if (verificationResult === 'verified') return colorTheme.primary.main;
        if (verificationResult === 'invalid') return colorTheme.error.main;
        return colorTheme.secondary.main;
    };

    const updateField = (key: string, value: string) => {
        setFields((prev) => ({ ...prev, [key]: value }));
    };

    // Schema-driven: show only fields present in schema; hide optional ones absent from URL.
    // Fallback (no template id or schema fetch failed): derive fields from URL params.
    const visibleFields: FormFieldSchema[] = formSchema
        ? formSchema.filter((f) => !f.optional || searchParams.has(f.key))
        : Object.keys(fields)
              .filter((k) => k !== 'id')
              .map((k) => ({ key: k, label: k, type: 'text' as const }));

    return (
        <Box sx={{ border: `5px solid ${getColor()}`, padding: 3, borderRadius: 2, margin: 2 }}>
            <Typography variant="h3" gutterBottom>Verifikasjon</Typography>

            {verificationResult === null ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2 }}>
                    <CircularProgress size={28} />
                    <Typography variant="h6" color="text.secondary">Kontrollerer attesten …</Typography>
                </Box>
            ) : verificationResult === 'verified' ? (
                <Box sx={{ my: 2 }}>
                    <Typography variant="h5" color={getColor()} sx={{ fontWeight: 700 }}>
                        ✓ Attesten er gyldig
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        Opplysningene under stemmer nøyaktig med attesten slik den ble
                        utstedt. Endres så mye som ett tegn, blir den ugyldig.
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ my: 2 }}>
                    <Typography variant="h5" color={getColor()} sx={{ fontWeight: 700 }}>
                        ✗ Attesten er ugyldig
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        Opplysningene stemmer ikke med noen utstedt attest. Enten er
                        lenken ufullstendig (skann QR-koden på nytt), et felt er endret,
                        eller attesten er aldri utstedt av denne organisasjonen.
                    </Typography>
                </Box>
            )}

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3 }}>
                Attesterte opplysninger — du kan endre et felt for å se at
                verifiseringen da slår feil:
            </Typography>
            <Grid container spacing={2} paddingTop={2}>
                {schemaLoading ? (
                    <Grid size={{ xs: 12 }}>
                        <CircularProgress size={24} />
                    </Grid>
                ) : (
                    visibleFields.map((field) => (
                        <Grid key={field.key} size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                                label={field.label}
                                variant="outlined"
                                fullWidth
                                value={fields[field.key] ?? ''}
                                onChange={(e) => updateField(field.key, e.target.value)}
                            />
                        </Grid>
                    ))
                )}
            </Grid>
        </Box>
    );
};

export default OrgVerifyClient;

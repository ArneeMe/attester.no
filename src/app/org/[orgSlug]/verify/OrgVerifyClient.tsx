'use client'
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Box, CircularProgress, Grid, TextField } from '@mui/material';
import { canonicalHash } from '@/util/canonicalHash';
import { selectHashFields } from '@/util/verifyFieldSelection';
import { customTheme } from '@/app/style/customTheme';
import { fontSerif } from '@/app/style/landingFonts';
import { body, c, gutter, mono } from '@/app/style/tokens';
import type { FormSchema, FormFieldSchema } from '@/types/formSchema';
import { getStrings, normalizeLang, type Lang } from '@/strings';
import OrgLogo from '@/components/OrgLogo';

const OrgVerifyClient: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const searchParams = useSearchParams();
    const colorTheme = customTheme.palette;
    const submissionId = searchParams.get('id') ?? '';
    const templateId = searchParams.get('t') ?? '';

    const [uiLang, setUiLang] = useState<Lang>(() => normalizeLang(searchParams.get('lang')));
    const s = getStrings(uiLang).verify;

    const [storedHash, setStoredHash] = useState<string | null | undefined>(undefined);
    const [verificationResult, setVerificationResult] = useState<'verified' | 'invalid' | null>(null);
    const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
    const [schemaLoading, setSchemaLoading] = useState(!!templateId);

    const [fields, setFields] = useState<Record<string, string>>(() => {
        const result: Record<string, string> = {};
        searchParams.forEach((value, key) => {
            if (key !== 't' && key !== 'lang') result[key] = value;
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

    const hashInput = useMemo(() => selectHashFields(formSchema, fields), [formSchema, fields]);

    useEffect(() => {
        if (storedHash === undefined) return;
        if (!storedHash) { setVerificationResult('invalid'); return; }
        canonicalHash(new URLSearchParams(hashInput)).then((computed) => {
            setVerificationResult(computed === storedHash ? 'verified' : 'invalid');
        });
    }, [hashInput, storedHash]);

    const stateColor = verificationResult === 'verified'
        ? colorTheme.primary.main
        : verificationResult === 'invalid'
            ? colorTheme.error.main
            : colorTheme.secondary.main;

    const updateField = (key: string, value: string) => {
        setFields((prev) => ({ ...prev, [key]: value }));
    };

    const visibleFields: FormFieldSchema[] = formSchema
        ? formSchema.filter((f) => !f.optional || searchParams.has(f.key))
        : Object.keys(fields)
              .filter((k) => k !== 'id')
              .map((k) => ({ key: k, label: k, type: 'text' as const }));

    const toggleStyle = (active: boolean): React.CSSProperties => ({
        font: 'inherit',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        textDecoration: active ? 'none' : 'underline',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        color: active ? c.ink : c.inkSoft,
    });

    return (
        <Box sx={{ minHeight: '100vh', background: c.paper, color: c.ink }}>
            <Box
                component="header"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    px: gutter,
                    py: 2.25,
                    borderBottom: `1px solid ${c.rule}`,
                }}
            >
                <Box
                    component={Link}
                    href="/"
                    sx={{
                        font: `600 17px/1 ${fontSerif}`,
                        letterSpacing: '0.01em',
                        color: c.ink,
                        textDecoration: 'none',
                    }}
                >
                    attester.no
                </Box>
                <Box component="span" sx={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}>
                    <button type="button" style={toggleStyle(uiLang === 'no')} onClick={() => setUiLang('no')} aria-current={uiLang === 'no' ? 'true' : undefined}>
                        Norsk
                    </button>
                    <Box component="span" aria-hidden sx={{ color: c.borderStrong, fontSize: 13 }}>|</Box>
                    <button type="button" style={toggleStyle(uiLang === 'en')} onClick={() => setUiLang('en')} aria-current={uiLang === 'en' ? 'true' : undefined}>
                        English
                    </button>
                </Box>
            </Box>

            <Box sx={{ maxWidth: 760, mx: 'auto', px: gutter, py: { xs: 4, md: 6 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <OrgLogo orgSlug={orgSlug} height={40} />
                    <Box sx={{ ...mono, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {s.title}
                    </Box>
                </Box>

                <Box
                    sx={{
                        background: c.surface,
                        border: `1px solid ${c.rule}`,
                        borderLeft: `3px solid ${stateColor}`,
                        px: { xs: 2.5, md: 3.5 },
                        py: { xs: 3, md: 3.5 },
                    }}
                >
                    {verificationResult === null ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <CircularProgress size={22} sx={{ color: stateColor }} />
                            <Box sx={{ font: `400 20px/1.3 ${fontSerif}`, color: c.inkMuted }}>
                                {s.checking}
                            </Box>
                        </Box>
                    ) : (
                        <>
                            <Box
                                sx={{
                                    font: `400 clamp(22px, 3.5vw, 28px)/1.25 ${fontSerif}`,
                                    color: stateColor,
                                }}
                            >
                                {verificationResult === 'verified' ? s.validTitle : s.invalidTitle}
                            </Box>
                            <Box sx={{ ...body, mt: 1.5 }}>
                                {verificationResult === 'verified' ? s.validBody : s.invalidBody}
                            </Box>
                        </>
                    )}
                </Box>

                <Box sx={{ mt: 5 }}>
                    <Box sx={{ ...body, color: c.inkMuted, mb: 2 }}>{s.fieldsLabel}</Box>
                    <Grid container spacing={2}>
                        {schemaLoading ? (
                            <Grid size={{ xs: 12 }}>
                                <CircularProgress size={22} />
                            </Grid>
                        ) : (
                            visibleFields.map((field) => (
                                <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
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

                <Box sx={{ mt: 5, pt: 3, borderTop: `1px solid ${c.ruleSoft}`, fontSize: 14 }}>
                    <Link href={uiLang === 'en' ? '/om?lang=en' : '/om'}>{s.aboutLink}</Link>
                </Box>
            </Box>
        </Box>
    );
};

export default OrgVerifyClient;

'use client'
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Box, CircularProgress, Grid, TextField, Typography } from '@mui/material';
import { canonicalHash } from '@/util/canonicalHash';
import { selectHashFields } from '@/util/verifyFieldSelection';
import { customTheme } from '@/app/style/customTheme';
import type { FormSchema, FormFieldSchema } from '@/types/formSchema';
import { getStrings, normalizeLang, type Lang } from '@/strings';

const OrgVerifyClient: React.FC = () => {
    const { orgSlug } = useParams<{ orgSlug: string }>();
    const searchParams = useSearchParams();
    const colorTheme = customTheme.palette;
    const submissionId = searchParams.get('id') ?? '';
    const templateId = searchParams.get('t') ?? '';

    // Language here is page-local UI state, not synced to the URL. The
    // verify URL is a fixed external contract — printed on paper, embedded
    // in a QR code — so it shouldn't be mutated by a UI preference. This
    // also sidesteps a whole class of bug: any extra query param a sharing
    // channel appends (utm_*, fbclid, a future UI flag) can never leak into
    // the hash just because the page has an interactive toggle.
    const [uiLang, setUiLang] = useState<Lang>(() => normalizeLang(searchParams.get('lang')));
    const s = getStrings(uiLang).verify;

    const [storedHash, setStoredHash] = useState<string | null | undefined>(undefined);
    const [verificationResult, setVerificationResult] = useState<'verified' | 'invalid' | null>(null);
    const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
    const [schemaLoading, setSchemaLoading] = useState(!!templateId);

    // All URL params except 't' and 'lang' — includes 'id' and every cert
    // field. This is the editable/display state; what actually feeds the
    // hash is narrowed further below via selectHashFields.
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

    // Once the template's form schema is known, only its declared field
    // keys (plus id) are trusted for hashing — anything else in `fields`
    // (a stray tracking param, say) is ignored rather than blocklisted by
    // name. Falls back to trusting every field when no schema is available.
    const hashInput = useMemo(() => selectHashFields(formSchema, fields), [formSchema, fields]);

    useEffect(() => {
        if (storedHash === undefined) return;
        if (!storedHash) { setVerificationResult('invalid'); return; }
        canonicalHash(new URLSearchParams(hashInput)).then((computed) => {
            setVerificationResult(computed === storedHash ? 'verified' : 'invalid');
        });
    }, [hashInput, storedHash]);

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

    const toggleStyle = (active: boolean): React.CSSProperties => ({
        fontSize: '0.875rem',
        fontWeight: active ? 700 : 400,
        textDecoration: active ? 'none' : 'underline',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        color: 'inherit',
    });

    return (
        <Box sx={{ border: `5px solid ${getColor()}`, padding: 3, borderRadius: 2, margin: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h3" gutterBottom>{s.title}</Typography>
                <Box component="span" sx={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}>
                    <button type="button" style={toggleStyle(uiLang === 'no')} onClick={() => setUiLang('no')} aria-current={uiLang === 'no' ? 'true' : undefined}>
                        Norsk
                    </button>
                    <span aria-hidden>|</span>
                    <button type="button" style={toggleStyle(uiLang === 'en')} onClick={() => setUiLang('en')} aria-current={uiLang === 'en' ? 'true' : undefined}>
                        English
                    </button>
                </Box>
            </Box>

            {verificationResult === null ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2 }}>
                    <CircularProgress size={28} />
                    <Typography variant="h6" color="text.secondary">{s.checking}</Typography>
                </Box>
            ) : verificationResult === 'verified' ? (
                <Box sx={{ my: 2 }}>
                    <Typography variant="h5" color={getColor()} sx={{ fontWeight: 700 }}>
                        {s.validTitle}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        {s.validBody}
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ my: 2 }}>
                    <Typography variant="h5" color={getColor()} sx={{ fontWeight: 700 }}>
                        {s.invalidTitle}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        {s.invalidBody}
                    </Typography>
                </Box>
            )}

            <Typography variant="body2" sx={{ mt: 1 }}>
                <Link href={uiLang === 'en' ? '/om?lang=en' : '/om'}>{s.aboutLink}</Link>
            </Typography>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3 }}>
                {s.fieldsLabel}
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

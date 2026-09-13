'use client'
import React, { useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { getStrings, type Lang } from '@/strings';
import { ORG_NUMBER_DIGITS, suggestSlug } from '@/util/orgRequest';
import { body, c, field, h2, lede } from '@/app/style/tokens';

type Errors = Record<string, string | undefined>;

const labelStyle = { ...body, display: 'block', color: c.ink, mb: 0.75, fontWeight: 500 };
const helpStyle = { ...body, fontSize: 13, color: c.inkFaint, mt: 0.5 };
const DANGER = '#a3342b';

const Field: React.FC<{
    id: string;
    label: string;
    help?: string;
    error?: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    inputMode?: 'numeric';
    maxLength?: number;
    multiline?: boolean;
    required?: boolean;
}> = ({
    id, label, help, error, value, onChange,
    type = 'text', inputMode, maxLength, multiline = false, required = false,
}) => (
    <Box sx={{ mb: 2.5 }}>
        <Box component="label" htmlFor={id} sx={labelStyle}>
            {label}
            {required && <Box component="span" aria-hidden sx={{ color: c.accent }}> *</Box>}
        </Box>
        <Box
            component={multiline ? 'textarea' : 'input'}
            id={id}
            name={id}
            type={multiline ? undefined : type}
            inputMode={inputMode}
            maxLength={maxLength}
            required={required}
            rows={multiline ? 4 : undefined}
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                onChange(e.target.value)
            }
            aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
            aria-invalid={error ? true : undefined}
            sx={{
                ...field,
                ...body,
                width: '100%',
                boxSizing: 'border-box',
                height: multiline ? 'auto' : field.height,
                py: multiline ? 1.25 : 0,
                fontFamily: 'inherit',
                borderColor: error ? DANGER : c.border,
            }}
        />
        {error && (
            <Box id={`${id}-error`} sx={{ ...helpStyle, color: DANGER }}>
                {error}
            </Box>
        )}
        {!error && help && <Box id={`${id}-help`} sx={helpStyle}>{help}</Box>}
    </Box>
);

const RequestOrgForm: React.FC<{ lang: Lang }> = ({ lang }) => {
    const s = getStrings(lang).requestOrg;
    const [organizationName, setOrganizationName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [orgNumber, setOrgNumber] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [message, setMessage] = useState('');
    const [website, setWebsite] = useState('');
    const [errors, setErrors] = useState<Errors>({});
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);

    const onNameChange = (value: string) => {
        setOrganizationName(value);
        if (!slugTouched) setSlug(suggestSlug(value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setErrors({});
        try {
            const res = await fetch('/api/org-requests', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    organizationName,
                    slug,
                    orgNumber,
                    contactName,
                    contactEmail,
                    message,
                    website,
                }),
            });
            const json = await res.json();
            if (res.ok) {
                setSent(true);
                return;
            }
            const key = (json.error ?? 'server_error') as keyof typeof s.errors;
            const text = s.errors[key] ?? s.errors.server_error;
            setErrors(json.field ? { [json.field]: text } : { form: text });
        } catch {
            setErrors({ form: s.errors.server_error });
        } finally {
            setBusy(false);
        }
    };

    if (sent) {
        return (
            <Box sx={{ maxWidth: 620 }}>
                <Box component="h1" sx={{ ...h2, mb: 1.5 }}>{s.sentTitle}</Box>
                <Box sx={lede}>{s.sentBody}</Box>
            </Box>
        );
    }

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 620 }}>
            <Box component="h1" sx={{ ...h2, mb: 1.5 }}>{s.title}</Box>
            <Box sx={{ ...lede, mb: 1 }}>{s.lede}</Box>
            <Box sx={{ ...body, fontSize: 13, color: c.inkFaint, mb: 4 }}>{s.requiredLegend}</Box>

            <Field
                id="organizationName"
                error={errors.organizationName}
                label={s.organizationName}
                value={organizationName}
                onChange={onNameChange}
                required
            />
            <Field
                id="slug"
                error={errors.slug}
                label={s.slug}
                help={s.slugHelp(slug)}
                value={slug}
                onChange={(v) => { setSlugTouched(true); setSlug(v.toLowerCase()); }}
                required
            />
            <Field
                id="orgNumber"
                error={errors.orgNumber}
                label={s.orgNumber}
                value={orgNumber}
                onChange={(v) => setOrgNumber(v.replace(/\D/g, '').slice(0, ORG_NUMBER_DIGITS))}
                inputMode="numeric"
                maxLength={ORG_NUMBER_DIGITS}
            />
            <Field
                id="contactName"
                error={errors.contactName}
                label={s.contactName}
                value={contactName}
                onChange={setContactName}
            />
            <Field
                id="contactEmail"
                error={errors.contactEmail}
                label={s.contactEmail}
                value={contactEmail}
                onChange={setContactEmail}
                type="email"
                required
            />
            <Field
                id="message"
                error={errors.message}
                label={s.message}
                value={message}
                onChange={setMessage}
                multiline
            />

            <Box aria-hidden sx={{ position: 'absolute', left: '-9999px' }}>
                <label htmlFor="website">Website</label>
                <input
                    id="website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                />
            </Box>

            {errors.form && (
                <Box role="alert" sx={{ ...body, color: DANGER, mb: 2 }}>{errors.form}</Box>
            )}

            <Box
                component="button"
                type="submit"
                disabled={busy}
                sx={{
                    ...body,
                    color: c.surface,
                    background: c.accent,
                    border: 'none',
                    borderRadius: '2px',
                    px: 3,
                    height: 40,
                    cursor: busy ? 'default' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                    '&:hover': { background: busy ? c.accent : c.accentHover },
                }}
            >
                {busy ? <CircularProgress size={16} sx={{ color: c.surface }} /> : s.submit}
            </Box>
        </Box>
    );
};

export default RequestOrgForm;

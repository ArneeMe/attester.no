'use client'
import React, { useState } from 'react';
import {
    Button,
    FormControl,
    FormHelperText,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from '@mui/material';
import type { FormSchema, FormFieldSchema } from '@/types/formSchema';
import { validateField } from '@/util/validateFormField';

interface Props {
    schema: FormSchema;
    onSubmit: (data: Record<string, string>) => void | Promise<void>;
    submitLabel?: string;
    initialData?: Record<string, string>;
}

const SchemaForm: React.FC<Props> = ({ schema, onSubmit, submitLabel = 'Send inn', initialData = {} }) => {
    const [data, setData] = useState<Record<string, string>>(initialData);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (key: string, value: string) => {
        setData((prev) => ({ ...prev, [key]: value }));
        // Re-validate the touched field immediately so errors clear as the
        // volunteer fixes them, instead of sticking until the next submit.
        setErrors((prev) => {
            if (!(key in prev)) return prev;
            const field = schema.find((f) => f.key === key);
            const err = field ? validateField(field, value) : null;
            const next = { ...prev };
            if (err) next[key] = err; else delete next[key];
            return next;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const found: Record<string, string> = {};
        for (const field of schema) {
            const err = validateField(field, data[field.key] ?? '');
            if (err) found[field.key] = err;
        }
        setErrors(found);
        if (Object.keys(found).length > 0) return;
        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <Grid container spacing={2}>
                {schema.map((field) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={field.key}>
                        <FieldInput
                            field={field}
                            value={data[field.key] ?? ''}
                            error={errors[field.key]}
                            onChange={(v) => handleChange(field.key, v)}
                        />
                    </Grid>
                ))}
                <Grid size={{ xs: 12, sm: 6 }}>
                    <Button type="submit" variant="contained" fullWidth sx={{ mt: 3, mb: 2 }}>
                        {submitLabel}
                    </Button>
                </Grid>
            </Grid>
        </form>
    );
};

function FieldInput({
    field,
    value,
    error,
    onChange,
}: {
    field: FormFieldSchema;
    value: string;
    error?: string;
    onChange: (v: string) => void;
}) {
    switch (field.type) {
        case 'dropdown': {
            const options = field.options ?? [];
            // Fallback: if the admin chose dropdown but no options resolved
            // (lookup-list missing, server couldn't fetch, list is empty),
            // render a text field so the volunteer can still submit. Better
            // than a stuck required-but-unselectable dropdown.
            if (options.length === 0) {
                return (
                    <TextField
                        fullWidth
                        required={!field.optional}
                        label={field.label}
                        name={field.key}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        margin="normal"
                        error={!!error}
                        helperText={error ?? 'Skriv inn fritekst — det er ingen forhåndsdefinerte valg satt opp.'}
                    />
                );
            }
            return (
                <FormControl fullWidth required={!field.optional} margin="normal" error={!!error}>
                    <InputLabel>{field.label}</InputLabel>
                    <Select
                        label={field.label}
                        value={value}
                        onChange={(e) => onChange(String(e.target.value))}
                    >
                        {options.map((o) => (
                            <MenuItem key={o} value={o}>
                                {o}
                            </MenuItem>
                        ))}
                    </Select>
                    {error && <FormHelperText>{error}</FormHelperText>}
                </FormControl>
            );
        }

        case 'long_text':
            return (
                <TextField
                    fullWidth
                    required={!field.optional}
                    label={field.label}
                    name={field.key}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    margin="normal"
                    multiline
                    rows={4}
                    error={!!error}
                    helperText={error}
                />
            );

        case 'number':
            return (
                <TextField
                    fullWidth
                    required={!field.optional}
                    label={field.label}
                    name={field.key}
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    margin="normal"
                    error={!!error}
                    helperText={error}
                />
            );

        case 'date':
            return (
                <TextField
                    fullWidth
                    required={!field.optional}
                    label={field.label}
                    name={field.key}
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    margin="normal"
                    error={!!error}
                    helperText={error}
                />
            );

        case 'text':
        default:
            return (
                <TextField
                    fullWidth
                    required={!field.optional}
                    label={field.label}
                    name={field.key}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    margin="normal"
                    error={!!error}
                    helperText={error}
                />
            );
    }
}

export default SchemaForm;

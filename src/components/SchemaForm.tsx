'use client'
import React, { useState } from 'react';
import {
    Button,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from '@mui/material';
import type { FormSchema, FormFieldSchema } from '@/types/formSchema';

interface Props {
    schema: FormSchema;
    onSubmit: (data: Record<string, string>) => void | Promise<void>;
    submitLabel?: string;
    initialData?: Record<string, string>;
}

const SchemaForm: React.FC<Props> = ({ schema, onSubmit, submitLabel = 'Send inn', initialData = {} }) => {
    const [data, setData] = useState<Record<string, string>>(initialData);

    const handleChange = (key: string, value: string) => {
        setData((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
                {schema.map((field) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={field.key}>
                        <FieldInput field={field} value={data[field.key] ?? ''} onChange={(v) => handleChange(field.key, v)} />
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
    onChange,
}: {
    field: FormFieldSchema;
    value: string;
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
                        helperText="Skriv inn fritekst — det er ingen forhåndsdefinerte valg satt opp."
                    />
                );
            }
            return (
                <FormControl fullWidth required={!field.optional} margin="normal">
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
                />
            );
    }
}

export default SchemaForm;

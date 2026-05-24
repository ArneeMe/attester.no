'use client'
import React, { useState } from 'react';
import { Button, Grid, TextField } from '@mui/material';
import type { FormSchema } from '@/types/formSchema';

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
                        <TextField
                            fullWidth
                            required={!field.optional}
                            label={field.label}
                            name={field.key}
                            type={field.type === 'date' ? 'date' : 'text'}
                            value={data[field.key] ?? ''}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            slotProps={field.type === 'date' ? { inputLabel: { shrink: true } } : undefined}
                            margin="normal"
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

export default SchemaForm;

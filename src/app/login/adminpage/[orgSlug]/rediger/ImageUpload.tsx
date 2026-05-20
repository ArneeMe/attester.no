// app/components/ImageUpload.tsx
'use client'
import React, { useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';

interface ImageUploadProps {
    value: string; // base64 string
    onChange: (base64: string) => void;
    label?: string;
    maxSizeKB?: number;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
                                                     value,
                                                     onChange,
                                                     label = 'Last opp bilde',
                                                     maxSizeKB = 500,
                                                 }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        // Check file type
        if (!file.type.startsWith('image/')) {
            setError('Filen må være et bilde');
            return;
        }

        // Check file size
        if (file.size > maxSizeKB * 1024) {
            setError(`Bildet må være mindre enn ${maxSizeKB}KB`);
            return;
        }

        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            onChange(base64);
        };
        reader.onerror = () => {
            setError('Kunne ikke lese filen');
        };
        reader.readAsDataURL(file);
    };

    const handleClear = () => {
        onChange('');
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
                {label}
            </Typography>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="image-upload-input"
            />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <Button
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => inputRef.current?.click()}
                >
                    Velg bilde
                </Button>
                {value && (
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleClear}
                    >
                        Fjern
                    </Button>
                )}
            </Box>

            {error && (
                <Typography color="error" variant="body2">
                    {error}
                </Typography>
            )}

            {value && (
                <Box
                    sx={{
                        mt: 1,
                        p: 1,
                        border: '1px solid #ccc',
                        borderRadius: 1,
                        display: 'inline-block',
                    }}
                >
                    <img
                        src={value}
                        alt="Preview"
                        style={{ maxWidth: '200px', maxHeight: '150px', display: 'block' }}
                    />
                </Box>
            )}
        </Box>
    );
};

export default ImageUpload;
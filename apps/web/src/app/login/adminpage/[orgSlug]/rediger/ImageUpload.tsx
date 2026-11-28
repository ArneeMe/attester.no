'use client'
import React, { useId, useRef, useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAdminLang } from '@/util/useAdminLang';
import { normalizeSignature } from '@/util/normalizeSignature';

interface ImageUploadProps {
    value: string;
    onChange: (base64: string) => void;
    label?: string;
    maxSizeKB?: number;
    normalize?: 'signature';
}

const ImageUpload: React.FC<ImageUploadProps> = ({
    value,
    onChange,
    label,
    maxSizeKB = 500,
    normalize,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = useId();
    const { strings } = useAdminLang();
    const cs = strings.admin.content;
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [original, setOriginal] = useState<string | null>(null);
    const [useOriginal, setUseOriginal] = useState(false);

    const apply = async (raw: string, asOriginal: boolean) => {
        if (!normalize || asOriginal) {
            onChange(raw);
            return;
        }
        try {
            const normalized = await normalizeSignature(raw);
            if (normalized) {
                setNotice(null);
                onChange(normalized);
            } else {
                setNotice(cs.normalizeFailed);
                onChange(raw);
            }
        } catch {
            setNotice(cs.normalizeFailed);
            onChange(raw);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setNotice(null);

        if (!file.type.startsWith('image/')) {
            setError(cs.notAnImage);
            return;
        }

        if (file.size > maxSizeKB * 1024) {
            setError(cs.imageTooLarge(maxSizeKB));
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const raw = reader.result as string;
            setOriginal(raw);
            void apply(raw, useOriginal);
        };
        reader.onerror = () => {
            setError(cs.readError);
        };
        reader.readAsDataURL(file);
    };

    const handleUseOriginalChange = (checked: boolean) => {
        setUseOriginal(checked);
        setNotice(null);
        if (original) void apply(original, checked);
    };

    const handleClear = () => {
        onChange('');
        setOriginal(null);
        setNotice(null);
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
                id={inputId}
            />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                <Button
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => inputRef.current?.click()}
                >
                    {cs.pickImage}
                </Button>
                {value && (
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleClear}
                    >
                        {cs.removeImage}
                    </Button>
                )}
            </Box>

            {normalize && (
                <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                        {cs.normalizeHint}
                    </Typography>
                    <FormControlLabel
                        control={
                            <Checkbox
                                size="small"
                                checked={useOriginal}
                                onChange={(e) => handleUseOriginalChange(e.target.checked)}
                            />
                        }
                        label={<Typography variant="body2">{cs.useOriginal}</Typography>}
                    />
                </Box>
            )}

            {error && (
                <Typography color="error" variant="body2">
                    {error}
                </Typography>
            )}

            {notice && (
                <Typography color="warning.main" variant="body2">
                    {notice}
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

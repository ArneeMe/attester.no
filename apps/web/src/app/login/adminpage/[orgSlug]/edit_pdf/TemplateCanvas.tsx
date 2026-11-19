import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import type { Schema, Template } from '@pdfme/common';
import { b64toUint8Array } from '@pdfme/common';
import { moveBox, resizeBox, type Box as FieldBox } from '@/util/templateDraft';
import { c } from '@/app/style/tokens';

type Page = { width: number; height: number; image: string | null };

const A4 = { width: 210, height: 297 };
const PT_TO_MM = 25.4 / 72;

async function renderBackground(basePdf: Template['basePdf']): Promise<Page[]> {
    if (typeof basePdf !== 'string') {
        const { width, height } = basePdf as { width: number; height: number };
        return [{ width, height, image: null }];
    }
    const { pdf2img, pdf2size } = await import('@pdfme/converter');
    const bytes = b64toUint8Array(basePdf);
    const [sizes, images] = await Promise.all([pdf2size(bytes.slice()), pdf2img(bytes.slice(), { scale: 1.5 })]);
    return sizes.map((s, i) => ({
        width: s.width,
        height: s.height,
        image: URL.createObjectURL(new Blob([images[i]], { type: 'image/png' })),
    }));
}

type Drag = { name: string; mode: 'move' | 'resize'; startX: number; startY: number; box: FieldBox; page: Page; scale: number };

export default function TemplateCanvas({ basePdf, schemas, selected, labels, onSelect, onChange }: {
    basePdf: Template['basePdf'];
    schemas: Template['schemas'];
    selected: string | null;
    labels: Record<string, string>;
    onSelect: (name: string | null) => void;
    onChange: (name: string, box: FieldBox) => void;
}) {
    const [pages, setPages] = useState<Page[]>([{ ...A4, image: null }]);
    const [width, setWidth] = useState(600);
    const wrapRef = useRef<HTMLDivElement>(null);
    const drag = useRef<Drag | null>(null);

    useEffect(() => {
        let cancelled = false;
        let made: Page[] = [];
        renderBackground(basePdf)
            .then((p) => {
                made = p;
                if (!cancelled) setPages(p.length ? p : [{ ...A4, image: null }]);
            })
            .catch(() => !cancelled && setPages([{ ...A4, image: null }]));
        return () => {
            cancelled = true;
            made.forEach((p) => p.image && URL.revokeObjectURL(p.image));
        };
    }, [basePdf]);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() => setWidth(Math.min(el.clientWidth, 700)));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const start = (e: React.PointerEvent, field: Schema, mode: Drag['mode'], page: Page, scale: number) => {
        e.stopPropagation();
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onSelect(field.name);
        drag.current = {
            name: field.name,
            mode,
            startX: e.clientX,
            startY: e.clientY,
            box: { x: field.position.x, y: field.position.y, width: field.width, height: field.height },
            page,
            scale,
        };
    };

    const move = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const dx = (e.clientX - d.startX) / d.scale;
        const dy = (e.clientY - d.startY) / d.scale;
        onChange(d.name, d.mode === 'move' ? moveBox(d.box, dx, dy, d.page) : resizeBox(d.box, dx, dy, d.page));
    };

    const end = () => {
        drag.current = null;
    };

    const pageCount = Math.max(pages.length, (schemas ?? []).length, 1);

    return (
        <Box ref={wrapRef} sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {Array.from({ length: pageCount }, (_, i) => {
                const page = pages[i] ?? pages[0];
                const scale = width / page.width;
                return (
                    <Box
                        key={i}
                        data-testid="canvas-page"
                        onPointerDown={() => onSelect(null)}
                        onPointerMove={move}
                        onPointerUp={end}
                        sx={{
                            position: 'relative',
                            width,
                            height: page.height * scale,
                            bgcolor: '#fff',
                            backgroundImage: page.image ? `url(${page.image})` : 'none',
                            backgroundSize: '100% 100%',
                            boxShadow: `0 0 0 1px ${c.ruleSoft}, 0 2px 8px rgba(0,0,0,0.08)`,
                            touchAction: 'none',
                            userSelect: 'none',
                        }}
                    >
                        {((schemas ?? [])[i] ?? []).map((field) => (
                            <Field
                                key={field.name}
                                field={field}
                                label={labels[field.name]}
                                scale={scale}
                                selected={selected === field.name}
                                onMove={(e) => start(e, field, 'move', page, scale)}
                                onResize={(e) => start(e, field, 'resize', page, scale)}
                            />
                        ))}
                    </Box>
                );
            })}
        </Box>
    );
}

function Field({ field, label, scale, selected, onMove, onResize }: {
    field: Schema;
    label?: string;
    scale: number;
    selected: boolean;
    onMove: (e: React.PointerEvent) => void;
    onResize: (e: React.PointerEvent) => void;
}) {
    const content = typeof field.content === 'string' ? field.content : '';
    const fontSize = Number(field.fontSize ?? 12) * PT_TO_MM * scale;
    return (
        <Box
            data-testid={`field-${field.name}`}
            onPointerDown={onMove}
            sx={{
                position: 'absolute',
                left: field.position.x * scale,
                top: field.position.y * scale,
                width: field.width * scale,
                height: field.height * scale,
                outline: selected ? `2px solid ${c.accent}` : `1px dashed ${c.inkFaint}`,
                cursor: 'move',
                overflow: 'hidden',
            }}
        >
            {field.type === 'text' && (
                <Box
                    sx={{
                        fontFamily: 'Roboto, sans-serif',
                        fontSize,
                        lineHeight: Number(field.lineHeight ?? 1.2),
                        textAlign: (field.alignment as 'left' | 'center' | 'right') ?? 'left',
                        whiteSpace: 'pre-wrap',
                        color: field.readOnly ? '#000' : c.accent,
                    }}
                >
                    {content}
                </Box>
            )}
            {field.type === 'image' && (content.startsWith('data:image/') ? (
                <Box component="img" src={content} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
            ) : (
                <Placeholder icon={<ImageOutlinedIcon fontSize="small" />} label={label} />
            ))}
            {field.type === 'qrcode' && <Placeholder icon={<QrCode2Icon sx={{ fontSize: Math.min(field.width, field.height) * scale * 0.8 }} />} />}
            {selected && (
                <Box
                    data-testid="resize-handle"
                    onPointerDown={onResize}
                    sx={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, bgcolor: c.accent, cursor: 'nwse-resize' }}
                />
            )}
        </Box>
    );
}

function Placeholder({ icon, label }: { icon: React.ReactNode; label?: string }) {
    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, color: c.inkFaint, fontSize: 11, bgcolor: 'rgba(0,0,0,0.03)' }}>
            {icon}
            {label}
        </Box>
    );
}

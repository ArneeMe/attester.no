export const SIGNATURE_WIDTH = 1200;
export const SIGNATURE_HEIGHT = 300;

const PAD_RATIO = 0.06;
const MARGIN_RATIO = 0.02;
const ALPHA_IS_INK = 32;
const ALPHA_MEANS_TRANSPARENT = 250;
const LUMA_IS_INK = 240;

export interface InkBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface Placement {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
}

function hasTransparency(pixels: Uint8ClampedArray): boolean {
    for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] < ALPHA_MEANS_TRANSPARENT) return true;
    }
    return false;
}

export function findInkBounds(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
): InkBounds | null {
    if (width <= 0 || height <= 0) return null;
    const byAlpha = hasTransparency(pixels);

    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const isInk = byAlpha
                ? pixels[i + 3] >= ALPHA_IS_INK
                : pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114 <= LUMA_IS_INK;
            if (!isInk) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
        }
    }

    return right < 0 ? null : { left, top, right, bottom };
}

export function expandBounds(
    bounds: InkBounds,
    width: number,
    height: number,
    ratio = MARGIN_RATIO,
): InkBounds {
    const inkWidth = bounds.right - bounds.left + 1;
    const inkHeight = bounds.bottom - bounds.top + 1;
    const margin = Math.max(1, Math.round(Math.max(inkWidth, inkHeight) * ratio));
    return {
        left: Math.max(0, bounds.left - margin),
        top: Math.max(0, bounds.top - margin),
        right: Math.min(width - 1, bounds.right + margin),
        bottom: Math.min(height - 1, bounds.bottom + margin),
    };
}

export function placeInk(
    bounds: InkBounds,
    outWidth = SIGNATURE_WIDTH,
    outHeight = SIGNATURE_HEIGHT,
    padRatio = PAD_RATIO,
): Placement {
    const sw = bounds.right - bounds.left + 1;
    const sh = bounds.bottom - bounds.top + 1;
    const maxWidth = outWidth * (1 - 2 * padRatio);
    const maxHeight = outHeight * (1 - 2 * padRatio);
    const scale = Math.min(maxWidth / sw, maxHeight / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    return {
        sx: bounds.left,
        sy: bounds.top,
        sw,
        sh,
        dx: (outWidth - dw) / 2,
        dy: (outHeight - dh) / 2,
        dw,
        dh,
    };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('decode failed'));
        img.src = dataUrl;
    });
}

function context(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    return [canvas, ctx];
}

export async function normalizeSignature(dataUrl: string): Promise<string | null> {
    const img = await loadImage(dataUrl);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return null;

    const [, source] = context(width, height);
    source.drawImage(img, 0, 0);
    const bounds = findInkBounds(source.getImageData(0, 0, width, height).data, width, height);
    if (!bounds) return null;

    const p = placeInk(expandBounds(bounds, width, height));
    const [out, target] = context(SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    target.imageSmoothingQuality = 'high';
    target.drawImage(img, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
    return out.toDataURL('image/png');
}

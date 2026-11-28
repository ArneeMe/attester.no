import { describe, expect, it } from 'vitest';
import {
    SIGNATURE_HEIGHT,
    SIGNATURE_WIDTH,
    expandBounds,
    findInkBounds,
    placeInk,
    type InkBounds,
} from './normalizeSignature';

type Rect = { x: number; y: number; w: number; h: number };

function opaqueWhite(width: number, height: number): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(width * height * 4);
    pixels.fill(255);
    return pixels;
}

function transparent(width: number, height: number): Uint8ClampedArray {
    return new Uint8ClampedArray(width * height * 4);
}

function paint(
    pixels: Uint8ClampedArray,
    width: number,
    rect: Rect,
    rgba: [number, number, number, number],
): void {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
        for (let x = rect.x; x < rect.x + rect.w; x++) {
            const i = (y * width + x) * 4;
            pixels[i] = rgba[0];
            pixels[i + 1] = rgba[1];
            pixels[i + 2] = rgba[2];
            pixels[i + 3] = rgba[3];
        }
    }
}

const BLACK: [number, number, number, number] = [0, 0, 0, 255];

describe('findInkBounds', () => {
    it('crops dark strokes out of a white photo', () => {
        const pixels = opaqueWhite(100, 60);
        paint(pixels, 100, { x: 20, y: 10, w: 30, h: 15 }, BLACK);
        expect(findInkBounds(pixels, 100, 60)).toEqual({ left: 20, top: 10, right: 49, bottom: 24 });
    });

    it('uses alpha when the image has transparency', () => {
        const pixels = transparent(100, 60);
        paint(pixels, 100, { x: 5, y: 40, w: 10, h: 10 }, BLACK);
        expect(findInkBounds(pixels, 100, 60)).toEqual({ left: 5, top: 40, right: 14, bottom: 49 });
    });

    it('ignores white ink on a transparent background rather than treating it as empty', () => {
        const pixels = transparent(40, 40);
        paint(pixels, 40, { x: 10, y: 10, w: 8, h: 8 }, [255, 255, 255, 255]);
        expect(findInkBounds(pixels, 40, 40)).toEqual({ left: 10, top: 10, right: 17, bottom: 17 });
    });

    it('returns null for an all-white image', () => {
        expect(findInkBounds(opaqueWhite(50, 50), 50, 50)).toBeNull();
    });

    it('returns null for a fully transparent image', () => {
        expect(findInkBounds(transparent(50, 50), 50, 50)).toBeNull();
    });

    it('returns null for a zero-sized image', () => {
        expect(findInkBounds(new Uint8ClampedArray(0), 0, 0)).toBeNull();
    });

    it('finds ink that touches every edge', () => {
        const pixels = opaqueWhite(10, 10);
        paint(pixels, 10, { x: 0, y: 0, w: 10, h: 10 }, BLACK);
        expect(findInkBounds(pixels, 10, 10)).toEqual({ left: 0, top: 0, right: 9, bottom: 9 });
    });
});

describe('expandBounds', () => {
    it('adds a margin so faint strokes are not clipped', () => {
        const grown = expandBounds({ left: 50, top: 50, right: 149, bottom: 99 }, 300, 300);
        expect(grown).toEqual({ left: 48, top: 48, right: 151, bottom: 101 });
    });

    it('clamps to the source instead of running off the edge', () => {
        const grown = expandBounds({ left: 0, top: 0, right: 99, bottom: 49 }, 100, 50);
        expect(grown).toEqual({ left: 0, top: 0, right: 99, bottom: 49 });
    });

    it('never collapses the margin to zero on a tiny image', () => {
        const grown = expandBounds({ left: 5, top: 5, right: 6, bottom: 6 }, 20, 20);
        expect(grown).toEqual({ left: 4, top: 4, right: 7, bottom: 7 });
    });
});

describe('placeInk', () => {
    const ratio = (b: InkBounds) => placeInk(b).dw / placeInk(b).dh;

    it('centres the ink on the output canvas', () => {
        const p = placeInk({ left: 0, top: 0, right: 399, bottom: 99 });
        expect(p.dx + p.dw / 2).toBeCloseTo(SIGNATURE_WIDTH / 2, 6);
        expect(p.dy + p.dh / 2).toBeCloseTo(SIGNATURE_HEIGHT / 2, 6);
    });

    it('preserves the ink aspect ratio', () => {
        expect(ratio({ left: 0, top: 0, right: 999, bottom: 99 })).toBeCloseTo(10, 6);
        expect(ratio({ left: 0, top: 0, right: 299, bottom: 99 })).toBeCloseTo(3, 6);
    });

    it('keeps the ink inside the padding on both axes', () => {
        for (const b of [
            { left: 0, top: 0, right: 999, bottom: 99 },
            { left: 0, top: 0, right: 99, bottom: 999 },
            { left: 0, top: 0, right: 99, bottom: 99 },
        ]) {
            const p = placeInk(b);
            expect(p.dx).toBeGreaterThanOrEqual(0);
            expect(p.dy).toBeGreaterThanOrEqual(0);
            expect(p.dx + p.dw).toBeLessThanOrEqual(SIGNATURE_WIDTH);
            expect(p.dy + p.dh).toBeLessThanOrEqual(SIGNATURE_HEIGHT);
        }
    });

    it('reads the source rect off the trimmed bounds, not the original image', () => {
        const p = placeInk({ left: 40, top: 12, right: 139, bottom: 61 });
        expect([p.sx, p.sy, p.sw, p.sh]).toEqual([40, 12, 100, 50]);
    });

    it('gives a wide and a narrow signature the same output canvas, which is the whole point', () => {
        const wide = placeInk({ left: 0, top: 0, right: 999, bottom: 99 });
        const narrow = placeInk({ left: 0, top: 0, right: 199, bottom: 99 });
        expect(wide.dy + wide.dh / 2).toBeCloseTo(narrow.dy + narrow.dh / 2, 6);
        expect(SIGNATURE_WIDTH / SIGNATURE_HEIGHT).toBeCloseTo(4, 6);
    });

    it('scales a one-pixel-tall stroke without dividing by zero', () => {
        const p = placeInk({ left: 0, top: 0, right: 99, bottom: 0 });
        expect(Number.isFinite(p.dw)).toBe(true);
        expect(Number.isFinite(p.dh)).toBe(true);
        expect(p.dh).toBeGreaterThan(0);
    });
});

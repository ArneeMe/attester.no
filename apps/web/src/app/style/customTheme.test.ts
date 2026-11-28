import { describe, it, expect, vi } from 'vitest';

const face = () => ({ variable: '--test-font', className: 'test-font' });
vi.mock('next/font/google', () => ({ Source_Serif_4: face, IBM_Plex_Mono: face, Roboto: face }));
vi.mock('next/font/local', () => ({ default: face }));

const { customTheme } = await import('./customTheme');

describe('theme typography does not hardcode colour', () => {
    const inheriting = ['body1', 'body2', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button'] as const;

    for (const variant of inheriting) {
        it(`${variant} leaves colour to the surface`, () => {
            expect(customTheme.typography[variant]).not.toHaveProperty('color');
        });
    }
});

describe('contained buttons keep a readable label', () => {
    it('primary declares a light contrastText', () => {
        expect(customTheme.palette.primary.contrastText).toBe('#fff');
    });

    it('the global anchor rule excludes buttons rendered as anchors', () => {
        const baseline = customTheme.components?.MuiCssBaseline?.styleOverrides as
            | Record<string, unknown>
            | undefined;
        const selectors = Object.keys(baseline ?? {});
        expect(selectors).toContain('a:not(.MuiButtonBase-root)');
        expect(selectors).not.toContain('a');
    });
});

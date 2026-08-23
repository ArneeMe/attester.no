/**
 * Design tokens for the public landing page.
 *
 * The landing page deliberately does NOT use the MUI theme palette. The
 * approved design (Claude Design, "2a") is a warm-paper document look with
 * serif headings, and it demotes the brand green from a fill colour to a
 * text accent — `#1f5c44` here rather than the theme's `#006647`. Keeping
 * these values in one module (instead of reaching into `customTheme`) is
 * what stops the landing page and the admin/form UI from drifting into each
 * other every time one of them is restyled.
 *
 * Scope: only `src/app/page.tsx` and `src/components/landing/*`.
 */
export const landing = {
    /** Page background — warm off-white "paper". */
    paper: '#faf8f3',
    /** Inputs and other surfaces that sit on top of the paper. */
    surface: '#fff',
    /** Primary body text. */
    ink: '#1b1a17',
    /** Hero lede — one step down from `ink`. */
    inkMuted: '#4a4740',
    /** Secondary prose and labels. */
    inkSoft: '#5c584f',
    /** Placeholder text, monospace metadata, footer. */
    inkFaint: '#8a8477',
    /** Section dividers (between the major horizontal bands). */
    rule: '#ddd8cc',
    /** Hairlines inside a section (between steps, list rows, FAQ items). */
    ruleSoft: '#e5e0d5',
    /** Input borders. */
    border: '#cfc8b8',
    /** Underline on the admin login link. */
    borderStrong: '#b9b2a2',
    /** Accent green — step numerals, links, the Verifiser button. */
    accent: '#1f5c44',
    /** Accent on hover. */
    accentHover: '#17452f',
    /** Row hover in the organisation list. */
    rowHover: '#f2efe6',
    /** Hatched placeholder for an organisation with no logo uploaded. */
    logoPlaceholder:
        'repeating-linear-gradient(135deg,#eae6da 0 3px,#f5f2e9 3px 6px)',
} as const;

/**
 * Horizontal padding for every full-width band (header, hero, the two
 * split grids, footer). Kept as one value so the left edges line up.
 */
export const gutter = { xs: 3, md: 6 } as const;

/**
 * Width the "sheet" stops growing at. The design is drawn at 1120px; this
 * leaves some slack above that before the layout is pinned and centred.
 */
export const pageMaxWidth = 1440;

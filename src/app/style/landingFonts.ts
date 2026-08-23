import { IBM_Plex_Mono, Roboto, Source_Serif_4 } from 'next/font/google';

/**
 * Webfonts for the landing page, self-hosted by `next/font` at build time.
 *
 * These are exposed as CSS variables and applied by a single wrapper class on
 * the landing page root, NOT globally. The rest of the app has never loaded a
 * webfont — it renders in the system fallback of MUI's default Roboto stack —
 * and pulling three families into every admin route to style one public page
 * would be a regression in load time for the people who use the app daily.
 */

/** Headings and the wordmark. */
export const sourceSerif = Source_Serif_4({
    subsets: ['latin'],
    weight: ['400', '600'],
    variable: '--landing-font-serif',
    display: 'swap',
    fallback: ['Georgia', 'serif'],
});

/** Slugs, counts, the verify field, and the footer. */
export const plexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500'],
    variable: '--landing-font-mono',
    display: 'swap',
    fallback: ['monospace'],
});

/** Body copy. Matches the family MUI's theme already names. */
export const roboto = Roboto({
    subsets: ['latin'],
    weight: ['400', '500', '700'],
    variable: '--landing-font-body',
    display: 'swap',
    fallback: ['Helvetica', 'Arial', 'sans-serif'],
});

/** Apply to the landing page root to bring the three variables into scope. */
export const landingFontClass = `${sourceSerif.variable} ${plexMono.variable} ${roboto.variable}`;

export const fontSerif = 'var(--landing-font-serif), Georgia, serif';
export const fontMono = 'var(--landing-font-mono), monospace';
export const fontBody = 'var(--landing-font-body), Helvetica, Arial, sans-serif';

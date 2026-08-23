import { IBM_Plex_Mono, Roboto, Source_Serif_4 } from 'next/font/google';

const serif = Source_Serif_4({
    subsets: ['latin'],
    weight: ['400', '600'],
    variable: '--landing-serif',
    display: 'swap',
    fallback: ['Georgia', 'serif'],
});

const mono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500'],
    variable: '--landing-mono',
    display: 'swap',
    fallback: ['monospace'],
});

const body = Roboto({
    subsets: ['latin'],
    weight: ['400', '500', '700'],
    variable: '--landing-body',
    display: 'swap',
    fallback: ['Helvetica', 'Arial', 'sans-serif'],
});

export const landingFontClass = `${serif.variable} ${mono.variable} ${body.variable}`;

export const fontSerif = 'var(--landing-serif), Georgia, serif';
export const fontMono = 'var(--landing-mono), monospace';
export const fontBody = 'var(--landing-body), Helvetica, Arial, sans-serif';

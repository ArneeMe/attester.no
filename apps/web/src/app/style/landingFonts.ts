import localFont from 'next/font/local';

const sourceSerif4 = localFont({
    src: [{ path: '../fonts/source-serif-4-latin-variable.woff2', weight: '400 600', style: 'normal' }],
    variable: '--landing-serif',
    display: 'swap',
    fallback: ['Georgia', 'serif'],
});

const ibmPlexSans = localFont({
    src: [{ path: '../fonts/ibm-plex-sans-latin-variable.woff2', weight: '400 700', style: 'normal' }],
    variable: '--landing-body',
    display: 'swap',
    fallback: ['Helvetica', 'Arial', 'sans-serif'],
});

export const landingFontClass = `${sourceSerif4.variable} ${ibmPlexSans.variable}`;

export const fontSerif = 'var(--landing-serif), Georgia, serif';
export const fontBody = 'var(--landing-body), Helvetica, Arial, sans-serif';
export const fontMono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

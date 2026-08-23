import { fontMono, fontSerif } from '@/app/style/landingFonts';

export const c = {
    paper: '#faf8f3',
    surface: '#fff',
    ink: '#1b1a17',
    inkMuted: '#4a4740',
    inkSoft: '#5c584f',
    inkFaint: '#8a8477',
    rule: '#ddd8cc',
    ruleSoft: '#e5e0d5',
    border: '#cfc8b8',
    borderStrong: '#b9b2a2',
    accent: '#1f5c44',
    accentHover: '#17452f',
    rowHover: '#f2efe6',
    logo: 'repeating-linear-gradient(135deg,#eae6da 0 3px,#f5f2e9 3px 6px)',
} as const;

export const gutter = { xs: 3, md: 6 };
export const pageMaxWidth = 1440;

export const h2 = { m: 0, font: `400 22px/1.3 ${fontSerif}`, color: c.ink };
export const lede = { fontSize: 17, lineHeight: 1.65, color: c.inkMuted };
export const body = { fontSize: 14.5, lineHeight: 1.6, color: c.inkSoft };
export const mono = { font: `400 12.5px/1 ${fontMono}`, color: c.inkFaint };

export const field = {
    height: 38,
    border: `1px solid ${c.border}`,
    borderRadius: '2px',
    background: c.surface,
    px: 1.5,
    color: c.ink,
    '& input::placeholder': { color: c.inkFaint, opacity: 1 },
    '&:focus-within': { borderColor: c.accent },
};

export const dividedRows = {
    '& > * + *': {
        mt: 2.25,
        pt: 2.25,
        borderTop: `1px solid ${c.ruleSoft}`,
    },
};

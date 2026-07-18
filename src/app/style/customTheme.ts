import { createTheme, alpha } from '@mui/material/styles';

// Palette notes:
// - primary stays a deep green — it doubles as the "valid" color on the
//   verify page, so it must read as trustworthy/success.
// - secondary is the pending/neutral accent on the verify page border;
//   a muted amber instead of pure #FFA500 so it doesn't scream.
// - warning keeps its historical dark red (used by legacy admin views).
const green = {
    main: '#00684A',
    dark: '#00543C',
    light: '#3D8B72',
};

export const customTheme = createTheme({
    palette: {
        primary: green,
        secondary: {
            main: '#C77700',
            dark: '#9E5F00',
            light: '#E39A2D',
        },
        warning: {
            main: '#761a19',
        },
        error: {
            main: '#B3261E',
        },
        background: {
            default: '#F7F9F8',
            paper: '#FFFFFF',
        },
        text: {
            primary: '#1C2422',
            secondary: '#54615C',
        },
        divider: '#E3E8E6',
    },
    shape: {
        borderRadius: 10,
    },
    typography: {
        fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            '"Helvetica Neue"',
            'Arial',
            'sans-serif',
        ].join(','),
        h1: { fontWeight: 800, letterSpacing: '-0.02em' },
        h2: { fontWeight: 800, letterSpacing: '-0.02em' },
        h3: { fontWeight: 700, letterSpacing: '-0.015em' },
        h4: { fontWeight: 700, letterSpacing: '-0.01em' },
        h5: { fontWeight: 700 },
        h6: { fontWeight: 600 },
        subtitle1: { fontWeight: 600 },
        button: { fontWeight: 600, textTransform: 'none' },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                // Raw next/link anchors (used all over the public pages)
                // inherit the browser's default blue otherwise.
                a: {
                    color: green.main,
                    textDecorationColor: alpha(green.main, 0.35),
                    textUnderlineOffset: '3px',
                    '&:hover': {
                        textDecorationColor: green.main,
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 999,
                    paddingLeft: 20,
                    paddingRight: 20,
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                // Softer than MUI's default drop shadows.
                elevation1: { boxShadow: '0 1px 3px rgba(28,36,34,0.08)' },
                elevation2: { boxShadow: '0 2px 8px rgba(28,36,34,0.09)' },
            },
        },
    },
});

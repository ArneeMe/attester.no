import { createTheme } from "@mui/material/styles";
import { c } from "@/app/style/tokens";
import { fontBody, fontSerif } from "@/app/style/landingFonts";

// The MUI theme is derived from the same tokens the landing page uses
// (src/app/style/tokens.ts), so the two styling routes cannot drift apart.
//
// This is where design consistency is cheapest to buy: the admin, auth and
// form pages are built almost entirely from stock MUI components — ~80
// <Typography>, ~44 <Button>, ~30 <TextField>, ~27 <Paper>, and only two
// hardcoded colours between them. Setting palette, typography and component
// defaults here restyles all of it without touching those files. Prefer
// adding a default here over sx overrides scattered across pages.
//
// Font variables come from landingFonts and are attached to <html> in
// src/app/layout.tsx — not in PageShell — so they resolve on every page.

export const customTheme = createTheme({
    palette: {
        primary: { main: c.accent, dark: c.accentHover, contrastText: '#fff' },
        secondary: { main: '#8a6d1f' },
        warning: { main: '#761a19' },
        error: { main: '#8c2f2c' },
        background: { default: c.paper, paper: c.surface },
        text: { primary: c.ink, secondary: c.inkSoft, disabled: c.inkFaint },
        divider: c.rule,
    },

    // 2px, matching the `field` token. The landing page's flat, papery look
    // depends on corners staying nearly square.
    shape: { borderRadius: 2 },

    typography: {
        fontFamily: fontBody,
        // Headings are the serif; body copy is not. Sizes track the landing
        // page's h1/h2 rather than MUI's defaults, which run much larger.
        h1: { fontFamily: fontSerif, fontWeight: 400, fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.15, letterSpacing: '-0.01em' },
        h2: { fontFamily: fontSerif, fontWeight: 400, fontSize: 26, lineHeight: 1.25 },
        h3: { fontFamily: fontSerif, fontWeight: 400, fontSize: 22, lineHeight: 1.3 },
        h4: { fontFamily: fontSerif, fontWeight: 400, fontSize: 19, lineHeight: 1.35 },
        h5: { fontWeight: 500, fontSize: 16.5 },
        h6: { fontWeight: 500, fontSize: 15.5 },
        body1: { fontSize: 15, lineHeight: 1.6, color: c.inkSoft },
        body2: { fontSize: 14, lineHeight: 1.6, color: c.inkSoft },
        button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0 },
    },

    components: {
        MuiCssBaseline: {
            styleOverrides: {
                // Plain <a> and next/link render real anchors, which MuiLink's
                // overrides never touch — without this they stay browser-blue
                // on every page that does not set a colour by hand (all of
                // admin and auth). Only the colour is set: anchors keep the
                // browser's underline, which is the accessible default and
                // what the landing page already looks like.
                a: { color: c.accent, '&:hover': { color: c.accentHover } },
            },
        },

        // Flat by default. The design has no elevation; borders carry the
        // structure instead, so shadows read as a different product.
        MuiPaper: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: { backgroundImage: 'none' },
                outlined: { borderColor: c.rule },
            },
        },
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: { minHeight: 38, paddingInline: 18 },
                containedPrimary: {
                    '&:hover': { backgroundColor: c.accentHover },
                },
                outlined: {
                    borderColor: c.border,
                    color: c.ink,
                    '&:hover': { borderColor: c.accent, backgroundColor: c.rowHover },
                },
                text: { '&:hover': { backgroundColor: c.rowHover } },
            },
        },
        MuiTextField: {
            defaultProps: { size: 'small' },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    backgroundColor: c.surface,
                    '& fieldset': { borderColor: c.border },
                    '&:hover fieldset': { borderColor: c.borderStrong },
                    '&.Mui-focused fieldset': { borderColor: c.accent, borderWidth: 1 },
                },
                input: { '&::placeholder': { color: c.inkFaint, opacity: 1 } },
            },
        },
        MuiInputLabel: {
            styleOverrides: { root: { color: c.inkSoft, '&.Mui-focused': { color: c.accent } } },
        },
        MuiLink: {
            defaultProps: { underline: 'hover' },
            styleOverrides: { root: { color: c.accent } },
        },
        MuiTableCell: {
            styleOverrides: {
                root: { borderColor: c.ruleSoft },
                head: { fontWeight: 500, color: c.inkMuted },
            },
        },
        MuiChip: {
            styleOverrides: { outlined: { borderColor: c.border } },
        },
        MuiDialog: {
            styleOverrides: { paper: { border: `1px solid ${c.rule}` } },
        },
        MuiTab: {
            styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } },
        },
        MuiDivider: {
            styleOverrides: { root: { borderColor: c.ruleSoft } },
        },
    },
});

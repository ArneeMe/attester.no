'use client'
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {customTheme} from "@/app/style/customTheme";
import { ToastProvider } from '@/components/ToastProvider';

// CssBaseline is what makes the theme's background and typography reach every
// page: it resets the browser's 8px body margin and paints
// palette.background.default. PageShell used to do both itself with scoped
// GlobalStyles; that is now redundant. Removing CssBaseline would leave the
// admin and auth pages on plain white with a white gutter.
const RootLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <ThemeProvider theme={customTheme}>
            <CssBaseline />
            <ToastProvider>
                {children}
            </ToastProvider>
        </ThemeProvider>
    );
};

export default RootLayout;

'use client'
import { ThemeProvider } from '@mui/material/styles';
import {customTheme} from "@/app/style/customTheme";
import { ToastProvider } from '@/components/ToastProvider';

const RootLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <ThemeProvider theme={customTheme}>
            <ToastProvider>
                {children}
            </ToastProvider>
        </ThemeProvider>
    );
};

export default RootLayout;
import RootLayoutProvider from '@/app/style/rootLayout';
import {Suspense} from "react";

export const metadata = {
    title: {
        default: 'attester.no',
        template: '%s – attester.no',
    },
    description: 'Digitalt verifiserbare attester for frivillige – uten at personopplysninger lagres.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="no">
            <body>
                <RootLayoutProvider>
                    <Suspense fallback={<div>Laster...</div>}>
                        {children}
                    </Suspense>
                </RootLayoutProvider>
            </body>
        </html>
    );
}

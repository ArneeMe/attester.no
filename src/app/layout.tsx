import RootLayoutProvider from '@/app/style/rootLayout';
import {Suspense} from "react";

export const metadata = {
    title: 'echo Attest',
    description: 'Lag og verifiser attester for echo!',
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="nb">
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

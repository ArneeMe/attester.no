import type { Metadata } from 'next';
import RootLayoutProvider from '@/app/style/rootLayout';
import {Suspense} from "react";
import { SITE_URL } from '@/util/seo';
import { landingFontClass } from '@/app/style/landingFonts';

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: 'attester.no | digital attest for frivillige',
        template: '%s | attester.no',
    },
    description: 'Lag, utsted og verifiser attester for frivillig arbeid. Digital frivillighetsattest med QR-kode, uten at personopplysninger lagres.',
    keywords: [
        'attest frivillig arbeid',
        'frivillighetsattest',
        'attest mal frivillig organisasjon',
        'digital attest',
        'verifiserbar attest',
        'attest med QR-kode',
        'volunteer certificate',
    ],
    openGraph: {
        siteName: 'attester.no',
        type: 'website',
        locale: 'nb_NO',
    },
    twitter: {
        card: 'summary',
    },
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="no" className={landingFontClass}>
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

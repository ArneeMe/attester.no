import React from 'react';
import type { Metadata } from 'next';
import { Box } from '@mui/material';
import { fontBody, fontSerif, landingFontClass } from '@/app/style/landingFonts';
import LandingHeader from '@/components/landing/LandingHeader';
import OrgPicker from '@/components/landing/OrgPicker';
import SplitSection from '@/components/landing/SplitSection';
import VerifyLinkForm from '@/components/landing/VerifyLinkForm';
import { body, c, dividedRows, gutter, h2, lede, mono, pageMaxWidth } from '@/components/landing/tokens';

export const metadata: Metadata = {
    title: 'attester.no',
    description:
        'attester.no lager bevis for fullførte verv, arbeid eller kurs. Hver attest får en kode for å bevise at det er ekte.',
};

const STEPS = [
    ['I', 'Du sender inn', 'Navn, verv og tidsperiode i organisasjonens skjema.'],
    ['II', 'Organisasjonen godkjenner', 'En admin ser over innsendingen, lager attesten og sletter dataene dine etterpå.'],
    ['III', 'Attesten kan etterprøves', 'Koden i attesten fører til en side som sammenligner innholdet med det som ble utstedt.'],
];

const FAQ = [
    ['Hva lagrer dere om meg?', 'En hash av innholdet, hvilken mal som ble brukt, organisasjonen og tidspunktet. Ingen navn, verv eller datoer.'],
    ['Organisasjonen min mangler', 'Da er de ikke satt opp ennå. Send oss en epost, eller be dem gjøre det.'],
];

export default function Home() {
    return (
        <Box
            className={landingFontClass}
            sx={{ minHeight: '100vh', background: c.paper, color: c.ink, fontFamily: fontBody }}
        >
            <Box sx={{ maxWidth: pageMaxWidth, mx: 'auto' }}>
                <LandingHeader />

                <Box
                    component="section"
                    sx={{
                        px: gutter,
                        pt: { xs: 6, md: 9 },
                        pb: { xs: 5, md: 7 },
                        borderBottom: `1px solid ${c.rule}`,
                    }}
                >
                    <Box sx={{ maxWidth: 640 }}>
                        <Box
                            component="h1"
                            sx={{
                                m: 0,
                                font: `400 clamp(32px, 4vw, 44px)/1.15 ${fontSerif}`,
                                letterSpacing: '-0.01em',
                            }}
                        >
                            En attest er verdt noe bare hvis den kan etterprøves.
                        </Box>
                        <Box component="p" sx={{ ...lede, mt: 3, mb: 0 }}>
                            attester.no lager bevis for fullførte verv, arbeid eller kurs. Hver
                            attest får en kode for å bevise at det er ekte.
                        </Box>
                    </Box>
                </Box>

                <SplitSection
                    py={5.5}
                    left={
                        <>
                            <Box component="ol" sx={{ ...dividedRows, listStyle: 'none', m: 0, p: 0 }}>
                                {STEPS.map(([numeral, title, text]) => (
                                    <Box
                                        component="li"
                                        key={numeral}
                                        sx={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 2 }}
                                    >
                                        <Box
                                            aria-hidden
                                            sx={{ font: `400 20px/1.3 ${fontSerif}`, color: c.accent }}
                                        >
                                            {numeral}
                                        </Box>
                                        <Box>
                                            <Box sx={{ fontSize: 16, fontWeight: 500 }}>{title}</Box>
                                            <Box component="p" sx={{ ...body, mt: 0.75, mb: 0 }}>
                                                {text}
                                            </Box>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>

                            <Box sx={{ mt: 5, pt: 3.5, borderTop: `1px solid ${c.ruleSoft}` }}>
                                <Box component="h2" sx={h2}>
                                    For organisasjoner
                                </Box>
                                <Box component="p" sx={{ ...body, mt: 1.25, mb: 1.75 }}>
                                    Vil dere utstede attester til deres frivillige? Vi setter opp
                                    organisasjon, maler og administratorer.
                                </Box>
                                <Box
                                    component="a"
                                    href="mailto:hei@attester.no"
                                    sx={{ fontSize: 14.5, color: c.accent }}
                                >
                                    hei@attester.no
                                </Box>
                            </Box>
                        </>
                    }
                    right={<OrgPicker />}
                />

                <SplitSection
                    py={5}
                    left={<VerifyLinkForm />}
                    right={
                        <Box component="dl" sx={{ ...dividedRows, m: 0 }}>
                            {FAQ.map(([question, answer]) => (
                                <Box key={question}>
                                    <Box component="dt" sx={{ fontSize: 15, fontWeight: 500 }}>
                                        {question}
                                    </Box>
                                    <Box
                                        component="dd"
                                        sx={{ ...body, fontSize: 14, mt: 0.75, mx: 0, mb: 0 }}
                                    >
                                        {answer}
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    }
                />

                <Box
                    component="footer"
                    sx={{
                        ...mono,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 2,
                        px: gutter,
                        py: 2.5,
                    }}
                >
                    <span>attester.no</span>
                    <Box component="a" href="mailto:hei@attester.no" sx={{ color: 'inherit' }}>
                        hei@attester.no
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

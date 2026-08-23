import React from 'react';
import type { Metadata } from 'next';
import { Box } from '@mui/material';
import { fontBody, fontMono, fontSerif, landingFontClass } from '@/app/style/landingFonts';
import LandingHeader from '@/components/landing/LandingHeader';
import OrgPicker from '@/components/landing/OrgPicker';
import SplitSection from '@/components/landing/SplitSection';
import VerifyLinkForm from '@/components/landing/VerifyLinkForm';
import { gutter, landing, pageMaxWidth } from '@/components/landing/tokens';

export const metadata: Metadata = {
    title: 'attester.no',
    description:
        'attester.no lager bevis for fullførte verv, arbeid eller kurs. Hver attest får en kode for å bevise at det er ekte.',
};

/** The three things that happen to an attest, in order. */
const STEPS = [
    {
        numeral: 'I',
        title: 'Du sender inn',
        body: 'Navn, verv og tidsperiode i organisasjonens skjema.',
    },
    {
        numeral: 'II',
        title: 'Organisasjonen godkjenner',
        body: 'En admin ser over innsendingen, lager attesten og sletter dataene dine etterpå.',
    },
    {
        numeral: 'III',
        title: 'Attesten kan etterprøves',
        body: 'Koden i attesten fører til en side som sammenligner innholdet med det som ble utstedt.',
    },
];

const FAQ = [
    {
        q: 'Hva lagrer dere om meg?',
        a: 'En hash av innholdet, hvilken mal som ble brukt, organisasjonen og tidspunktet. Ingen navn, verv eller datoer.',
    },
    {
        q: 'Organisasjonen min mangler',
        a: 'Da er de ikke satt opp ennå. Send oss en epost, eller be dem gjøre det.',
    },
];

const Steps: React.FC = () => (
    <Box component="ol" sx={{ listStyle: 'none', display: 'flex', flexDirection: 'column', m: 0, p: 0 }}>
        {STEPS.map((step, i) => (
            <Box
                component="li"
                key={step.numeral}
                sx={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr',
                    gap: 2,
                    pt: i === 0 ? 0 : 2.25,
                    pb: i === STEPS.length - 1 ? 0 : 2.25,
                    borderTop: i === 0 ? 'none' : `1px solid ${landing.ruleSoft}`,
                }}
            >
                <Box aria-hidden sx={{ font: `400 20px/1.3 ${fontSerif}`, color: landing.accent }}>
                    {step.numeral}
                </Box>
                <Box>
                    <Box sx={{ fontSize: 16, fontWeight: 500 }}>{step.title}</Box>
                    <Box
                        component="p"
                        sx={{ mt: 0.75, mb: 0, fontSize: 14.5, lineHeight: 1.6, color: landing.inkSoft }}
                    >
                        {step.body}
                    </Box>
                </Box>
            </Box>
        ))}
    </Box>
);

const ForOrganisations: React.FC = () => (
    <Box sx={{ mt: 5, pt: 3.5, borderTop: `1px solid ${landing.ruleSoft}` }}>
        <Box component="h2" sx={{ m: 0, font: `400 22px/1.3 ${fontSerif}` }}>
            For organisasjoner
        </Box>
        <Box
            component="p"
            sx={{ mt: 1.25, mb: 1.75, fontSize: 14.5, lineHeight: 1.6, color: landing.inkSoft }}
        >
            Vil dere utstede attester til deres frivillige? Vi setter opp organisasjon, maler og
            administratorer.
        </Box>
        <Box
            component="a"
            href="mailto:hei@attester.no"
            sx={{ fontSize: 14.5, color: landing.accent }}
        >
            hei@attester.no
        </Box>
    </Box>
);

const Faq: React.FC = () => (
    <Box component="dl" sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, m: 0 }}>
        {FAQ.map((item, i) => (
            <Box
                key={item.q}
                sx={{
                    pt: i === 0 ? 0 : 2.25,
                    borderTop: i === 0 ? 'none' : `1px solid ${landing.ruleSoft}`,
                }}
            >
                <Box component="dt" sx={{ fontSize: 15, fontWeight: 500 }}>
                    {item.q}
                </Box>
                <Box
                    component="dd"
                    sx={{ mt: 0.75, mx: 0, mb: 0, fontSize: 14, lineHeight: 1.6, color: landing.inkSoft }}
                >
                    {item.a}
                </Box>
            </Box>
        ))}
    </Box>
);

export default function Home() {
    return (
        <Box
            className={landingFontClass}
            sx={{
                minHeight: '100vh',
                background: landing.paper,
                color: landing.ink,
                fontFamily: fontBody,
            }}
        >
            {/*
              * The design is a 1120px artboard and the bands are meant to read
              * as one sheet of paper. Letting them bleed to the full width of a
              * 27" monitor would stretch each half-column of 14.5px prose to a
              * line length nobody can track, so the sheet is capped and centred
              * past `pageMaxWidth` instead.
              */}
            <Box sx={{ maxWidth: pageMaxWidth, mx: 'auto' }}>
                <LandingHeader />

                <Box
                    component="section"
                    sx={{
                        px: gutter,
                        pt: { xs: 6, md: 9 },
                        pb: { xs: 5, md: 7 },
                        borderBottom: `1px solid ${landing.rule}`,
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
                        <Box
                            component="p"
                            sx={{ mt: 3, mb: 0, fontSize: 17, lineHeight: 1.65, color: landing.inkMuted }}
                        >
                            attester.no lager bevis for fullførte verv, arbeid eller kurs. Hver attest
                            får en kode for å bevise at det er ekte.
                        </Box>
                    </Box>
                </Box>

                <SplitSection
                    py={5.5}
                    left={
                        <>
                            <Steps />
                            <ForOrganisations />
                        </>
                    }
                    right={<OrgPicker />}
                />

                <SplitSection py={5} left={<VerifyLinkForm />} right={<Faq />} />

                <Box
                    component="footer"
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 2,
                        px: gutter,
                        py: 2.5,
                        font: `400 12.5px/1 ${fontMono}`,
                        color: landing.inkFaint,
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

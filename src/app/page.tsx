import Link from 'next/link';
import {
    Box, Button, Chip, Container, Divider, Paper, Stack, Typography,
} from '@mui/material';
import { listPublicOrgs, type PublicOrg } from '@/lib/server/orgs';

export const runtime = 'edge';

const STEPS = [
    {
        title: '1. Fyll ut skjema',
        text: 'Den frivillige fyller ut organisasjonens skjema med navn, verv og tidsperiode.',
    },
    {
        title: '2. Attesten utstedes',
        text: 'Organisasjonen kontrollerer innholdet og genererer en PDF med QR-kode. Innsendingen slettes automatisk i samme øyeblikk.',
    },
    {
        title: '3. Hvem som helst kan verifisere',
        text: 'QR-koden peker til en verifiseringsside som bekrefter at attesten er ekte og uendret.',
    },
];

export default async function Home() {
    let orgs: PublicOrg[] = [];
    try {
        orgs = await listPublicOrgs();
    } catch {
        // Directory is a nice-to-have — the landing page must render even
        // if the database is unreachable.
    }

    return (
        <Container maxWidth="md" sx={{ py: 8 }}>
            <Stack spacing={6}>
                <Box>
                    <Typography variant="h2" component="h1" gutterBottom>
                        attester.no
                    </Typography>
                    <Typography variant="h5" color="text.secondary">
                        Digitalt verifiserbare attester for frivillige –
                        uten at personopplysninger lagres.
                    </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    {STEPS.map((step) => (
                        <Paper key={step.title} elevation={2} sx={{ p: 3, flex: 1 }}>
                            <Typography variant="h6" gutterBottom>{step.title}</Typography>
                            <Typography variant="body2" color="text.secondary">{step.text}</Typography>
                        </Paper>
                    ))}
                </Stack>

                <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50' }}>
                    <Typography variant="h6" gutterBottom>Personvern er hele poenget</Typography>
                    <Typography variant="body1" color="text.secondary">
                        Databasen lagrer aldri navn, verv eller datoer – kun en
                        kryptografisk hash av attestens innhold. Lekker databasen,
                        lekker ingen personopplysninger. Bare den som har attesten
                        (eller QR-koden på den) vet hva som ble attestert.
                    </Typography>
                </Paper>

                {orgs.length > 0 && (
                    <Box>
                        <Typography variant="h6" gutterBottom>Deltakende organisasjoner</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Skal du be om en attest? Gå til skjemaet til organisasjonen din:
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {orgs.map((org) => (
                                <Chip
                                    key={org.slug}
                                    label={org.name}
                                    component={Link}
                                    href={`/org/${encodeURIComponent(org.slug)}`}
                                    clickable
                                />
                            ))}
                        </Stack>
                    </Box>
                )}

                <Divider />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <Button component={Link} href="/login" variant="outlined">
                        Logg inn som administrator
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                        Vil organisasjonen din ta i bruk attester.no?{' '}
                        <Link href="https://github.com/ArneeMe/attester.no" target="_blank" rel="noreferrer">
                            Ta kontakt på GitHub
                        </Link>.
                    </Typography>
                </Stack>
            </Stack>
        </Container>
    );
}

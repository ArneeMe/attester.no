import { expect, test, type Page } from '@playwright/test';

async function fillRequired(page: Page) {
    await page.getByLabel('Organisasjonsnavn').fill('Ærlig Ålesund Øst');
    await page.getByLabel('E-post').fill('styret@example.no');
}

test('the slug is suggested from the organisation name, folding Norwegian letters', async ({ page }) => {
    await page.goto('/ny-organisasjon');
    await page.getByLabel('Organisasjonsnavn').fill('Ærlig Ålesund Øst');
    await expect(page.getByLabel('Nettadresse')).toHaveValue('aerlig-alesund-ost', { timeout: 30000 });
});

test('editing the slug stops it tracking the name', async ({ page }) => {
    await page.goto('/ny-organisasjon');
    await page.getByLabel('Organisasjonsnavn').fill('Første Navn');
    await expect(page.getByLabel('Nettadresse')).toHaveValue('forste-navn', { timeout: 30000 });

    await page.getByLabel('Nettadresse').fill('mitt-valg');
    await page.getByLabel('Organisasjonsnavn').fill('Helt Annet Navn');
    await expect(page.getByLabel('Nettadresse')).toHaveValue('mitt-valg');
});

test('a sent request shows the confirmation instead of the form', async ({ page }) => {
    await page.route('**/api/org-requests', (route) => route.fulfill({ json: { received: true } }));
    await page.goto('/ny-organisasjon');
    await fillRequired(page);
    await page.getByRole('button', { name: 'Send forespørsel' }).click();

    await expect(page.getByText('Takk – vi har fått forespørselen')).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel('Organisasjonsnavn')).toHaveCount(0);
});

test('a taken slug reports against the slug field, not as a generic failure', async ({ page }) => {
    await page.route('**/api/org-requests', (route) =>
        route.fulfill({ status: 409, json: { error: 'slug_taken', field: 'slug' } }),
    );
    await page.goto('/ny-organisasjon');
    await fillRequired(page);
    await page.getByRole('button', { name: 'Send forespørsel' }).click();

    await expect(page.getByText('Adressen er allerede i bruk')).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel('Nettadresse')).toHaveAttribute('aria-invalid', 'true');
});

test('the organisation number takes nine digits and nothing else', async ({ page }) => {
    await page.goto('/ny-organisasjon');
    const orgNumber = page.getByLabel('Organisasjonsnummer');
    await expect(orgNumber).toBeVisible({ timeout: 30000 });

    await orgNumber.fill('');
    await orgNumber.pressSequentially('9236090161234');
    await expect(orgNumber).toHaveValue('923609016');

    await orgNumber.fill('');
    await orgNumber.pressSequentially('92a3b6c0 9016');
    await expect(orgNumber).toHaveValue('923609016');
});

test('a bad organisation number reports against its own field', async ({ page }) => {
    await page.route('**/api/org-requests', (route) =>
        route.fulfill({ status: 400, json: { error: 'bad_org_number', field: 'orgNumber' } }),
    );
    await page.goto('/ny-organisasjon');
    await fillRequired(page);
    await page.getByLabel('Organisasjonsnummer').fill('123456789');
    await page.getByRole('button', { name: 'Send forespørsel' }).click();

    await expect(page.getByText('Ugyldig organisasjonsnummer')).toBeVisible({ timeout: 30000 });
});

test('a server failure is reported without losing what was typed', async ({ page }) => {
    await page.route('**/api/org-requests', (route) => route.abort());
    await page.goto('/ny-organisasjon');
    await fillRequired(page);
    await page.getByRole('button', { name: 'Send forespørsel' }).click();

    await expect(
        page.getByText('Noe gikk galt. Prøv igjen, eller send oss en e-post.'),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel('Organisasjonsnavn')).toHaveValue('Ærlig Ålesund Øst');
});

test('?lang=en renders the English form', async ({ page }) => {
    await page.goto('/ny-organisasjon?lang=en');
    await expect(page.getByLabel('Organization name')).toBeVisible({ timeout: 30000 });
});

test('the landing FAQ and the empty picker both route here', async ({ page }) => {
    await page.route('**/api/org*', (route) => route.fulfill({ json: { organizations: [] } }));
    await page.goto('/');

    await expect(
        page.getByRole('link', { name: /Sett opp organisasjonen din/ }).first(),
    ).toHaveAttribute('href', '/ny-organisasjon', { timeout: 30000 });
});

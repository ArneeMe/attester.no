import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page) {
    const exp = Math.floor(Date.now() / 1000) + 900;
    await page.addInitScript(([key, session]) => window.localStorage.setItem(key as string, JSON.stringify(session)), ['nhostSession', {
        accessToken: 'e2e-access-token', accessTokenExpiresIn: 900,
        refreshTokenId: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24', refreshToken: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
        user: { id: '00000000-0000-0000-0000-000000000001', email: 'admin@example.com', displayName: 'E2E Admin', roles: ['user'] },
        decodedToken: { exp, sub: '00000000-0000-0000-0000-000000000001' },
    }] as const);
    await page.route('**/*.nhost.run/**', (route) => route.abort());
    await page.route('**/api/v1/me/organizations', (route) =>
        route.fulfill({ json: { organizations: [{ id: 'org-1', slug: 'testorg', name: 'Testorg', role: 'admin', pending: 0 }] } }));
    await page.route('**/api/v1/org/testorg/templates', (route) => route.fulfill({ json: { templates: [] } }));
    await page.route('**/api/v1/org/testorg/assets', (route) => route.fulfill({ json: { assets: [] } }));
    await page.route('**/api/v1/org/testorg/settings', (route) => route.fulfill({ json: {} }));
    await page.goto('/login/adminpage/testorg/edit_pdf');
    await page.getByRole('button', { name: 'Start fra en ferdig mal' }).click({ timeout: 60000 });
    await page.locator('.MuiDialog-root .MuiCardActionArea-root').first().click();
}

test('the editor walks through look, content, form and save, in that order', async ({ page }) => {
    await openEditor(page);
    const headings = page.getByRole('heading', { level: 2 });
    await expect(headings).toHaveText(['Utseende', 'Innhold', 'Skjema', 'Lagre'], { timeout: 30000 });
});

test('each field is one plain line, with its settings closed until asked for', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByText('Fast tekst: «Kursbevis»')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Fra skjemaet: Mottakers navn')).toBeVisible();
    await expect(page.getByText('Fra Innhold: signatur nr. 1 (bilde)')).toBeVisible();
    await expect(page.getByText('Fylles inn automatisk: QR-koden')).toBeVisible();
    await expect(page.getByText(/^Skriv teksten\. Sett/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Endre: recipient' }).click();
    await expect(page.getByText(/^Skriv teksten\. Sett/)).toHaveCount(1);
    await page.getByRole('button', { name: 'Ferdig: recipient' }).click();
    await expect(page.getByText(/^Skriv teksten\. Sett/)).toHaveCount(0);
});

test('text typed in the drawing is shown as fixed text, not as a missing form field', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByText('Fast tekst, skrevet i tegningen: «attester.no»')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Skjemaet har ikke dette feltet')).toHaveCount(0);
});

test('a field that points at a form field the form lacks is flagged', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByText('Fra skjemaet: Kursnavn')).toBeVisible({ timeout: 30000 });
    const course = page.getByLabel('Navn i malen').nth(1);
    await expect(course).toHaveValue('course');
    await course.fill('kurs');
    await expect(page.getByText('Skjemaet har ikke dette feltet, så det blir tomt på attesten.')).toBeVisible();
});

test('a signature is numbered from one', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Endre: signature_photo' }).click({ timeout: 30000 });
    await expect(page.getByLabel('Nummer')).toHaveValue('1');
    await page.getByLabel('Nummer').fill('2');
    await expect(page.getByText('Fra Innhold: signatur nr. 2 (bilde)')).toBeVisible();
});

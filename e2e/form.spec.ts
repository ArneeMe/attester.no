import { expect, test } from '@playwright/test';

const ORG = 'testorg';

const TEMPLATE = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Standardattest',
    form_schema: [
        { key: 'name', label: 'Navn', type: 'text' },
        { key: 'start', label: 'Fra dato', type: 'date' },
        { key: 'notat', label: 'Notat', type: 'text', optional: true },
    ],
};

test.beforeEach(async ({ page }) => {
    await page.route(`**/api/org/${ORG}`, (route) =>
        route.fulfill({ json: { organization: { id: 'org-1', slug: ORG, name: 'Testorg' } } }),
    );
    await page.route(`**/api/org/${ORG}/default-template`, (route) =>
        route.fulfill({ json: { template: TEMPLATE } }),
    );
});

test('empty required fields show inline errors and block submission', async ({ page }) => {
    await page.goto(`/org/${ORG}`);
    await expect(page.getByText('Søk om attest til Testorg')).toBeVisible();

    await page.getByRole('button', { name: 'Send inn' }).click();

    // Two required fields empty → two inline errors; the optional one none.
    await expect(page.getByText('Må fylles ut')).toHaveCount(2);
    await expect(page.getByText('Bekreft innsending')).not.toBeVisible();
});

test('valid submission reaches the confirmation screen', async ({ page }) => {
    await page.route(`**/api/org/${ORG}/submissions`, (route) =>
        route.fulfill({ json: { submission: { id: 'sub-1', created_at: '2026-07-11T00:00:00Z' } } }),
    );

    await page.goto(`/org/${ORG}`);
    await page.getByLabel('Navn').fill('Ola Nordmann');
    await page.getByLabel('Fra dato').fill('2026-01-15');
    await page.getByRole('button', { name: 'Send inn' }).click();

    await expect(page.getByText('Bekreft innsending')).toBeVisible();
    await page.getByRole('button', { name: 'Ja, lagre' }).click();

    await expect(page.getByText('Innsendingen er mottatt')).toBeVisible();
    await expect(page.getByText(/sletter Testorg opplysningene dine/)).toBeVisible();
});

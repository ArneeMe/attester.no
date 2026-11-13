import { expect, test, type Page } from '@playwright/test';

const ORG = 'testorg';
const TEMPLATE = {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Standardattest',
    form_schema: [{ key: 'name', label: 'Navn', type: 'text' }],
};

// 01.01.80 with month + 80: Skatteetaten's synthetic range, valid control digits.
const VALID_ID = '01818099912';

function controlDigitsOk(id: string): boolean {
    const d = [...id].map(Number);
    const k1 = [3, 7, 6, 1, 8, 9, 4, 5, 2];
    const k2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const c = (w: number[]) => (11 - (w.reduce((a, x, i) => a + x * d[i], 0) % 11)) % 11;
    return c(k1) === d[9] && c(k2) === d[10];
}

async function setup(page: Page, digipost: boolean) {
    await page.route(`**/api/v1/org/${ORG}`, (route) =>
        route.fulfill({ json: { organization: { id: 'org-1', slug: ORG, name: 'Testorg' }, digipost } }),
    );
    await page.route(`**/api/v1/org/${ORG}/offered-templates`, (route) =>
        route.fulfill({ json: { templates: [{ id: TEMPLATE.id, name: TEMPLATE.name, description: null }] } }),
    );
    await page.route(`**/api/v1/org/${ORG}/templates/${TEMPLATE.id}*`, (route) =>
        route.fulfill({ json: { template: TEMPLATE } }),
    );
}

async function submit(page: Page) {
    const bodies: unknown[] = [];
    await page.route(`**/api/v1/org/${ORG}/submissions`, (route) => {
        bodies.push(route.request().postDataJSON());
        return route.fulfill({ json: { submission: { id: 'sub-1', created_at: '2026-11-13T00:00:00Z' } } });
    });
    return bodies;
}

test('the fixture number is a valid fødselsnummer', () => {
    expect(controlDigitsOk(VALID_ID)).toBe(true);
});

test('an org without Digipost never asks for a fødselsnummer', async ({ page }) => {
    await setup(page, false);
    await page.goto(`/org/${ORG}`);
    await expect(page.getByText('Søk om attest til Testorg')).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel('Fødselsnummer (valgfritt)')).toHaveCount(0);
});

test('the fødselsnummer travels beside the certificate data, never inside it', async ({ page }) => {
    await setup(page, true);
    const bodies = await submit(page);
    await page.goto(`/org/${ORG}`);
    await page.getByLabel('Fødselsnummer (valgfritt)').fill(VALID_ID, { timeout: 30000 });
    await page.getByLabel('Navn').fill('Ola Nordmann');
    await page.getByRole('button', { name: 'Send inn' }).click();
    await page.getByRole('button', { name: 'Ja, lagre' }).click();
    await expect(page.getByText('Innsendingen er mottatt')).toBeVisible();

    expect(bodies).toEqual([{ templateId: TEMPLATE.id, data: { name: 'Ola Nordmann' }, nationalId: VALID_ID }]);
});

test('leaving the field empty sends no fødselsnummer', async ({ page }) => {
    await setup(page, true);
    const bodies = await submit(page);
    await page.goto(`/org/${ORG}`);
    await page.getByLabel('Navn').fill('Ola Nordmann', { timeout: 30000 });
    await page.getByRole('button', { name: 'Send inn' }).click();
    await page.getByRole('button', { name: 'Ja, lagre' }).click();
    await expect(page.getByText('Innsendingen er mottatt')).toBeVisible();

    expect(bodies).toEqual([{ templateId: TEMPLATE.id, data: { name: 'Ola Nordmann' } }]);
});

test('a mistyped fødselsnummer stops the submission', async ({ page }) => {
    await setup(page, true);
    const bodies = await submit(page);
    await page.goto(`/org/${ORG}`);
    await page.getByLabel('Fødselsnummer (valgfritt)').fill('12345678901', { timeout: 30000 });
    await page.getByLabel('Navn').fill('Ola Nordmann');
    await page.getByRole('button', { name: 'Send inn' }).click();

    await expect(page.getByText('Dette er ikke et gyldig fødselsnummer')).toBeVisible();
    await expect(page.getByText('Bekreft innsending')).not.toBeVisible();
    expect(bodies).toEqual([]);
});

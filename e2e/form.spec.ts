import { expect, test, type Page } from '@playwright/test';

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

const SECOND = {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Kursbevis',
    form_schema: [{ key: 'kurs', label: 'Kursnavn', type: 'text' }],
};

async function mockOrg(page: Page) {
    await page.route(`**/api/org/${ORG}`, (route) =>
        route.fulfill({ json: { organization: { id: 'org-1', slug: ORG, name: 'Testorg' } } }),
    );
    await page.route(`**/api/org/${ORG}/templates/${TEMPLATE.id}*`, (route) =>
        route.fulfill({ json: { template: TEMPLATE } }),
    );
    await page.route(`**/api/org/${ORG}/templates/${SECOND.id}*`, (route) =>
        route.fulfill({ json: { template: SECOND } }),
    );
}

async function mockOffered(page: Page, templates: Array<{ id: string; name: string }>) {
    await page.route(`**/api/org/${ORG}/offered-templates`, (route) =>
        route.fulfill({
            json: { templates: templates.map((t) => ({ id: t.id, name: t.name, description: null })) },
        }),
    );
}

test.beforeEach(async ({ page }) => {
    await mockOrg(page);
    await mockOffered(page, [TEMPLATE]);
});

test('empty required fields show inline errors and block submission', async ({ page }) => {
    await page.goto(`/org/${ORG}`);
    await expect(page.getByText('Søk om attest til Testorg')).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Send inn' }).click();

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
    await expect(page.getByText(/slettes opplysningene dine automatisk/)).toBeVisible();
});

test('a single offered template loads straight into the form, no chooser', async ({ page }) => {
    await page.goto(`/org/${ORG}`);
    await expect(page.getByText('Søk om attest til Testorg')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Hva søker du om?')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Velg en annen attest/ })).not.toBeVisible();
});

test('several offered templates show a chooser, and picking one loads that form', async ({ page }) => {
    await mockOffered(page, [TEMPLATE, SECOND]);

    await page.goto(`/org/${ORG}`);
    await expect(page.getByText('Hva søker du om?')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Kursbevis' })).toBeVisible();

    await page.getByRole('button', { name: 'Kursbevis' }).click();

    await expect(page.getByLabel('Kursnavn')).toBeVisible();
    await page.waitForURL((u) => u.searchParams.get('t') === SECOND.id);
});

test('an existing ?t= skips the chooser even when several are offered', async ({ page }) => {
    await mockOffered(page, [TEMPLATE, SECOND]);

    await page.goto(`/org/${ORG}?t=${SECOND.id}`);
    await expect(page.getByLabel('Kursnavn')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Hva søker du om?')).not.toBeVisible();
});

test('the back link returns to the chooser and clears ?t=', async ({ page }) => {
    await mockOffered(page, [TEMPLATE, SECOND]);

    await page.goto(`/org/${ORG}?t=${SECOND.id}`);
    await expect(page.getByLabel('Kursnavn')).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: /Velg en annen attest/ }).click();

    await expect(page.getByText('Hva søker du om?')).toBeVisible();
    await page.waitForURL((u) => !u.searchParams.has('t'));
});

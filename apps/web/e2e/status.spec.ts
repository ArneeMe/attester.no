import { expect, test } from '@playwright/test';

const ORG = 'testorg';
const TOKEN = 'A'.repeat(43);
const TEMPLATE = { id: '22222222-2222-2222-2222-222222222222', name: 'Attest', form_schema: [{ key: 'name', label: 'Navn', type: 'text' }] };
const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 3600_000).toISOString();

test('after submitting, the volunteer gets a status link with the secret after the #', async ({ page }) => {
    await page.route(`**/api/v1/org/${ORG}`, (route) =>
        route.fulfill({ json: { organization: { id: 'o', slug: ORG, name: 'Testorg' }, digipost: false } }));
    await page.route(`**/api/v1/org/${ORG}/offered-templates`, (route) =>
        route.fulfill({ json: { templates: [{ id: TEMPLATE.id, name: TEMPLATE.name, description: null }] } }));
    await page.route(`**/api/v1/org/${ORG}/templates/${TEMPLATE.id}*`, (route) => route.fulfill({ json: { template: TEMPLATE } }));
    await page.route(`**/api/v1/org/${ORG}/submissions`, (route) =>
        route.fulfill({ json: { submission: { id: 's', created_at: '2026-11-13T00:00:00Z' }, statusToken: TOKEN } }));

    await page.goto(`/org/${ORG}`);
    await page.getByLabel('Navn').fill('Ola Nordmann', { timeout: 30000 });
    await page.getByRole('button', { name: 'Send inn' }).click();
    await page.getByRole('button', { name: 'Ja, lagre' }).click();

    const link = page.getByRole('link', { name: new RegExp(`/org/${ORG}/status#${TOKEN}$`) });
    await expect(link).toBeVisible();
    expect(new URL((await link.getAttribute('href'))!).search).toBe('');
});

test('the status page sends the secret in the body, never in an address', async ({ page }) => {
    const urls: string[] = [];
    const bodies: unknown[] = [];
    page.on('request', (req) => urls.push(req.url()));
    await page.route(`**/api/v1/org/${ORG}/status`, (route) => {
        bodies.push(route.request().postDataJSON());
        return route.fulfill({
            json: {
                status: 'waiting', submittedAt: '2026-11-01T10:00:00Z', issuedAt: null, deletedAt: null,
                digipost: null, reminder: { canRemindAt: daysFromNow(-1), remaining: 3 },
            },
        });
    });
    await page.route(`**/api/v1/org/${ORG}/status/remind`, (route) =>
        route.fulfill({ json: { reminder: { canRemindAt: daysFromNow(7), remaining: 2 } } }));

    await page.goto(`/org/${ORG}/status#${TOKEN}`);
    await expect(page.getByText('venter på at organisasjonen')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Sendt inn')).toBeVisible();
    expect(bodies[0]).toEqual({ token: TOKEN });
    expect(urls.some((u) => u.includes(TOKEN))).toBe(false);

    await page.getByRole('button', { name: 'Send påminnelse' }).click();
    await expect(page.getByText('Påminnelsen er sendt.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send påminnelse' })).toHaveCount(0);
});

test('too early for a reminder shows the date instead of the button', async ({ page }) => {
    await page.route(`**/api/v1/org/${ORG}/status`, (route) =>
        route.fulfill({
            json: {
                status: 'waiting', submittedAt: '2026-11-13T10:00:00Z', issuedAt: null, deletedAt: null,
                digipost: null, reminder: { canRemindAt: daysFromNow(2), remaining: 3 },
            },
        }));
    await page.goto(`/org/${ORG}/status#${TOKEN}`);
    await expect(page.getByText(/Du kan sende organisasjonen en påminnelse fra/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Send påminnelse' })).toHaveCount(0);
});

test('an issued request shows when it was issued and when it is deleted, with no reminder', async ({ page }) => {
    await page.route(`**/api/v1/org/${ORG}/status`, (route) =>
        route.fulfill({
            json: {
                status: 'issued', submittedAt: '2026-11-01T10:00:00Z', issuedAt: '2026-11-12T10:00:00Z',
                deletedAt: '2026-11-13T10:00:00Z', digipost: { status: 'sent', sentAt: '2026-11-12T10:00:05Z' }, reminder: null,
            },
        }));
    await page.goto(`/org/${ORG}/status#${TOKEN}`);
    await expect(page.getByText('Attesten din er utstedt')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Sendt til Digipost 12\. november/)).toBeVisible();
    await expect(page.getByText('Slettes hos oss')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send påminnelse' })).toHaveCount(0);
});

test('a deleted or unknown request gets one honest answer', async ({ page }) => {
    await page.route(`**/api/v1/org/${ORG}/status`, (route) => route.fulfill({ status: 404, json: { error: 'Not found' } }));
    await page.goto(`/org/${ORG}/status#${TOKEN}`);
    await expect(page.getByText('Vi finner ikke forespørselen.')).toBeVisible({ timeout: 30000 });
});

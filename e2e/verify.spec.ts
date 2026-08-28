import { expect, test } from '@playwright/test';
import { certHash } from './helpers';

const ORG = 'testorg';
const TEMPLATE_ID = '11111111-1111-1111-1111-111111111111';
const SUBMISSION_ID = 'sub-e2e-1';

const CERT_FIELDS = {
    id: SUBMISSION_ID,
    name: 'Ola Nordmann',
    group: 'Kjelleren',
};

const FORM_SCHEMA = [
    { key: 'name', label: 'Navn', type: 'text' },
    { key: 'group', label: 'Gruppe', type: 'text' },
];

test.beforeEach(async ({ page }) => {
    await page.route(`**/api/org/${ORG}/certificates/verify*`, (route) =>
        route.fulfill({ json: { hash: certHash(CERT_FIELDS), template_id: TEMPLATE_ID } }),
    );
    await page.route(`**/api/org/${ORG}/templates/${TEMPLATE_ID}*`, (route) =>
        route.fulfill({ json: { template: { id: TEMPLATE_ID, form_schema: FORM_SCHEMA } } }),
    );
});

function verifyUrl(fields: Record<string, string>): string {
    const params = new URLSearchParams({ t: TEMPLATE_ID, ...fields });
    return `/org/${ORG}/verify?${params.toString()}`;
}

test('matching params verify green', async ({ page }) => {
    await page.goto(verifyUrl(CERT_FIELDS));
    await expect(page.getByText('✓ Attesten er gyldig')).toBeVisible();
    await expect(page.getByLabel('Navn')).toHaveValue('Ola Nordmann');
});

test('lang=en in the URL keeps a genuine cert green (English UI)', async ({ page }) => {
    await page.goto(`${verifyUrl(CERT_FIELDS)}&lang=en`);
    await expect(page.getByText('✓ The certificate is valid')).toBeVisible();
});

test('a tracking param appended by a sharing channel does not break verification', async ({ page }) => {
    await page.goto(`${verifyUrl(CERT_FIELDS)}&fbclid=abc123&utm_source=whatsapp`);
    await expect(page.getByText('✓ Attesten er gyldig')).toBeVisible();
});

const SETTLE_MS = 400;
async function urlAfterSettling(page: import('@playwright/test').Page): Promise<string> {
    await page.waitForTimeout(SETTLE_MS);
    return page.url();
}

test('clicking English is a local UI toggle — it does not touch the URL', async ({ page }) => {
    await page.goto(verifyUrl(CERT_FIELDS));
    await expect(page.getByText('✓ Attesten er gyldig')).toBeVisible();

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('✓ The certificate is valid')).toBeVisible();
    expect(new URL(await urlAfterSettling(page)).searchParams.has('lang')).toBe(false);
});

test('no interaction on the verify page alters the URL', async ({ page }) => {
    await page.goto(verifyUrl(CERT_FIELDS));
    await expect(page.getByText('✓ Attesten er gyldig')).toBeVisible();
    const before = page.url();

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('✓ The certificate is valid')).toBeVisible();
    expect(await urlAfterSettling(page)).toBe(before);

    await page.getByRole('button', { name: 'Norsk' }).click();
    await expect(page.getByText('✓ Attesten er gyldig')).toBeVisible();
    expect(await urlAfterSettling(page)).toBe(before);

    await page.getByLabel('Gruppe').fill('Styret');
    await expect(page.getByText('✗ Attesten er ugyldig')).toBeVisible();
    expect(await urlAfterSettling(page)).toBe(before);
});

test('an existing lang param survives toggling untouched', async ({ page }) => {
    await page.goto(`${verifyUrl(CERT_FIELDS)}&lang=en`);
    await expect(page.getByText('✓ The certificate is valid')).toBeVisible();
    const before = page.url();

    await page.getByRole('button', { name: 'Norsk' }).click();
    await expect(page.getByText('✓ Attesten er gyldig')).toBeVisible();
    expect(await urlAfterSettling(page)).toBe(before);
});

test('tampered params verify red', async ({ page }) => {
    await page.goto(verifyUrl({ ...CERT_FIELDS, name: 'Kari Nordmann' }));
    await expect(page.getByText('✗ Attesten er ugyldig')).toBeVisible();
});

test('editing a field flips a green verification to red', async ({ page }) => {
    await page.goto(verifyUrl(CERT_FIELDS));
    await expect(page.getByText('✓ Attesten er gyldig')).toBeVisible();

    await page.getByLabel('Gruppe').fill('Styret');
    await expect(page.getByText('✗ Attesten er ugyldig')).toBeVisible();
});

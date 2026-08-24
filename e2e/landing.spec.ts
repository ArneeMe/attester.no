import { expect, test } from '@playwright/test';

// The org directory is fetched server-side; with the placeholder Nhost env
// that fetch fails, so these assertions double as the graceful-degradation
// check — the page must render and stay usable without a database.
test('landing page renders without a database', async ({ page }) => {
    await page.goto('/');
    await expect(
        page.getByRole('heading', { name: 'En attest er verdt noe bare hvis den kan etterprøves.' }),
    ).toBeVisible();
    await expect(page.getByText('Fikk ikke hentet organisasjonene')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Innlogging for admin' })).toBeVisible();
});

test('?lang=en renders the English strings and links to /om', async ({ page }) => {
    await page.goto('/?lang=en');
    await expect(
        page.getByRole('heading', { name: 'A certificate is only worth something if it can be checked.' }),
    ).toBeVisible();

    await page.getByRole('link', { name: /Read more about how attester.no works/ }).click();
    // Generous timeout on the first assertion after each navigation: `next
    // dev` compiles the route on first request, which under parallel workers
    // regularly exceeds the 5s default. Not a product concern — the built
    // app serves these instantly — but it made this spec flaky.
    const FIRST_PAINT = { timeout: 30_000 };
    await expect(page.getByRole('heading', { name: 'How attester.no works' })).toBeVisible(FIRST_PAINT);
    await expect(page.getByText('This is NEVER stored as part of the certificate:')).toBeVisible();

    // The toggle swaps back to Norwegian on the same page.
    await page.getByRole('link', { name: 'Norsk' }).click();
    await expect(page.getByRole('heading', { name: 'Slik fungerer attester.no' })).toBeVisible(FIRST_PAINT);
});

test('the verify field routes a pasted certificate link', async ({ page }) => {
    await page.goto('/');
    const field = page.getByLabel('Har du fått en attest?');

    await field.fill('ikke en lenke');
    await page.getByRole('button', { name: 'Verifiser' }).click();
    // #verify-error, not getByRole('alert') — Next's route announcer is also
    // role="alert" and would make the locator ambiguous.
    await expect(page.locator('#verify-error')).toContainText('ser ikke ut som en attestlenke');
    await expect(page).toHaveURL('/');

    await field.fill('https://attester.no/org/echo/verify?t=abc&id=def');
    await page.getByRole('button', { name: 'Verifiser' }).click();
    await expect(page).toHaveURL('/org/echo/verify?t=abc&id=def', { timeout: 30_000 });
});

// Legacy echo certificates are printed on paper and point at the positional
// /verify route; the landing field has to keep accepting them.
test('the verify field accepts a legacy certificate link', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Har du fått en attest?').fill('attester.no/verify?abc_Ola+Nordmann');
    await page.getByRole('button', { name: 'Verifiser' }).click();
    await expect(page).toHaveURL('/verify?abc_Ola+Nordmann', { timeout: 30_000 });
});

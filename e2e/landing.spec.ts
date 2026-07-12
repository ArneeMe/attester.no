import { expect, test } from '@playwright/test';

// The landing page fetches the org directory server-side; with the
// placeholder Nhost env that fetch fails and the page must still render
// (directory gracefully omitted) — which is exactly what we assert.
test('landing page renders without a database', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'attester.no' })).toBeVisible();
    await expect(page.getByText('Personvern er hele poenget')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Logg inn som administrator' })).toBeVisible();
});

test('?lang=en renders the English strings and links to /om', async ({ page }) => {
    await page.goto('/?lang=en');
    await expect(page.getByText('Privacy is the whole point')).toBeVisible();

    await page.getByRole('link', { name: /Read more about how attester.no works/ }).click();
    await expect(page.getByRole('heading', { name: 'How attester.no works' })).toBeVisible();
    await expect(page.getByText('This is NEVER stored after issuance:')).toBeVisible();

    // The toggle swaps back to Norwegian on the same page.
    await page.getByRole('link', { name: 'Norsk' }).click();
    await expect(page.getByRole('heading', { name: 'Slik fungerer attester.no' })).toBeVisible();
});

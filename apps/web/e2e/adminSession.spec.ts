import { expect, test, type Page } from '@playwright/test';

const SESSION_KEY = 'nhostSession';

function storedSession(expiresInSeconds: number) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return {
        accessToken: 'e2e-access-token',
        accessTokenExpiresIn: expiresInSeconds,
        refreshTokenId: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
        refreshToken: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
        user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'admin@example.com',
            displayName: 'E2E Admin',
            roles: ['user'],
        },
        decodedToken: { exp, sub: '00000000-0000-0000-0000-000000000001' },
    };
}

async function signIn(page: Page, expiresInSeconds: number) {
    await page.addInitScript(
        ([key, session]) => window.localStorage.setItem(key as string, JSON.stringify(session)),
        [SESSION_KEY, storedSession(expiresInSeconds)] as const,
    );
}

test.beforeEach(async ({ page }) => {
    await page.route('**/*.nhost.run/**', (route) => route.abort());
});

test('an expired session says so instead of showing an empty org list', async ({ page }) => {
    await signIn(page, 900);
    await page.route('**/api/me/organizations', (route) =>
        route.fulfill({ status: 401, json: { error: 'Invalid session' } }),
    );

    await page.goto('/login/adminpage');

    await expect(page.getByText('Økten din er utløpt')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('link', { name: 'Gå til innlogging' })).toBeVisible();
    await expect(page.getByText('Du er ikke koblet til noen organisasjon ennå.')).toHaveCount(0);
});

test('a genuinely empty membership list still reads as empty, not as an error', async ({ page }) => {
    await signIn(page, 900);
    await page.route('**/api/me/organizations', (route) =>
        route.fulfill({ json: { organizations: [] } }),
    );

    await page.goto('/login/adminpage');

    await expect(page.getByText('Du er ikke koblet til noen organisasjon ennå.')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Økten din er utløpt')).toHaveCount(0);
});

test('a failed lookup offers a retry rather than claiming there are no orgs', async ({ page }) => {
    await signIn(page, 900);
    await page.route('**/api/me/organizations', (route) => route.abort());

    await page.goto('/login/adminpage');

    await expect(page.getByText('Fikk ikke kontakt med serveren')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Prøv igjen' })).toBeVisible();
    await expect(page.getByText('Du er ikke koblet til noen organisasjon ennå.')).toHaveCount(0);
});

test('orgs render when the session is good', async ({ page }) => {
    await signIn(page, 900);
    await page.route('**/api/me/organizations', (route) =>
        route.fulfill({
            json: {
                organizations: [
                    { id: 'org-1', slug: 'testorg', name: 'Test Organisation', role: 'admin' },
                ],
            },
        }),
    );

    await page.goto('/login/adminpage');

    await expect(page.getByRole('link', { name: /Test Organisation/ })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Økten din er utløpt')).toHaveCount(0);
});

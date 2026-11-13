import { expect, test } from '@playwright/test';

test('a crash in the page is reported with the kind of page, not the address', async ({ page }) => {
    const reports: Array<Record<string, string>> = [];
    await page.route('**/api/v1/errors', (route) => {
        reports.push(route.request().postDataJSON());
        return route.fulfill({ status: 202, json: { received: true } });
    });
    await page.route('**/api/v1/org/hemmelig-org**', (route) => route.fulfill({ json: {} }));

    await page.goto('/org/hemmelig-org/verify?id=sub-1&name=Ola+Nordmann');
    await expect(page.locator('body')).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => {
        setTimeout(() => {
            throw new TypeError('boom in the page');
        }, 0);
    });

    await expect.poll(() => reports.length, { timeout: 10000 }).toBeGreaterThan(0);
    const report = reports[0];
    expect(report).toMatchObject({ source: 'browser', place: '/org/:slug/verify', kind: 'TypeError' });
    expect(Object.keys(report).sort()).toEqual(['kind', 'message', 'place', 'source', 'stack']);
    expect(JSON.stringify(report)).not.toContain('hemmelig-org');
    expect(JSON.stringify(report)).not.toContain('Nordmann');
});

test('a page that keeps crashing sends at most five reports', async ({ page }) => {
    let count = 0;
    await page.route('**/api/v1/errors', (route) => {
        count++;
        return route.fulfill({ status: 202, json: { received: true } });
    });
    await page.goto('/om');
    await expect(page.locator('body')).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => {
        for (let i = 0; i < 20; i++) setTimeout(() => { throw new Error(`crash ${i}`); }, 0);
    });
    await page.waitForTimeout(1500);
    expect(count).toBe(5);
});

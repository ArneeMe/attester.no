import { expect, test } from '@playwright/test';

const SESSION_KEY = 'nhostSession';
const SUB = '22222222-2222-2222-2222-222222222222';
const TMPL = '33333333-3333-3333-3333-333333333333';
const VERIFY_URL = `https://attester.no/org/testorg/verify?t=${TMPL}&id=${SUB}&name=Ola+Nordmann`;

test('Generer PDF asks the server to issue and downloads what it returns', async ({ page }) => {
    const exp = Math.floor(Date.now() / 1000) + 900;
    await page.addInitScript(
        ([key, session]) => window.localStorage.setItem(key as string, JSON.stringify(session)),
        [SESSION_KEY, {
            accessToken: 'e2e-access-token',
            accessTokenExpiresIn: 900,
            refreshTokenId: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
            refreshToken: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
            user: { id: '00000000-0000-0000-0000-000000000001', email: 'admin@example.com', displayName: 'E2E Admin', roles: ['user'] },
            decodedToken: { exp, sub: '00000000-0000-0000-0000-000000000001' },
        }] as const,
    );
    await page.route('**/*.nhost.run/**', (route) => route.abort());
    await page.route('**/api/v1/me/organizations', (route) =>
        route.fulfill({ json: { organizations: [{ id: 'org-1', slug: 'testorg', name: 'Testorg', role: 'admin', pending: 1 }] } }),
    );
    const listCalls: string[] = [];
    await page.route(/\/api\/v1\/org\/testorg\/submissions\?/, (route) => {
        listCalls.push(new URL(route.request().url()).search);
        return route.fulfill({
            json: {
                total: 1,
                submissions: [{
                    id: SUB, organization_id: 'org-1', template_id: TMPL,
                    data: { name: 'Ola Nordmann' }, created_at: new Date().toISOString(), issued_at: null,
                }],
            },
        });
    });
    await page.route('**/api/v1/org/testorg/templates', (route) =>
        route.fulfill({
            json: { templates: [{ id: TMPL, name: 'Attest', form_schema: [{ key: 'name', label: 'Navn', type: 'text' }] }] },
        }),
    );

    let issueCalls = 0;
    let issueBody: string | null = 'unset';
    await page.route(`**/api/v1/org/testorg/submissions/${SUB}/issue`, (route) => {
        issueCalls++;
        issueBody = route.request().postData();
        return route.fulfill({
            json: {
                id: 'cert-1',
                alreadyIssued: false,
                filename: 'Ola Nordmann_attest.pdf',
                verifyUrl: VERIFY_URL,
                pdf: Buffer.from('%PDF-1.7 e2e').toString('base64'),
            },
        });
    });

    await page.goto('/login/adminpage/testorg');
    await expect(page.getByRole('link', { name: 'Oversikt (1)' })).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Generer PDF' }).first().click({ timeout: 30000 });

    const download = page.waitForEvent('download');
    await page.getByRole('dialog').getByRole('button', { name: 'Generer PDF' }).click();
    expect((await download).suggestedFilename()).toBe('Ola Nordmann_attest.pdf');

    await expect(page.getByRole('link', { name: VERIFY_URL })).toBeVisible();
    await expect(page.getByText('Utstedt', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Oversikt', exact: true, includeHidden: true })).toBeVisible();
    expect(issueCalls).toBe(1);
    expect(new Set(listCalls)).toEqual(new Set(['?limit=500&offset=0']));
    expect(JSON.parse(issueBody ?? 'null')).toEqual({});
});

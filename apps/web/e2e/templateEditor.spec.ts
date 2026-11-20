import { expect, test, type Page } from '@playwright/test';
import { BLANK_PDF } from '@pdfme/common';

const saved: Array<Record<string, unknown>> = [];

async function openEditor(page: Page, assets: unknown[] = [], templates: unknown[] = []) {
    saved.length = 0;
    const exp = Math.floor(Date.now() / 1000) + 900;
    await page.addInitScript(([key, session]) => window.localStorage.setItem(key as string, JSON.stringify(session)), ['nhostSession', {
        accessToken: 'e2e-access-token', accessTokenExpiresIn: 900,
        refreshTokenId: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24', refreshToken: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
        user: { id: '00000000-0000-0000-0000-000000000001', email: 'admin@example.com', displayName: 'E2E Admin', roles: ['user'] },
        decodedToken: { exp, sub: '00000000-0000-0000-0000-000000000001' },
    }] as const);
    await page.route('**/*.nhost.run/**', (route) => route.abort());
    await page.route('**/api/v1/me/organizations', (route) =>
        route.fulfill({ json: { organizations: [{ id: 'org-1', slug: 'testorg', name: 'Testorg', role: 'admin', pending: 0 }] } }));
    await page.route('**/api/v1/org/testorg/templates', (route) => {
        if (route.request().method() === 'POST') {
            saved.push(route.request().postDataJSON());
            return route.fulfill({ json: { template: { id: 't1', created_at: '', updated_at: '' } } });
        }
        return route.fulfill({ json: { templates } });
    });
    await page.route('**/api/v1/org/testorg/assets', (route) => route.fulfill({ json: { assets } }));
    await page.route('**/api/v1/org/testorg/settings', (route) => route.fulfill({ json: {} }));
    await page.goto('/login/adminpage/testorg/edit_pdf');
    await expect(page.getByRole('button', { name: '+ Spørsmål' })).toBeVisible({ timeout: 60000 });
}

async function openStarter(page: Page) {
    await openEditor(page);
    await page.getByRole('button', { name: 'Start fra en ferdig mal' }).click();
    await page.locator('.MuiDialog-root .MuiCardActionArea-root').first().click();
}

async function addQuestion(page: Page, label: string) {
    await page.getByRole('button', { name: '+ Spørsmål' }).click();
    await page.getByRole('dialog').getByLabel('Spørsmål').fill(label);
    await page.getByRole('dialog').getByRole('button', { name: 'Legg til', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
}

test('the editor has three steps: background, content and save', async ({ page }) => {
    await openEditor(page);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Bakgrunn', 'Innhold', 'Lagre']);
});

test('a starter template is listed in plain words, without variable names', async ({ page }) => {
    await openStarter(page);
    await expect(page.getByText('Tekst: «Kursbevis»', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Spørsmål').first()).toHaveValue('Mottakers navn');
    await expect(page.getByText(/^Signatur 1 mangler/)).toBeVisible();
    await expect(page.getByText('QR-kode for å sjekke attesten')).toBeVisible();
    await expect(page.getByText(/\{name\}|\{course\}/)).toHaveCount(0);
});

test('a question is added with one button and removed with another', async ({ page }) => {
    await openEditor(page);
    await addQuestion(page, 'Kursnavn');
    await expect(page.getByLabel('Spørsmål')).toHaveValue('Kursnavn');
    await page.getByRole('button', { name: 'Fjern' }).click();
    await expect(page.getByText('Ingenting ennå. Bruk knappene over.')).toBeVisible();
});

test('there can be only one QR code', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: '+ QR-kode' }).click();
    await expect(page.getByText('QR-kode for å sjekke attesten')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ QR-kode' })).toBeDisabled();
});

test('saving sends the questions as the form and the fields as bindings', async ({ page }) => {
    await openEditor(page);
    await addQuestion(page, 'Kursnavn');
    await page.getByRole('button', { name: '+ Valgliste' }).click();
    await page.getByRole('dialog').getByLabel('Spørsmål').fill('Gruppe');
    await page.getByRole('dialog').getByLabel('Nytt valg').fill('Webkom');
    await page.getByRole('dialog').getByRole('button', { name: 'Legg til valg' }).click();
    await page.getByRole('dialog').getByLabel('Nytt valg').fill('Bedkom');
    await page.getByRole('dialog').getByLabel('Nytt valg').press('Enter');
    await page.getByRole('dialog').getByRole('button', { name: 'Legg til', exact: true }).click();
    await page.getByRole('button', { name: '+ Signatur' }).click();
    await page.getByRole('button', { name: '+ QR-kode' }).click();
    await page.getByLabel('Navn på mal').fill('Test');
    await page.getByRole('button', { name: 'Lagre mal' }).click();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0].formSchema).toEqual([
        { key: 'kursnavn', label: 'Kursnavn', type: 'text' },
        { key: 'gruppe', label: 'Gruppe', type: 'dropdown', options: ['Webkom', 'Bedkom'] },
    ]);
    expect(saved[0].fieldBindings).toMatchObject({
        kursnavn: { source: 'composite', template: '{kursnavn}' },
        signatur_1_bilde: { source: 'asset_default', kind: 'signature', position: 0, subField: 'photo' },
        qr_code: { source: 'system', system: 'qr_code' },
    });
});

test('a field is moved by dragging it and resized by its corner', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: '+ Tekst' }).click();
    await page.getByRole('dialog').getByLabel('Tekst').fill('attester.no');
    await page.getByRole('dialog').getByRole('button', { name: 'Legg til', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: '+ QR-kode' }).click();

    await page.getByTestId('field-tekst').scrollIntoViewIfNeeded();
    const box = (await page.getByTestId('field-tekst').boundingBox())!;
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + 105, box.y + 105, { steps: 5 });
    await page.mouse.up();
    await page.getByTestId('resize-handle').scrollIntoViewIfNeeded();
    const handle = (await page.getByTestId('resize-handle').boundingBox())!;
    await page.mouse.move(handle.x + 5, handle.y + 5);
    await page.mouse.down();
    await page.mouse.move(handle.x + 55, handle.y + 25, { steps: 5 });
    await page.mouse.up();

    await page.getByLabel('Navn på mal').fill('Test');
    await page.getByRole('button', { name: 'Lagre mal' }).click();
    await expect.poll(() => saved.length).toBe(1);
    const field = (saved[0].schemas as Array<Array<{ name: string; position: { x: number; y: number }; width: number }>>)[0]
        .find((f) => f.name === 'tekst')!;
    expect(field.position.x).toBeGreaterThan(30);
    expect(field.position.y).toBeGreaterThan(30);
    expect(field.width).toBeGreaterThan(120);
});

test('text from a starter template can be edited, with answers shown by their question', async ({ page }) => {
    await openStarter(page);
    await page.getByText('Tekst: «den [Fullført dato]»').click();
    const text = page.getByLabel('Tekst', { exact: true });
    await expect(text).toHaveValue('den [Fullført dato]');
    await text.fill('Fullført');
    await page.getByRole('button', { name: 'Fullført dato' }).click();
    await expect(text).toHaveValue('Fullført [Fullført dato]');
    await page.getByLabel('Navn på mal').fill('Test');
    await page.getByRole('button', { name: 'Lagre mal' }).click();
    await expect.poll(() => saved.length).toBe(1);
    expect((saved[0].fieldBindings as Record<string, unknown>).completion_date)
        .toMatchObject({ source: 'composite', template: 'Fullført {date:date}' });
});

test('a signature shows who signs, or says it is missing in Content', async ({ page }) => {
    await openEditor(page, [{
        id: 's1', organization_id: 'org-1', kind: 'signature', name: 'Ola Nordmann', content: { photo: '', role: 'Leder', phone: '' },
        is_default: true, sort_order: 0, created_at: '', updated_at: '',
    }]);
    await page.getByRole('button', { name: '+ Signatur' }).click();
    await page.getByRole('button', { name: '+ Signatur' }).click();
    await expect(page.getByText('Signatur 1: Ola Nordmann, Leder')).toBeVisible();
    await expect(page.getByText(/^Signatur 2 mangler/)).toBeVisible();
});

test('saving waits until the QR code is there, and says so', async ({ page }) => {
    await openEditor(page);
    await page.getByLabel('Navn på mal').fill('Test');
    await expect(page.getByText(/^Før du kan lagre:/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lagre mal' })).toBeDisabled();
    await page.getByRole('button', { name: '+ QR-kode' }).click();
    await expect(page.getByText(/^Før du kan lagre:/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lagre mal' })).toBeEnabled();
});

test('the text around an answer is written when the question is added', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: '+ Spørsmål' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Spørsmål').fill('Fullført dato');
    await dialog.getByRole('combobox', { name: 'Svar' }).click();
    await page.getByRole('option', { name: 'Dato' }).click();
    await dialog.getByLabel('Tekst før svaret (valgfritt)').fill('Fullført den ');
    await expect(dialog.getByText('På attesten:')).toBeVisible();
    await dialog.getByRole('button', { name: 'Legg til', exact: true }).click();
    await expect(page.getByText('Tekst: «Fullført den [Fullført dato]»')).toBeVisible();
    await page.getByRole('button', { name: '+ QR-kode' }).click();
    await page.getByLabel('Navn på mal').fill('Test');
    await page.getByRole('button', { name: 'Lagre mal' }).click();
    await expect.poll(() => saved.length).toBe(1);
    expect((saved[0].fieldBindings as Record<string, unknown>).fullfort_dato)
        .toEqual({ source: 'composite', template: 'Fullført den {fullfort_dato:date}' });
});

test('saving under the name of an existing template asks before it replaces it', async ({ page }) => {
    await openEditor(page, [], [{ id: 't0', name: 'Kursbevis', is_offered: true, created_at: '', updated_at: '' }]);
    await page.getByRole('button', { name: '+ QR-kode' }).click();
    await page.getByLabel('Navn på mal').fill('Kursbevis');
    await page.getByRole('button', { name: 'Oppdater mal' }).click();
    await expect(page.getByText('Overskrive «Kursbevis»?')).toBeVisible();
    expect(saved).toHaveLength(0);
    await page.getByRole('button', { name: 'Oppdater', exact: true }).click();
    await expect.poll(() => saved.length).toBe(1);
});

test('an uploaded PDF stays as background when a ready-made template is picked', async ({ page }) => {
    await openEditor(page);
    const pdf = Buffer.from(BLANK_PDF.split(',')[1], 'base64');
    await page.locator('input[type=file][accept="application/pdf"]').setInputFiles({ name: 'bakgrunn.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.getByRole('button', { name: 'Start fra en ferdig mal' }).click();
    await page.locator('.MuiDialog-root .MuiCardActionArea-root').first().click();
    await page.getByLabel('Navn på mal').fill('Test');
    await page.getByRole('button', { name: 'Lagre mal' }).click();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0].basePdf).toMatch(/^data:application\/pdf;base64,/);
});

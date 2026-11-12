import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite. Every backend call the pages make is mocked with
// page.route() inside the tests, so no Nhost project is needed — the
// placeholder env vars below only have to exist for next dev to boot.
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: 'http://localhost:3900',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Sandboxed environments can provide a system chromium via
                // PW_CHROMIUM_PATH instead of `playwright install`; CI and
                // normal dev machines leave it unset and use the managed one.
                launchOptions: process.env.PW_CHROMIUM_PATH
                    ? { executablePath: process.env.PW_CHROMIUM_PATH }
                    : {},
            },
        },
    ],
    webServer: {
        command: 'npx next dev -p 3900',
        url: 'http://localhost:3900',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            NEXT_PUBLIC_NHOST_SUBDOMAIN: 'e2e-placeholder',
            NEXT_PUBLIC_NHOST_REGION: 'eu-central-1',
        },
    },
});

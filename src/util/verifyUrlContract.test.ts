import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateParams } from '@/app/login/adminpage/generateParams';
import { hashFunction } from './hashFunction';
import { buildCertParams } from './certParams';
import { canonicalHash } from './canonicalHash';

// URL ↔ endpoint contract for BOTH verify flows.
//
// QR codes are physically printed on PDFs in the wild — the URL they carry
// can never change. These tests pin (a) that the routes the printed URLs
// point at still exist on disk, and (b) that a URL built the way the issuer
// built it parses back — through the same steps the verify pages use — to
// the exact string/params that were hashed at issuance.
//
// If a refactor breaks one of these, already-issued certificates break.
// Do not "fix" the test to match the refactor; fix the refactor.

const routeFile = (...segments: string[]) =>
    fs.existsSync(path.join(process.cwd(), 'src', 'app', ...segments));

describe('verify routes exist for printed URLs', () => {
    it('legacy /verify page (frozen until ~2030)', () => {
        expect(routeFile('verify', 'page.tsx')).toBe(true);
    });

    it('legacy /api/certificates/verify endpoint', () => {
        expect(routeFile('api', 'certificates', 'verify', 'route.ts')).toBe(true);
    });

    it('new /org/[orgSlug]/verify page', () => {
        expect(routeFile('org', '[orgSlug]', 'verify', 'page.tsx')).toBe(true);
    });

    it('new /api/org/[slug]/certificates/verify endpoint', () => {
        expect(routeFile('api', 'org', '[slug]', 'certificates', 'verify', 'route.ts')).toBe(true);
    });
});

describe('legacy flow: printed positional URL → page parser → hash', () => {
    // The exact volunteer shape the old issuer hashed and printed.
    const volunteer = {
        id: 'vol-123',
        personName: 'Ola Nordmann',
        groupName: 'Webkom',
        startDate: '2023-01-01',
        endDate: '2024-06-30',
        role: 'Leder',
    };

    // Mirrors src/app/verify/page.tsx exactly: useSearchParams().toString()
    // → split('_') → '+'-to-space + decodeURIComponent per part → slice the
    // trailing '=' off the last part (URLSearchParams serialises the whole
    // positional string as a valueless key, so toString() appends '=').
    const parseLikeLegacyPage = (url: URL): string[] => {
        const qs = url.searchParams.toString();
        const parts = qs.split('_').map((p) => decodeURIComponent(p.replace(/\+/g, ' ')));
        parts[parts.length - 1] = parts[parts.length - 1].slice(0, -1);
        return parts;
    };

    it('round-trips: generateParams → URL → parser → identical hash input', async () => {
        const positional = generateParams(volunteer);
        const url = new URL(
            `https://attester.no/verify?${new URLSearchParams([[positional, '']])}`,
        );
        expect(url.pathname).toBe('/verify');

        const parts = parseLikeLegacyPage(url);
        // The page re-joins the positional fields with '_' before hashing.
        const rejoined = [
            parts[0], parts[1], parts[2], parts[3], parts[4], parts[5],
        ].join('_');

        expect(rejoined).toBe(positional);
        expect(await hashFunction(rejoined)).toBe(await hashFunction(positional));
    });

    it('extra roles survive the round trip', async () => {
        const withExtra = {
            ...volunteer,
            extraRole: [
                { groupName: 'Bedkom', startDate: '2022-01-01', endDate: '2022-12-31', role: 'Medlem' },
            ],
        };
        const positional = generateParams(withExtra);
        const url = new URL(
            `https://attester.no/verify?${new URLSearchParams([[positional, '']])}`,
        );
        const parts = parseLikeLegacyPage(url);
        expect(parts.join('_')).toBe(positional);
    });

    it('pins the legacy SHA-512 digest of a known positional string', async () => {
        // Frozen golden value. If this changes, every pre-migration echo cert
        // stops verifying — there is no legitimate reason to update it.
        const positional = generateParams(volunteer);
        expect(positional).toBe('vol-123_Ola Nordmann_Webkom_2023-01-01_2024-06-30_Leder');
        expect(await hashFunction(positional)).toBe(
            '892c9276695df95729ea6cfaddb628f596df8f8ba7d7818f41e61e1762447539' +
            '179d002a7f14b1f4cd0fa047128f0467331e4cb08930f4d731e13ff62bbfe4f5',
        );
    });
});

describe('new flow: issued QR URL → verify client parse → hash', () => {
    beforeAll(() => {
        // generateURL reads window.location.origin (it runs in the admin's
        // browser at issuance time).
        vi.stubGlobal('window', { location: { origin: 'https://attester.no' } });
    });
    afterAll(() => {
        vi.unstubAllGlobals();
    });

    const data = {
        name: 'Bjørn Æsel',
        group: 'Webkom & venner',
        role: 'Leder=Nestleder',
        from: '2024-01-01',
    };

    it('generateURL points at the org verify route with t and id params', async () => {
        const { generateURL } = await import('@/app/login/adminpage/generateURL');
        const url = new URL(generateURL('echo', 'tmpl-1', 'sub-1', data));
        expect(url.pathname).toBe('/org/echo/verify');
        expect(url.searchParams.get('t')).toBe('tmpl-1');
        expect(url.searchParams.get('id')).toBe('sub-1');
    });

    it('round-trips: URL params parsed like OrgVerifyClient → issuer hash', async () => {
        const { generateURL } = await import('@/app/login/adminpage/generateURL');
        const issuerHash = await canonicalHash(buildCertParams('tmpl-1', 'sub-1', data));

        const url = new URL(generateURL('echo', 'tmpl-1', 'sub-1', data));
        // Mirrors OrgVerifyClient: every URL param except 't' feeds the hash.
        const fields: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
            if (key !== 't') fields[key] = value;
        });

        expect(await canonicalHash(new URLSearchParams(fields))).toBe(issuerHash);
    });

    it('special characters survive URL encoding round trip', async () => {
        const { generateURL } = await import('@/app/login/adminpage/generateURL');
        const url = new URL(generateURL('echo', 'tmpl-1', 'sub-1', data));
        expect(url.searchParams.get('name')).toBe('Bjørn Æsel');
        expect(url.searchParams.get('group')).toBe('Webkom & venner');
        expect(url.searchParams.get('role')).toBe('Leder=Nestleder');
    });
});

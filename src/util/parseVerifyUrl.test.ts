import { describe, it, expect } from 'vitest';
import { parseVerifyUrl } from './parseVerifyUrl';

describe('parseVerifyUrl', () => {
    describe('current per-org links', () => {
        it('accepts a full https URL', () => {
            expect(
                parseVerifyUrl('https://attester.no/org/echo/verify?t=tmpl&id=sub&name=Ola'),
            ).toBe('/org/echo/verify?t=tmpl&id=sub&name=Ola');
        });

        it('accepts a bare host without a scheme', () => {
            expect(parseVerifyUrl('attester.no/org/echo/verify?id=sub')).toBe(
                '/org/echo/verify?id=sub',
            );
        });

        it('accepts a bare path', () => {
            expect(parseVerifyUrl('/org/echo/verify?id=sub')).toBe('/org/echo/verify?id=sub');
        });

        it('keeps the slug of any organisation, not just echo', () => {
            expect(parseVerifyUrl('/org/brodkokeri/verify?id=sub')).toBe(
                '/org/brodkokeri/verify?id=sub',
            );
        });

        it('tolerates surrounding whitespace from a sloppy copy/paste', () => {
            expect(parseVerifyUrl('  https://attester.no/org/echo/verify?id=sub \n')).toBe(
                '/org/echo/verify?id=sub',
            );
        });

        it('tolerates a trailing slash before the query', () => {
            expect(parseVerifyUrl('https://attester.no/org/echo/verify/?id=sub')).toBe(
                '/org/echo/verify?id=sub',
            );
        });
    });

    describe('legacy echo links', () => {
        // These QR codes are printed on paper that predates the multi-org
        // migration. See CLAUDE.md — the route stays until ~2030, so the
        // landing page has to accept its links.
        it('accepts the positional /verify form', () => {
            expect(parseVerifyUrl('https://attester.no/verify?abc_Ola+Nordmann_Webkom')).toBe(
                '/verify?abc_Ola+Nordmann_Webkom',
            );
        });

        it('preserves the query string byte-for-byte', () => {
            // The legacy page splits on "_" and strips one trailing character
            // to undo the "=" that URLSearchParams.toString() appends. Any
            // re-encoding here would change the string it hashes.
            const raw = '/verify?id_name_group_2022-08-01_2023-05-31_Leder=';
            expect(parseVerifyUrl(raw)).toBe(raw);
        });
    });

    describe('rejects non-verify input', () => {
        it.each([
            ['', 'empty string'],
            ['   ', 'whitespace only'],
            ['hei@attester.no', 'an email address'],
            ['https://attester.no/org/echo', 'an org form link'],
            ['https://attester.no/login', 'the admin login'],
            ['https://attester.no/', 'the landing page itself'],
            ['/org//verify?id=sub', 'an empty slug'],
            ['/org/echo/deeper/verify?id=sub', 'an over-long path'],
            ['not a url at all', 'free text'],
        ])('returns null for %s (%s)', (input) => {
            expect(parseVerifyUrl(input)).toBeNull();
        });
    });

    describe('cannot be used to navigate off-site', () => {
        it('keeps only the path when the link points at another origin', () => {
            // Resolves against attester.no, so the router stays on this site.
            expect(parseVerifyUrl('https://evil.example/org/echo/verify?id=sub')).toBe(
                '/org/echo/verify?id=sub',
            );
        });

        it('rejects a non-http scheme outright', () => {
            expect(parseVerifyUrl('javascript:alert(1)//org/echo/verify')).toBeNull();
            expect(parseVerifyUrl('data:text/html,/org/echo/verify')).toBeNull();
        });
    });
});

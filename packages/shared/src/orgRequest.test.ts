import { describe, expect, it } from 'vitest';
import {
    MAX_MESSAGE_LEN,
    MAX_NAME_LEN,
    MAX_SLUG_LEN,
    isValidOrgNumber,
    suggestSlug,
    validateOrgRequest,
} from './orgRequest';

const VALID = {
    slug: 'echo-linjeforening',
    organizationName: 'echo – linjeforeningen for informatikk',
    contactEmail: 'Styret@Echo.UIB.NO',
    contactName: 'Ola Nordmann',
    message: 'Vi vil utstede attester til de frivillige våre.',
};

describe('suggestSlug', () => {
    it('folds Norwegian letters rather than dropping them', () => {
        expect(suggestSlug('Arnes Brødkokeri AS')).toBe('arnes-brodkokeri-as');
        expect(suggestSlug('Ærlig Ålesund Øst')).toBe('aerlig-alesund-ost');
    });

    it('collapses runs of punctuation and whitespace into one hyphen', () => {
        expect(suggestSlug('echo – linjeforeningen  for   informatikk')).toBe(
            'echo-linjeforeningen-for-informatikk',
        );
    });

    it('trims leading and trailing separators', () => {
        expect(suggestSlug('  ...Studentersamfunnet!  ')).toBe('studentersamfunnet');
    });

    it('strips accents that are not Nordic', () => {
        expect(suggestSlug('Café Peña')).toBe('cafe-pena');
    });

    it('returns an empty string when there is nothing usable', () => {
        expect(suggestSlug('')).toBe('');
        expect(suggestSlug('!!! ??? ---')).toBe('');
    });

    it('caps at the slug limit without leaving a trailing hyphen', () => {
        const slug = suggestSlug('a'.repeat(40) + ' ' + 'b'.repeat(40));
        expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LEN);
        expect(slug.endsWith('-')).toBe(false);
    });

    it('produces something the validator accepts', () => {
        const slug = suggestSlug('Ærlig Ålesund Øst');
        expect(validateOrgRequest({ ...VALID, slug }).ok).toBe(true);
    });
});

describe('isValidOrgNumber', () => {
    it('accepts real Norwegian organisation numbers', () => {
        expect(isValidOrgNumber('923609016')).toBe(true);
        expect(isValidOrgNumber('974760673')).toBe(true);
    });

    it('accepts the spaced form people copy off a website', () => {
        expect(isValidOrgNumber('923 609 016')).toBe(true);
    });

    it('rejects a wrong check digit, which is what a typo looks like', () => {
        expect(isValidOrgNumber('923609017')).toBe(false);
    });

    it('rejects anything that is not nine digits', () => {
        for (const value of ['', '12345678', '1234567890', '92360901a', 'abcdefghi']) {
            expect(isValidOrgNumber(value)).toBe(false);
        }
    });
});

describe('validateOrgRequest', () => {
    it('accepts a complete request and normalises it', () => {
        const result = validateOrgRequest(VALID);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.contactEmail).toBe('styret@echo.uib.no');
        expect(result.value.organizationName).toBe('echo – linjeforeningen for informatikk');
        expect(result.value.contactName).toBe('Ola Nordmann');
    });

    it('lowercases a slug typed in capitals', () => {
        const result = validateOrgRequest({ ...VALID, slug: 'ECHO-Linjeforening' });
        expect(result.ok && result.value.slug).toBe('echo-linjeforening');
    });

    it('treats blank optional fields as absent rather than empty strings', () => {
        const result = validateOrgRequest({ ...VALID, contactName: '   ', message: '' });
        expect(result.ok && result.value.contactName).toBeNull();
        expect(result.ok && result.value.message).toBeNull();
    });

    it('rejects a filled honeypot without naming a field', () => {
        expect(validateOrgRequest({ ...VALID, website: 'http://spam.example' })).toEqual({
            ok: false,
            field: null,
            error: 'honeypot',
        });
    });

    it('ignores a honeypot that is only whitespace', () => {
        expect(validateOrgRequest({ ...VALID, website: '   ' }).ok).toBe(true);
    });

    for (const field of ['organizationName', 'slug', 'contactEmail'] as const) {
        it(`requires ${field}`, () => {
            expect(validateOrgRequest({ ...VALID, [field]: '' })).toEqual({
                ok: false,
                field,
                error: 'required',
            });
        });

        it(`treats whitespace-only ${field} as missing`, () => {
            expect(validateOrgRequest({ ...VALID, [field]: '   ' })).toEqual({
                ok: false,
                field,
                error: 'required',
            });
        });

        it(`rejects a non-string ${field}`, () => {
            expect(validateOrgRequest({ ...VALID, [field]: 42 })).toEqual({
                ok: false,
                field,
                error: 'required',
            });
        });
    }

    it.each([
        ['-leading', 'bad_slug'],
        ['trailing-', 'bad_slug'],
        ['under_score', 'bad_slug'],
        ['med mellomrom', 'bad_slug'],
        ['MiXeD', null],
        ['æøå', 'bad_slug'],
        ['double--hyphen', null],
        ['a', null],
        ['a1', null],
    ] as const)('slug %s', (slug, error) => {
        const result = validateOrgRequest({ ...VALID, slug });
        if (error === null) {
            expect(result.ok).toBe(true);
        } else {
            expect(result).toEqual({ ok: false, field: 'slug', error });
        }
    });

    it.each([
        'no-at-sign',
        'no@domain',
        'spaces in@example.com',
        '@example.com',
    ])('rejects the email %s', (contactEmail) => {
        expect(validateOrgRequest({ ...VALID, contactEmail })).toEqual({
            ok: false,
            field: 'contactEmail',
            error: 'bad_email',
        });
    });

    it('accepts a request with no organisation number, since many are unregistered', () => {
        const result = validateOrgRequest(VALID);
        expect(result.ok && result.value.orgNumber).toBeNull();
    });

    it('stores an organisation number without its spaces', () => {
        const result = validateOrgRequest({ ...VALID, orgNumber: '923 609 016' });
        expect(result.ok && result.value.orgNumber).toBe('923609016');
    });

    it('rejects an organisation number that fails its check digit', () => {
        expect(validateOrgRequest({ ...VALID, orgNumber: '923609017' })).toEqual({
            ok: false,
            field: 'orgNumber',
            error: 'bad_org_number',
        });
    });

    it('treats a blank organisation number as absent rather than invalid', () => {
        expect(validateOrgRequest({ ...VALID, orgNumber: '   ' }).ok).toBe(true);
    });

    it('caps the slug length', () => {
        expect(validateOrgRequest({ ...VALID, slug: 'a'.repeat(MAX_SLUG_LEN + 1) })).toEqual({
            ok: false,
            field: 'slug',
            error: 'too_long',
        });
    });

    it('caps the organisation name length', () => {
        expect(validateOrgRequest({ ...VALID, organizationName: 'a'.repeat(MAX_NAME_LEN + 1) })).toEqual({
            ok: false,
            field: 'organizationName',
            error: 'too_long',
        });
    });

    it('caps the message length', () => {
        expect(validateOrgRequest({ ...VALID, message: 'a'.repeat(MAX_MESSAGE_LEN + 1) })).toEqual({
            ok: false,
            field: 'message',
            error: 'too_long',
        });
    });

    it('checks the honeypot before anything else, so a bot learns nothing', () => {
        const result = validateOrgRequest({ website: 'spam', organizationName: '', slug: '', contactEmail: '' });
        expect(result).toEqual({ ok: false, field: null, error: 'honeypot' });
    });
});

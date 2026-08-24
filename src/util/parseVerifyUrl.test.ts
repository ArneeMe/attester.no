import { describe, it, expect } from 'vitest';
import { parseVerifyUrl } from './parseVerifyUrl';

describe('parseVerifyUrl', () => {
    it.each([
        ['https://attester.no/org/echo/verify?t=x&id=y', '/org/echo/verify?t=x&id=y'],
        ['attester.no/org/echo/verify?id=y', '/org/echo/verify?id=y'],
        ['/org/brodkokeri/verify?id=y', '/org/brodkokeri/verify?id=y'],
        ['  /org/echo/verify?id=y \n', '/org/echo/verify?id=y'],
        ['https://attester.no/org/echo/verify/?id=y', '/org/echo/verify?id=y'],
        ['https://attester.no/verify?abc_Ola+Nordmann_Webkom', '/verify?abc_Ola+Nordmann_Webkom'],
        ['/verify?id_name_group_2022-08-01_Leder=', '/verify?id_name_group_2022-08-01_Leder='],
        // Off-site links resolve to a path here, never a redirect away.
        ['https://evil.example/org/echo/verify?id=y', '/org/echo/verify?id=y'],
    ])('%s -> %s', (input, expected) => {
        expect(parseVerifyUrl(input)).toBe(expected);
    });

    it.each([
        '',
        '   ',
        'hei@attester.no',
        'https://attester.no/org/echo',
        'https://attester.no/login',
        'https://attester.no/',
        '/org//verify?id=y',
        '/org/echo/deeper/verify?id=y',
        'not a url at all',
        'javascript:alert(1)//org/echo/verify',
        'data:text/html,/org/echo/verify',
    ])('rejects %j', (input) => {
        expect(parseVerifyUrl(input)).toBeNull();
    });
});

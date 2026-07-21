import { describe, it, expect } from 'vitest';
import { buildCertParams } from './certParams';
import { canonicalHash } from './canonicalHash';
import { selectHashFields } from './verifyFieldSelection';
import { VOLUNTEER_FORM_SCHEMA } from '@/types/formSchema';

// End-to-end: simulate the issuer (admin generating a cert) and the verifier
// (anyone scanning the QR). They must produce the same hash, otherwise certs
// silently fail to verify after issuance.

describe('cert issue ↔ verify round-trip', () => {
    it('issuer params hashed = verifier params hashed (same submission)', async () => {
        const templateId = 'tmpl-1';
        const submissionId = 'sub-1';
        const data = { name: 'Ola', role: 'Leder', group: 'webkom' };

        // Issuer: builds the params from submission and hashes them.
        const issuerParams = buildCertParams(templateId, submissionId, data);
        const issuerHash = await canonicalHash(issuerParams);

        // Verifier: receives the URL with all params, reconstructs a
        // URLSearchParams from them, hashes.
        const url = new URL(`https://attester.no/org/echo/verify?${issuerParams.toString()}`);
        const verifierHash = await canonicalHash(url.searchParams);

        expect(verifierHash).toBe(issuerHash);
    });

    it('a lang UI param appended to the verify URL does not break verification', async () => {
        // Clicking "English" on the verify page writes ?lang=en into the URL,
        // and people copy that URL from the address bar. The verifier drops
        // 'lang' (like 't') before hashing, so a genuine cert must stay valid.
        const issuerParams = buildCertParams('tmpl-1', 'sub-1', { name: 'Ola', role: 'Leder' });
        const issuerHash = await canonicalHash(issuerParams);

        const shared = new URL(`https://attester.no/org/echo/verify?${issuerParams}&lang=en`);
        // Mirrors OrgVerifyClient's field extraction: drop 't' and 'lang'.
        const fields = new URLSearchParams();
        shared.searchParams.forEach((value, key) => {
            if (key !== 't' && key !== 'lang') fields.set(key, value);
        });

        expect(await canonicalHash(fields)).toBe(issuerHash);
    });

    it('the schema allowlist never drops a field an existing cert actually used', async () => {
        // Direct proof that the schema-narrowing added to the verify page
        // (selectHashFields) cannot break an already-issued certificate.
        // Templates are immutable — a real cert's `t` always resolves to the
        // exact form_schema that was in effect when the submission was made
        // — so the fields buildCertParams put in the URL at issuance are
        // always a subset of that same schema's declared keys.
        const data = {
            name: 'Ola Nordmann',
            group: 'Webkom',
            start: '2023-01-01',
            end: '2024-06-30',
            role: 'Leder',
            // Some optional extra-role fields left blank, as a real
            // volunteer submission often has — buildCertParams drops empty
            // values, so these never reach the cert URL at all.
            group1: '',
            start1: '',
        };
        const issuerParams = buildCertParams('tmpl-1', 'sub-1', data);
        const issuerHash = await canonicalHash(issuerParams);

        // Verifier: parse the URL the way OrgVerifyClient does (drop t/lang),
        // then narrow via the production form schema for this template.
        const url = new URL(`https://attester.no/org/echo/verify?${issuerParams}`);
        const fields: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
            if (key !== 't' && key !== 'lang') fields[key] = value;
        });
        const hashInput = selectHashFields(VOLUNTEER_FORM_SCHEMA, fields);

        // Nothing the issuer actually hashed gets dropped by the allowlist.
        expect(Object.keys(hashInput).sort()).toEqual(Object.keys(fields).sort());
        expect(await canonicalHash(new URLSearchParams(hashInput))).toBe(issuerHash);
    });

    it('a tampered field in the URL → different hash', async () => {
        const issuerParams = buildCertParams('t1', 's1', { name: 'Ola', role: 'Leder' });
        const issuerHash = await canonicalHash(issuerParams);

        const tampered = new URLSearchParams(issuerParams);
        tampered.set('role', 'Boss'); // attacker tries to upgrade their role
        const tamperedHash = await canonicalHash(tampered);

        expect(tamperedHash).not.toBe(issuerHash);
    });

    it('changing only t (presentation choice) does not change the hash', async () => {
        const data = { name: 'Ola', role: 'Leder' };
        const a = await canonicalHash(buildCertParams('tmpl-old', 's1', data));
        const b = await canonicalHash(buildCertParams('tmpl-new', 's1', data));
        expect(a).toBe(b);
    });

    it('an attacker cannot remove a required field without changing the hash', async () => {
        const issuerHash = await canonicalHash(buildCertParams('t', 's', { name: 'Ola', role: 'Leder' }));
        // Verifier drops "role" — should hash differently
        const stripped = new URLSearchParams({ t: 't', id: 's', name: 'Ola' });
        const strippedHash = await canonicalHash(stripped);
        expect(strippedHash).not.toBe(issuerHash);
    });

    it('an attacker cannot add a field without changing the hash', async () => {
        const issuerHash = await canonicalHash(buildCertParams('t', 's', { name: 'Ola' }));
        const padded = new URLSearchParams({ t: 't', id: 's', name: 'Ola', injected: 'evil' });
        expect(await canonicalHash(padded)).not.toBe(issuerHash);
    });

    it('an attacker cannot rename the submission id without changing the hash', async () => {
        // The submission id `id` IS in the hash (only `t` is dropped).
        const issuerHash = await canonicalHash(buildCertParams('t', 'real-sub-id', { name: 'Ola' }));
        const renamed = new URLSearchParams({ t: 't', id: 'evil-sub-id', name: 'Ola' });
        expect(await canonicalHash(renamed)).not.toBe(issuerHash);
    });
});

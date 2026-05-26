import { describe, it, expect } from 'vitest';
import { buildCertParams } from './certParams';
import { canonicalHash } from './canonicalHash';

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

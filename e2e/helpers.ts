import { createHash } from 'node:crypto';

/**
 * Node-side mirror of src/util/canonicalHash.ts (drop `t`, sort keys,
 * join k=v with &, SHA-512 hex). Reimplemented with node:crypto instead of
 * imported so the e2e suite has no dependency on the app's tsconfig paths —
 * certRoundTrip.test.ts already guards the algorithm itself.
 */
export function certHash(fields: Record<string, string>): string {
    const sorted = Object.entries(fields)
        .filter(([k]) => k !== 't')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
    return createHash('sha512').update(sorted, 'utf8').digest('hex');
}

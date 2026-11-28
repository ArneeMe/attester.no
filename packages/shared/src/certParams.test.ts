import { describe, it, expect } from 'vitest';
import { buildCertParams } from './certParams';

describe('buildCertParams', () => {
    it('sets t and id explicitly', () => {
        const p = buildCertParams('tmpl-1', 'sub-1', {});
        expect(p.get('t')).toBe('tmpl-1');
        expect(p.get('id')).toBe('sub-1');
    });

    it('copies submission keys onto the params', () => {
        const p = buildCertParams('tmpl-1', 'sub-1', { name: 'Ola', role: 'Leder' });
        expect(p.get('name')).toBe('Ola');
        expect(p.get('role')).toBe('Leder');
    });

    it('drops empty values so the hash is stable across "missing" vs "blank"', () => {
        const p = buildCertParams('tmpl-1', 'sub-1', { name: 'Ola', role: '' });
        expect(p.has('role')).toBe(false);
        expect(p.has('name')).toBe(true);
    });

    it('refuses to let submission data override t or id', () => {
        const p = buildCertParams('tmpl-real', 'sub-real', {
            t: 'attacker-spoof',
            id: 'attacker-spoof',
            name: 'Ola',
        });
        expect(p.get('t')).toBe('tmpl-real');
        expect(p.get('id')).toBe('sub-real');
        expect(p.get('name')).toBe('Ola');
    });

    it('never bakes the reserved lang key into a cert', () => {
        // 'lang' is the verify page's UI language switch; the verifier strips
        // it before hashing, so the issuer must never include it.
        const p = buildCertParams('tmpl-1', 'sub-1', { name: 'Ola', lang: 'en' });
        expect(p.has('lang')).toBe(false);
        expect(p.get('name')).toBe('Ola');
    });

    it('produces the same params for the same input (deterministic)', () => {
        const a = buildCertParams('t', 's', { name: 'Ola', role: 'Leder' });
        const b = buildCertParams('t', 's', { name: 'Ola', role: 'Leder' });
        expect(a.toString()).toBe(b.toString());
    });
});

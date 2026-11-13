import { afterEach, describe, expect, it, vi } from 'vitest';
import { serverError } from './apiError';

afterEach(() => vi.restoreAllMocks());

const HASURA_LEAK =
    'Uniqueness violation. duplicate key value violates unique constraint "certificates_submission_id_key"';

describe('serverError', () => {
    it('never puts the provider message in the response', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = serverError(new Error(HASURA_LEAK), 'api/org/[slug]/certificates');
        const body = await res.json();
        expect(res.status).toBe(500);
        expect(JSON.stringify(body)).not.toContain('certificates_submission_id_key');
        expect(JSON.stringify(body)).not.toContain('Uniqueness violation');
    });

    it('leaves `error` unset so callers fall back to their own message', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const body = await serverError(new Error(HASURA_LEAK), 'ctx').json();
        expect(body).toEqual({ code: 'server_error' });
        expect((body as { error?: string }).error ?? 'Kunne ikke laste maler').toBe(
            'Kunne ikke laste maler',
        );
    });

    it('logs what broke as one JSON line, with quoted values scrubbed out', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        serverError(new Error(HASURA_LEAK), 'api/me/organizations');
        const line = JSON.parse(String(spy.mock.calls[0][0]));
        expect(line).toMatchObject({ level: 'error', event: 'error', place: 'api/me/organizations', kind: 'Error' });
        expect(line.message).toContain('Uniqueness violation');
        expect(line.message).not.toContain('certificates_submission_id_key');
    });

    it('survives a thrown non-Error', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => serverError('a string', 'ctx')).not.toThrow();
    });
});

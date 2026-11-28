import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyPlatformOwner } from './notifyOwner';

const ENV_KEYS = ['NTFY_TOPIC', 'NTFY_SERVER'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
    for (const key of ENV_KEYS) {
        saved[key] = process.env[key];
        delete process.env[key];
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    for (const key of ENV_KEYS) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    }
    vi.restoreAllMocks();
});

function mockFetch(impl: () => Promise<Response> | Response) {
    const fn = vi.fn<(input: unknown, init?: RequestInit) => Promise<Response> | Response>(
        () => impl(),
    );
    vi.stubGlobal('fetch', fn);
    return fn;
}

const ok = () => new Response('', { status: 200 });

function call(fn: ReturnType<typeof mockFetch>) {
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    return { url, init, headers: init.headers as Record<string, string> };
}

describe('notifyPlatformOwner', () => {
    it('sends nothing when no topic is configured', async () => {
        const fetchMock = mockFetch(ok);
        await notifyPlatformOwner('Emne', 'Tekst');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('posts to ntfy.sh by default', async () => {
        process.env.NTFY_TOPIC = 'hemmelig-emne';
        const fetchMock = mockFetch(ok);
        await notifyPlatformOwner('Emne', 'Tekst');
        expect(call(fetchMock).url).toBe('https://ntfy.sh/hemmelig-emne');
    });

    it('honours a self-hosted server, trailing slash and all', async () => {
        process.env.NTFY_TOPIC = 'hemmelig-emne';
        process.env.NTFY_SERVER = 'https://varsel.attester.no/';
        const fetchMock = mockFetch(ok);
        await notifyPlatformOwner('Emne', 'Tekst');
        expect(call(fetchMock).url).toBe('https://varsel.attester.no/hemmelig-emne');
    });

    it('sends the message as the body and the title as a header', async () => {
        process.env.NTFY_TOPIC = 'hemmelig-emne';
        const fetchMock = mockFetch(ok);
        await notifyPlatformOwner('Ny forespørsel', 'Noe venter.');
        const { init, headers } = call(fetchMock);
        expect(init.method).toBe('POST');
        expect(init.body).toBe('Noe venter.');
        expect(headers.Title).toBe('Ny forespørsel');
        expect(headers.Click).toBeUndefined();
    });

    it('adds a click target only when given one', async () => {
        process.env.NTFY_TOPIC = 'hemmelig-emne';
        const fetchMock = mockFetch(ok);
        await notifyPlatformOwner('Emne', 'Tekst', 'https://attester.no/admin');
        expect(call(fetchMock).headers.Click).toBe('https://attester.no/admin');
    });

    it('does not throw when the request fails, so a submission cannot fail with it', async () => {
        process.env.NTFY_TOPIC = 'hemmelig-emne';
        mockFetch(() => Promise.reject(new Error('network down')));
        await expect(notifyPlatformOwner('Emne', 'Tekst')).resolves.toBeUndefined();
    });

    it('does not throw when ntfy rejects the notification', async () => {
        process.env.NTFY_TOPIC = 'hemmelig-emne';
        mockFetch(() => new Response('rate limited', { status: 429 }));
        await expect(notifyPlatformOwner('Emne', 'Tekst')).resolves.toBeUndefined();
    });
});

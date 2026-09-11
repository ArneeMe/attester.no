import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyPlatformOwner, platformOwnerEmail, sendEmail, sendInviteEmail } from './notify';

const ENV_KEYS = [
    'RESEND_API_KEY',
    'NOTIFY_EMAIL_FROM',
    'PLATFORM_NOTIFY_EMAIL',
    'PLATFORM_ADMIN_EMAILS',
] as const;

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

function configure() {
    process.env.RESEND_API_KEY = 'key_test';
    process.env.NOTIFY_EMAIL_FROM = 'attester.no <varsel@attester.no>';
}

function mockFetch(impl: () => Promise<Response> | Response) {
    const fn = vi.fn<(input: unknown, init?: RequestInit) => Promise<Response> | Response>(
        () => impl(),
    );
    vi.stubGlobal('fetch', fn);
    return fn;
}

function sentBody(fn: ReturnType<typeof mockFetch>): Record<string, string | string[]> {
    return JSON.parse(String(fn.mock.calls[0]?.[1]?.body));
}

const MAIL = { to: 'eier@example.com', subject: 'Emne', text: 'Tekst' };

describe('sendEmail reports why a send failed', () => {
    it('names a missing API key rather than silently doing nothing', async () => {
        process.env.NOTIFY_EMAIL_FROM = 'a@b.no';
        const result = await sendEmail(MAIL);
        expect(result).toMatchObject({ sent: false, reason: 'not_configured' });
        expect(result.sent === false && result.detail).toContain('RESEND_API_KEY');
    });

    it('names a missing sender address', async () => {
        process.env.RESEND_API_KEY = 'key_test';
        const result = await sendEmail(MAIL);
        expect(result).toMatchObject({ sent: false, reason: 'not_configured' });
        expect(result.sent === false && result.detail).toContain('NOTIFY_EMAIL_FROM');
    });

    it('names both when neither is set', async () => {
        const result = await sendEmail(MAIL);
        expect(result.sent === false && result.detail).toContain('RESEND_API_KEY');
        expect(result.sent === false && result.detail).toContain('NOTIFY_EMAIL_FROM');
    });

    it('refuses an empty recipient instead of asking Resend to deliver to nobody', async () => {
        configure();
        const fetchMock = mockFetch(() => new Response('{}', { status: 200 }));
        const result = await sendEmail({ ...MAIL, to: '' });
        expect(result).toMatchObject({ sent: false, reason: 'not_configured' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('carries the provider error body through, which is what a bad sender domain looks like', async () => {
        configure();
        mockFetch(() => new Response('{"message":"The attester.no domain is not verified"}', { status: 403 }));
        const result = await sendEmail(MAIL);
        expect(result).toMatchObject({ sent: false, reason: 'rejected' });
        expect(result.sent === false && result.detail).toContain('403');
        expect(result.sent === false && result.detail).toContain('not verified');
    });

    it('distinguishes a thrown request from a rejected one', async () => {
        configure();
        mockFetch(() => Promise.reject(new Error('network down')));
        const result = await sendEmail(MAIL);
        expect(result).toMatchObject({ sent: false, reason: 'error', detail: 'network down' });
    });

    it('reports the recipient on success', async () => {
        configure();
        mockFetch(() => new Response('{"id":"abc"}', { status: 200 }));
        await expect(sendEmail(MAIL)).resolves.toEqual({ sent: true, to: MAIL.to });
    });

    it('posts the configured sender and a single recipient', async () => {
        configure();
        const fetchMock = mockFetch(() => new Response('{}', { status: 200 }));
        await sendEmail(MAIL);
        const body = sentBody(fetchMock);
        expect(body).toMatchObject({
            from: 'attester.no <varsel@attester.no>',
            to: ['eier@example.com'],
            subject: 'Emne',
            text: 'Tekst',
        });
    });
});

describe('platformOwnerEmail', () => {
    it('prefers an explicit address', () => {
        process.env.PLATFORM_NOTIFY_EMAIL = 'varsel@example.com';
        process.env.PLATFORM_ADMIN_EMAILS = 'first@example.com';
        expect(platformOwnerEmail()).toBe('varsel@example.com');
    });

    it('falls back to the first platform admin, so no second secret is needed', () => {
        process.env.PLATFORM_ADMIN_EMAILS = ' first@example.com , second@example.com ';
        expect(platformOwnerEmail()).toBe('first@example.com');
    });

    it('is null when nothing is configured', () => {
        expect(platformOwnerEmail()).toBeNull();
    });

    it('is null for an allowlist of only separators', () => {
        process.env.PLATFORM_ADMIN_EMAILS = ' , , ';
        expect(platformOwnerEmail()).toBeNull();
    });
});

describe('notifyPlatformOwner', () => {
    it('says the owner address is missing rather than sending to nobody', async () => {
        configure();
        const fetchMock = mockFetch(() => new Response('{}', { status: 200 }));
        const result = await notifyPlatformOwner('Emne', 'Tekst');
        expect(result).toMatchObject({ sent: false, reason: 'not_configured' });
        expect(result.sent === false && result.detail).toContain('PLATFORM_ADMIN_EMAILS');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends to the resolved owner', async () => {
        configure();
        process.env.PLATFORM_ADMIN_EMAILS = 'eier@example.com';
        const fetchMock = mockFetch(() => new Response('{}', { status: 200 }));
        await expect(notifyPlatformOwner('Emne', 'Tekst')).resolves.toEqual({
            sent: true,
            to: 'eier@example.com',
        });
        const body = sentBody(fetchMock);
        expect(body.to).toEqual(['eier@example.com']);
    });
});

describe('sendInviteEmail keeps its boolean contract', () => {
    it('is false when email is switched off, so the caller shows the link instead', async () => {
        await expect(sendInviteEmail('a@b.no', 'Echo', 'https://x/y')).resolves.toBe(false);
    });

    it('is true once a send succeeds', async () => {
        configure();
        mockFetch(() => new Response('{}', { status: 200 }));
        await expect(sendInviteEmail('a@b.no', 'Echo', 'https://x/y')).resolves.toBe(true);
    });

    it('includes the org name and the link', async () => {
        configure();
        const fetchMock = mockFetch(() => new Response('{}', { status: 200 }));
        await sendInviteEmail('a@b.no', 'Echo', 'https://attester.no/registrer?invite=abc');
        const body = sentBody(fetchMock);
        expect(body.subject).toContain('Echo');
        expect(body.text).toContain('https://attester.no/registrer?invite=abc');
    });
});

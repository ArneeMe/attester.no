// Matches both /org/<slug>/verify and the legacy positional /verify, whose QR
// codes are printed on paper and must keep working (CLAUDE.md).
const VERIFY_PATH = /^\/(?:org\/([^/]+)\/)?verify$/;

export const parseVerifyUrl = (input: string): string | null => {
    const raw = input.trim();
    if (!raw) return null;

    let url: URL;
    try {
        const scheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
        const host = raw.startsWith('//') || /^[^/?#]+\.[^/?#]+/.test(raw);
        url = new URL(
            scheme ? raw : host ? `https://${raw.replace(/^\/\//, '')}` : raw,
            'https://attester.no',
        );
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

    const match = VERIFY_PATH.exec(url.pathname.replace(/\/+$/, ''));
    if (!match) return null;
    return `${match[1] ? `/org/${match[1]}` : ''}/verify${url.search}`;
};

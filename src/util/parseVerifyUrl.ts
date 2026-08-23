/**
 * Turn a certificate link pasted into the landing page's verify field into a
 * path on this site, or `null` if it isn't a verify link at all.
 *
 * Two shapes are accepted, because two are in circulation:
 *
 * - `/org/<slug>/verify?t=…&id=…&…` — current, key=value params.
 * - `/verify?<positional underscore-joined string>` — legacy echo certs.
 *   Their QR codes were printed onto paper before the multi-org migration
 *   and cannot be reissued; see CLAUDE.md "The legacy /verify route". A
 *   landing page that refused them would break verification for every
 *   certificate echo handed out before 2026.
 *
 * The query string is passed through byte-for-byte. The legacy verify page
 * parses `useSearchParams().toString()` positionally and compensates for a
 * trailing `=`, so any normalisation here would silently corrupt the value it
 * hashes.
 *
 * Only ever returns a path, never an absolute URL: pasting a link that points
 * at another origin resolves to the same path on attester.no rather than
 * navigating off-site, so this cannot be used as an open redirect.
 */
export const parseVerifyUrl = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const url = toUrl(trimmed);
    if (!url) return null;

    // Trailing slashes are common when a link is copied out of a PDF viewer.
    const path = url.pathname.replace(/\/+$/, '');

    const orgMatch = /^\/org\/([^/]+)\/verify$/.exec(path);
    if (orgMatch) return `/org/${orgMatch[1]}/verify${url.search}`;

    if (path === '/verify') return `/verify${url.search}`;

    return null;
};

/**
 * Parse the pasted text against a dummy origin so that bare paths, bare
 * hostnames, and full URLs all end up as a `URL` we can read a pathname off.
 * The origin itself is discarded by the caller.
 */
const toUrl = (input: string): URL | null => {
    const base = 'https://attester.no';
    try {
        // Absolute URL with a scheme. Reject non-http(s) so a pasted
        // `javascript:` or `data:` string can't reach the router.
        if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
            const parsed = new URL(input);
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                return null;
            }
            return parsed;
        }
        // Scheme-relative (`//host/path`) or bare host (`attester.no/...`):
        // anything whose first segment looks like a hostname.
        if (input.startsWith('//') || /^[^/?#]+\.[^/?#]+/.test(input)) {
            return new URL(`https://${input.replace(/^\/\//, '')}`);
        }
        // Plain path.
        return new URL(input, base);
    } catch {
        return null;
    }
};

// Tells the platform that the page broke: the error's name, message and code
// positions, and which kind of page it was. Never which page exactly, never
// the address bar's query, never who was looking at it.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_AFTER = new Set(['org', 'adminpage']);
const MAX_PER_PAGE = 5;

let sent = 0;

// "/org/echo/verify" becomes "/org/:slug/verify". The verify page's query
// holds the whole certificate, so the query is never part of this.
export function routePattern(pathname: string): string {
    const parts = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean);
    const out = parts.map((part, i) => {
        if (i > 0 && SLUG_AFTER.has(parts[i - 1])) return ':slug';
        if (UUID_RE.test(part)) return ':id';
        return part;
    });
    return '/' + out.join('/');
}

export function reportBrowserError(error: unknown): void {
    try {
        if (typeof window === 'undefined' || sent >= MAX_PER_PAGE) return;
        sent++;
        const e = error instanceof Error ? error : new Error(String(error));
        void fetch('/api/v1/errors', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
                source: 'browser',
                place: routePattern(window.location.pathname),
                kind: e.name,
                message: e.message,
                stack: e.stack ?? '',
            }),
        }).catch(() => undefined);
    } catch {
        // Reporting must never be the thing that fails.
    }
}

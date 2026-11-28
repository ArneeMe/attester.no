// Next calls this when a server component, a route handler or the forwarder
// throws. It reports to the API the same way the browser does, so the web
// app needs nothing from its host to be heard. `routePath` is the route's
// pattern ("/org/[orgSlug]"), never the address that was asked for.
export async function onRequestError(
    error: unknown,
    _request: unknown,
    context: { routePath?: string },
): Promise<void> {
    try {
        const base = process.env.API_URL;
        if (!base) return;
        const e = error instanceof Error ? error : new Error(String(error));
        await fetch(`${base.replace(/\/+$/, '')}/errors`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                source: 'web',
                place: context.routePath ?? 'unknown',
                kind: e.name,
                message: e.message,
                stack: e.stack ?? '',
            }),
            signal: AbortSignal.timeout(3000),
        });
    } catch {
        // The API may be the thing that is down.
    }
}

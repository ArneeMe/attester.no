import type { IncomingMessage, ServerResponse } from "node:http";

// Signed-in callers upload templates: a PDF of up to 5 MB plus its layout.
export const MAX_BODY_BYTES = 12 * 1024 * 1024;
// Anonymous callers only ever send a form. Without this, anyone could make
// the server hold megabytes per request before a route gets to refuse it.
export const MAX_ANONYMOUS_BODY_BYTES = 128 * 1024;

export class BodyTooLarge extends Error {}

function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
    if (req.method === "GET" || req.method === "HEAD") return Promise.resolve(undefined);
    const limit = req.headers.authorization ? MAX_BODY_BYTES : MAX_ANONYMOUS_BODY_BYTES;
    if (Number(req.headers["content-length"] ?? 0) > limit) return Promise.reject(new BodyTooLarge());
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        req.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > limit) {
                req.destroy();
                reject(new BodyTooLarge());
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

export async function toRequest(req: IncomingMessage): Promise<Request> {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    // The host header is only used to form a valid URL. Links the API hands
    // out are built from PUBLIC_APP_URL, never from this.
    const url = new URL(req.url ?? "/", "http://api.internal");
    const body = await readBody(req);
    return new Request(url, {
        method: req.method,
        headers,
        body: body && body.length > 0 ? new Uint8Array(body) : undefined,
    });
}

export async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
}

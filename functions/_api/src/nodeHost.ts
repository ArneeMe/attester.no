import type { IncomingMessage, ServerResponse } from "node:http";

type NodeRequest = IncomingMessage & {
    rawBody?: string | Buffer;
    body?: unknown;
    originalUrl?: string;
};

function readBody(req: NodeRequest): Promise<Buffer | undefined> | Buffer | undefined {
    if (req.method === "GET" || req.method === "HEAD") return undefined;
    if (req.rawBody !== undefined) return Buffer.from(req.rawBody);
    if (req.body !== undefined && req.body !== null) {
        return Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    }
    if (req.readableEnded) return undefined;
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

export async function toRequest(req: NodeRequest): Promise<Request> {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.originalUrl ?? req.url ?? "/", `http://${host}`);
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

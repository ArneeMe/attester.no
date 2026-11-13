import { requestContext } from "./lib/requestContext";

export function json(body: unknown, init?: ResponseInit): Response {
    return Response.json(body, init);
}

// Where the web app lives. Links in emails, QR codes and PDFs are built from
// this and never from the request, whose Host header the caller controls.
export function appOrigin(): string {
    const origin = process.env.PUBLIC_APP_URL;
    if (!origin) throw new Error("PUBLIC_APP_URL not configured");
    return origin.replace(/\/+$/, "");
}

type Params = Record<string, string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx: { params: Promise<any> }) => Promise<Response> | Response;
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type RouteModule = Partial<Record<Method, Handler>>;

type Route = { segments: string[]; module: RouteModule };

export class Router {
    private routes: Route[] = [];

    add(pattern: string, module: RouteModule): this {
        this.routes.push({ segments: split(pattern), module });
        return this;
    }

    async handle(req: Request, path: string): Promise<Response> {
        const parts = split(path);
        for (const route of this.routes) {
            const params = match(route.segments, parts);
            if (!params) continue;
            const handler = route.module[req.method as Method];
            const ctx = requestContext();
            if (ctx) ctx.route = "/" + route.segments.join("/");
            if (!handler) return json({ error: "Method not allowed" }, { status: 405 });
            return handler(req, { params: Promise.resolve(params) });
        }
        return json({ error: "Not found" }, { status: 404 });
    }
}

function split(path: string): string[] {
    return path.split("/").filter(Boolean);
}

function match(pattern: string[], parts: string[]): Params | null {
    if (pattern.length !== parts.length) return null;
    const params: Params = {};
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i].startsWith(":")) {
            try {
                params[pattern[i].slice(1)] = decodeURIComponent(parts[i]);
            } catch {
                return null;
            }
        } else if (pattern[i] !== parts[i]) {
            return null;
        }
    }
    return params;
}

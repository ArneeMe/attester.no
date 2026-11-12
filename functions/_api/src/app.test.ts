import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { handleApi } from "./app";
import { nodeHandler } from "./nodeHost";

const hasuraCalls: Array<{ query: string; variables: Record<string, unknown> }> = [];
let hasuraData: Record<string, unknown> = {};
const realFetch = globalThis.fetch;

beforeEach(() => {
    process.env.HASURA_GRAPHQL_URL = "http://hasura.test/v1/graphql";
    process.env.AUTH_JWKS_URL = "http://auth.test/jwks.json";
    process.env.NHOST_ADMIN_SECRET = "test-secret";
    hasuraCalls.length = 0;
    hasuraData = {};
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("http://hasura.test")) {
            hasuraCalls.push(JSON.parse(String(init?.body)));
            return Response.json({ data: hasuraData });
        }
        return realFetch(input, init);
    });
});

afterEach(() => vi.unstubAllGlobals());

describe("handleApi", () => {
    it("routes by pathname", async () => {
        hasuraData = { organizations: [{ slug: "echo", name: "echo" }] };
        const res = await handleApi(new Request("http://api.test/orgs"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ organizations: [{ slug: "echo", name: "echo" }] });
    });

    it("routes by the __path parameter, which a single Nhost function needs", async () => {
        hasuraData = { organizations: [{ id: "1", slug: "echo", name: "echo" }] };
        const res = await handleApi(new Request("http://fn.test/v1/api?__path=/org/echo"));
        expect(res.status).toBe(200);
        expect(hasuraCalls[0].variables).toEqual({ slug: "echo" });
    });

    it("decodes path parameters", async () => {
        hasuraData = { organizations: [] };
        const res = await handleApi(new Request("http://api.test/org/r%C3%B8de-kors"));
        expect(res.status).toBe(404);
        expect(hasuraCalls[0].variables).toEqual({ slug: "røde-kors" });
    });

    it("answers 404 for an unknown path and 405 for an unknown method", async () => {
        expect((await handleApi(new Request("http://api.test/nope"))).status).toBe(404);
        expect((await handleApi(new Request("http://api.test/orgs", { method: "DELETE" }))).status).toBe(405);
    });

    it("rejects an org-scoped call without a session before touching the database", async () => {
        const res = await handleApi(new Request("http://api.test/org/echo/certificates"));
        expect(res.status).toBe(401);
        expect(hasuraCalls).toHaveLength(0);
    });

    it("never returns the database error text", async () => {
        vi.stubGlobal("fetch", async () =>
            Response.json({ errors: [{ message: 'relation "secret_table" does not exist' }] }),
        );
        const res = await handleApi(new Request("http://api.test/orgs"));
        expect(res.status).toBe(500);
        expect(await res.text()).not.toContain("secret_table");
    });
});

describe("nodeHandler", () => {
    let server: Server;
    let base: string;

    beforeEach(async () => {
        server = createServer((req, res) => void nodeHandler(req, res));
        await new Promise<void>((resolve) => server.listen(0, resolve));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

    it("serves the API over plain Node HTTP", async () => {
        hasuraData = { organizations: [{ slug: "echo", name: "echo" }] };
        const res = await realFetch(`${base}/v1/api?__path=/orgs`);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("application/json");
        expect(await res.json()).toEqual({ organizations: [{ slug: "echo", name: "echo" }] });
    });

    it("passes a JSON body through to the handler", async () => {
        const res = await realFetch(`${base}/org-requests`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ nope: true }),
        });
        expect(res.status).toBe(400);
        expect(hasuraCalls).toHaveLength(0);
    });

    it("uses a body the host already parsed, as Nhost does", async () => {
        const { toRequest } = await import("./nodeHost");
        const fake = Object.assign(Object.create(null), {
            method: "POST",
            headers: { host: "fn.test", "content-type": "application/json" },
            originalUrl: "/v1/api?__path=/org-requests",
            body: { a: 1 },
        });
        const req = await toRequest(fake);
        expect(await req.json()).toEqual({ a: 1 });
        expect(new URL(req.url).searchParams.get("__path")).toBe("/org-requests");
    });
});

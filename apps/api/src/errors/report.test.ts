import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleApi } from "../app";
import { useErrorSinkForTests } from "../channels";
import { scrub } from "../lib/log";
import type { ErrorReport } from "../ports";
import { flushErrors, reportError, resetErrorsForTests } from "./report";

let stored: ErrorReport[];
let lines: Array<Record<string, unknown>>;
let seen: Set<string>;

beforeEach(() => {
    stored = [];
    lines = [];
    seen = new Set();
    resetErrorsForTests();
    delete process.env.NTFY_TOPIC;
    useErrorSinkForTests({
        async record(report) {
            stored.push(report);
            const isNew = !seen.has(report.fingerprint);
            seen.add(report.fingerprint);
            return isNew;
        },
    });
    const capture = (line: unknown) => void lines.push(JSON.parse(String(line)));
    vi.spyOn(console, "error").mockImplementation(capture);
    vi.spyOn(console, "log").mockImplementation(capture);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    useErrorSinkForTests(undefined);
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("scrub", () => {
    it("removes anything that could be a person's data and keeps the shape of the message", () => {
        const dirty =
            'invalid input syntax for type uuid: "Ola Nordmann" for ola@example.no, fnr 01018099912, '
            + "row 3f1c2b4a-1111-2222-3333-444455556666 value 'Leder' in `data`";
        const clean = scrub(dirty);
        for (const secret of ["Ola", "Nordmann", "ola@example.no", "01018099912", "3f1c2b4a", "Leder"]) {
            expect(clean).not.toContain(secret);
        }
        expect(clean).toContain("invalid input syntax for type uuid");
    });

    it("bounds the length", () => {
        expect(scrub("x".repeat(5000)).length).toBeLessThanOrEqual(300);
    });
});

describe("reportError", () => {
    it("stores what broke and where, scrubbed, and nothing about who", async () => {
        reportError(new Error('duplicate key "Ola Nordmann" 01018099912'), "api", "/org/:slug/submissions");
        await settle();
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({ source: "api", place: "/org/:slug/submissions", kind: "Error", count: 1 });
        expect(JSON.stringify(stored[0])).not.toContain("Ola");
        expect(JSON.stringify(stored[0])).not.toContain("01018099912");
        expect(Object.keys(stored[0]).sort()).toEqual(
            ["count", "fingerprint", "kind", "message", "place", "requestId", "source", "stack"],
        );
    });

    it("keeps the stack as code positions without the message line", async () => {
        reportError(new Error("secret 01018099912"), "job", "scheduled");
        await settle();
        expect(stored[0].stack).toMatch(/^at /);
        expect(stored[0].stack).not.toContain("secret");
    });

    it("gives the same error the same fingerprint and different places different ones", async () => {
        const fail = () => new Error("boom");
        const e = fail();
        reportError(e, "api", "/a");
        reportError(e, "api", "/b");
        await settle();
        expect(stored[0].fingerprint).not.toBe(stored[1].fingerprint);
    });

    it("writes a repeating error once a minute with a count, not once per failure", async () => {
        vi.useFakeTimers({ now: 1_000_000 });
        const e = new Error("database down");
        for (let i = 0; i < 50; i++) reportError(e, "api", "/orgs");
        await vi.advanceTimersByTimeAsync(1);
        expect(stored).toHaveLength(1);
        expect(stored[0].count).toBe(1);

        await vi.advanceTimersByTimeAsync(61_000);
        reportError(e, "api", "/orgs");
        await vi.advanceTimersByTimeAsync(1);
        expect(stored).toHaveLength(2);
        expect(stored[1].count).toBe(50);
    });

    it("flushes held-back counts on request", async () => {
        const e = new Error("x");
        reportError(e, "api", "/orgs");
        reportError(e, "api", "/orgs");
        await settle();
        await flushErrors();
        expect(stored.map((r) => r.count)).toEqual([1, 1]);
    });

    it("never throws, whatever is thrown at it and whatever the store does", async () => {
        useErrorSinkForTests({ record: async () => Promise.reject(new Error("store down")) });
        expect(() => reportError(undefined, "api", "/x")).not.toThrow();
        expect(() => reportError({ toString: () => { throw new Error("no"); } }, "api", "/y")).not.toThrow();
        await settle();
    });

    it("works with the store switched off: the log line is still written", async () => {
        useErrorSinkForTests(null);
        reportError(new Error("boom"), "api", "/orgs");
        await settle();
        expect(lines.some((l) => l.event === "error" && l.place === "/orgs")).toBe(true);
    });

    it("pings the owner about a new kind of error without saying what it is", async () => {
        process.env.NTFY_TOPIC = "topic";
        const pushes: Array<{ body: unknown; headers: Record<string, string> }> = [];
        vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
            pushes.push({ body: init.body, headers: init.headers as Record<string, string> });
            return new Response("");
        });
        reportError(new Error('secret "Ola"'), "api", "/orgs");
        await settle();
        await settle();
        expect(pushes).toHaveLength(1);
        expect(JSON.stringify(pushes[0])).not.toContain("Ola");
        expect(JSON.stringify(pushes[0])).not.toContain("/orgs");
    });
});

describe("request logging", () => {
    beforeEach(() => {
        process.env.HASURA_GRAPHQL_URL = "http://hasura.test/v1/graphql";
        process.env.NHOST_ADMIN_SECRET = "s";
    });

    it("writes one line per request with the route pattern, never the path or the caller", async () => {
        vi.stubGlobal("fetch", async () => Response.json({ data: { organizations: [] } }));
        const res = await handleApi(
            new Request("http://api.test/v1/org/hemmelig-slug?x=1", {
                headers: { "x-forwarded-for": "203.0.113.9", "user-agent": "Browser/1.0" },
            }),
        );
        const line = lines.find((l) => l.event === "request")!;
        expect(line).toMatchObject({ method: "GET", route: "/org/:slug", status: 404, level: "info" });
        expect(Object.keys(line).sort()).toEqual(["event", "level", "method", "ms", "requestId", "route", "status", "time"]);
        expect(JSON.stringify(line)).not.toContain("hemmelig-slug");
        expect(JSON.stringify(line)).not.toContain("203.0.113.9");
        expect(res.headers.get("x-request-id")).toBe(line.requestId);
    });

    it("hands the caller a request id that finds the error, and nothing else", async () => {
        vi.stubGlobal("fetch", async () => Response.json({ errors: [{ message: 'relation "x" 01018099912' }] }));
        const res = await handleApi(new Request("http://api.test/v1/orgs"));
        const body = (await res.json()) as { code: string; requestId: string };
        expect(res.status).toBe(500);
        expect(Object.keys(body).sort()).toEqual(["code", "requestId"]);
        await settle();
        expect(stored[0].requestId).toBe(body.requestId);
        expect(stored[0].place).toBe("/orgs");
        expect(lines.find((l) => l.event === "error")?.requestId).toBe(body.requestId);
    });
});

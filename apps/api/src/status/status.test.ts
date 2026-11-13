import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleApi } from "../app";
import { useNoticeChannelForTests } from "../channels";
import { hashStatusToken, newStatusToken, reminderState } from "./status";

const ORG = "11111111-1111-1111-1111-111111111111";
const SUB = "44444444-4444-4444-4444-444444444444";
const DAY = 24 * 3600_000;

type Call = { query: string; variables: Record<string, unknown> };
type Row = { id: string; created_at: string; issued_at: string | null; reminded_at: string | null; reminder_count: number };

let calls: Call[];
let row: Row | null;
let tokenHash: string;
let token: string;
let sent: number;

const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

beforeEach(() => {
    process.env.HASURA_GRAPHQL_URL = "http://hasura.test/v1/graphql";
    process.env.NHOST_ADMIN_SECRET = "s";
    process.env.PUBLIC_APP_URL = "https://attester.no";
    calls = [];
    sent = 0;
    const made = newStatusToken();
    token = made.token;
    tokenHash = made.hash;
    row = { id: SUB, created_at: daysAgo(4), issued_at: null, reminded_at: null, reminder_count: 0 };
    useNoticeChannelForTests({ send: async () => void sent++ });
    vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
        const call = JSON.parse(String(init?.body)) as Call;
        calls.push(call);
        const q = call.query;
        const v = call.variables ?? {};
        let data: unknown = {};
        if (q.includes("GetOrgIdBySlug")) data = { organizations: v.slug === "echo" ? [{ id: ORG }] : [] };
        else if (q.includes("SubmissionStatus") || q.includes("SubmissionForReminder")) {
            data = { submissions: row && v.hash === tokenHash && v.organizationId === ORG ? [row] : [] };
        } else if (q.includes("StatusDelivery")) data = { deliveries: [] };
        else if (q.includes("RecordReminder")) {
            const ok = row !== null && row.reminder_count === v.count;
            if (ok) Object.assign(row!, { reminder_count: row!.reminder_count + 1, reminded_at: v.now });
            data = { update_submissions: { affected_rows: ok ? 1 : 0 } };
        } else if (q.includes("PendingNotice") || q.includes("UnsentNotices")) data = { notices: [] };
        else if (q.includes("QueueNotice")) data = {};
        else throw new Error(`unexpected ${q.slice(0, 40)}`);
        return Response.json({ data });
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useNoticeChannelForTests(undefined);
});

const post = (path: string, body: unknown) =>
    handleApi(new Request(`http://api.test/v1${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("status token", () => {
    it("is long, random and stored only as a hash", () => {
        const a = newStatusToken();
        const b = newStatusToken();
        expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(a.token).not.toBe(b.token);
        expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
        expect(a.hash).not.toContain(a.token);
        expect(hashStatusToken(a.token)).toBe(a.hash);
    });

    it("refuses anything that cannot be a token before the database is asked", async () => {
        for (const junk of ["", "short", 5, null, "x".repeat(44), `${"a".repeat(42)}!`]) expect(hashStatusToken(junk)).toBeNull();
        expect((await post("/org/echo/status", { token: "junk" })).status).toBe(404);
        expect(calls).toHaveLength(0);
    });
});

describe("the volunteer's status page", () => {
    it("answers with dates and nothing that says who or what", async () => {
        const res = await post("/org/echo/status", { token });
        const body = (await res.json()) as Record<string, unknown>;
        expect(res.status).toBe(200);
        expect(Object.keys(body).sort()).toEqual(["deletedAt", "digipost", "issuedAt", "reminder", "status", "submittedAt"]);
        expect(body).toMatchObject({ status: "waiting", issuedAt: null, deletedAt: null, digipost: null });
        expect(JSON.stringify(body)).not.toContain(SUB);
    });

    it("says when an issued request will be deleted, and offers no reminder", async () => {
        row!.issued_at = "2026-11-13T10:00:00.000Z";
        const body = (await (await post("/org/echo/status", { token })).json()) as Record<string, unknown>;
        expect(body).toMatchObject({ status: "issued", deletedAt: "2026-11-14T10:00:00.000Z", reminder: null });
    });

    it("gives one answer for a wrong token, a deleted request and another organisation", async () => {
        const wrong = await post("/org/echo/status", { token: newStatusToken().token });
        row = null;
        const deleted = await post("/org/echo/status", { token });
        const otherOrg = await post("/org/annen/status", { token });
        for (const res of [wrong, deleted, otherOrg]) {
            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({ error: "Not found" });
        }
    });

    it("never sends the token itself to the database", async () => {
        await post("/org/echo/status", { token });
        expect(JSON.stringify(calls)).not.toContain(token);
    });
});

describe("reminderState", () => {
    const base = { created_at: "2026-11-01T00:00:00.000Z", reminded_at: null, reminder_count: 0 };
    it("opens three days after the request was sent in", () => {
        expect(reminderState(base)).toEqual({ canRemindAt: "2026-11-04T00:00:00.000Z", remaining: 3 });
    });
    it("then waits a week after each reminder", () => {
        expect(reminderState({ ...base, reminded_at: "2026-11-05T00:00:00.000Z", reminder_count: 1 }))
            .toEqual({ canRemindAt: "2026-11-12T00:00:00.000Z", remaining: 2 });
    });
    it("closes for good after three", () => {
        expect(reminderState({ ...base, reminded_at: "2026-11-20T00:00:00.000Z", reminder_count: 3 }))
            .toEqual({ canRemindAt: null, remaining: 0 });
    });
});

describe("reminding the organisation", () => {
    const remind = () => post("/org/echo/status/remind", { token });
    const queued = () => calls.filter((c) => c.query.includes("QueueNotice")).length;

    it("queues the ordinary notice, which names nobody", async () => {
        const res = await remind();
        expect(res.status).toBe(200);
        expect(queued()).toBe(1);
        expect(calls.find((c) => c.query.includes("QueueNotice"))!.variables).toEqual({ organizationId: ORG });
        expect(((await res.json()) as { reminder: { remaining: number } }).reminder.remaining).toBe(2);
    });

    it("refuses a second reminder inside the week", async () => {
        await remind();
        const again = await remind();
        expect(again.status).toBe(429);
        expect(queued()).toBe(1);
    });

    it("refuses before the request has waited three days", async () => {
        row!.created_at = daysAgo(1);
        expect((await remind()).status).toBe(429);
        expect(queued()).toBe(0);
    });

    it("refuses after three reminders, however long ago", async () => {
        Object.assign(row!, { reminder_count: 3, reminded_at: daysAgo(100), created_at: daysAgo(200) });
        expect((await remind()).status).toBe(429);
        expect(queued()).toBe(0);
    });

    it("counts two clicks at the same moment as one", async () => {
        const [a, b] = await Promise.all([remind(), remind()]);
        expect([a.status, b.status].sort()).toEqual([200, 200]);
        expect(row!.reminder_count).toBe(1);
        expect(queued()).toBe(1);
    });

    it("refuses once the certificate is issued, and when no email is set up", async () => {
        row!.issued_at = daysAgo(0);
        expect((await remind()).status).toBe(409);
        row!.issued_at = null;
        useNoticeChannelForTests(null);
        expect((await remind()).status).toBe(409);
        expect(queued()).toBe(0);
    });

    it("answers a wrong token like a missing request", async () => {
        expect((await post("/org/echo/status/remind", { token: newStatusToken().token })).status).toBe(404);
    });
});

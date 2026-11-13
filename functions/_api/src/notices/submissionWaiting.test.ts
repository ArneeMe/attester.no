import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Notice } from "../ports";
import { useNoticeChannelForTests } from "../channels";
import { dispatchNotices, queueSubmissionNotice } from "./submissionWaiting";
import { handleTick } from "../jobs/tick";

type Row = { id: string; organization_id: string; sent_at: string | null; attempts: number };
type Call = { query: string; variables: Record<string, unknown> };

const ORG = "org-1";
let rows: Row[];
let waiting: boolean;
let calls: Call[];
let sentMail: Notice[];
let failSend: boolean;

beforeEach(() => {
    process.env.HASURA_GRAPHQL_URL = "http://hasura.test/v1/graphql";
    process.env.NHOST_ADMIN_SECRET = "test-secret";
    rows = [];
    waiting = true;
    calls = [];
    sentMail = [];
    failSend = false;
    useNoticeChannelForTests({
        async send(notice) {
            if (failSend) throw new Error("provider down");
            sentMail.push(notice);
        },
    });
    vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
        const call = JSON.parse(String(init?.body)) as Call;
        calls.push(call);
        const q = call.query;
        const v = call.variables ?? {};
        const unsent = rows.filter((r) => r.sent_at === null);
        let data: unknown = {};
        if (q.includes("PendingNotice")) data = { notices: unsent.filter((r) => r.organization_id === v.organizationId) };
        else if (q.includes("QueueNotice")) {
            rows.push({ id: `n${rows.length}`, organization_id: String(v.organizationId), sent_at: null, attempts: 0 });
        } else if (q.includes("UnsentNotices")) data = { notices: unsent.filter((r) => r.attempts < Number(v.maxAttempts)) };
        else if (q.includes("RecentNotice")) {
            data = { notices: rows.filter((r) => r.sent_at !== null && r.sent_at >= String(v.since)) };
        } else if (q.includes("NoticeRecipients")) {
            data = {
                organizations: [{ name: "Echo", slug: "echo" }],
                user_organizations: [{ user_id: "u1" }, { user_id: "u2" }],
                submissions: waiting ? [{ id: "s1" }] : [],
            };
        } else if (q.includes("GetUsersByIds")) {
            data = { users: [{ id: "u1", email: "a@echo.no" }, { id: "u2", email: "b@echo.no" }] };
        } else if (q.includes("MarkNoticesSent")) {
            rows = rows.filter((r) => r.sent_at === null);
            rows.forEach((r) => (r.sent_at = String(v.now)));
        } else if (q.includes("NoticeAttempt")) unsent.forEach((r) => r.attempts++);
        else if (q.includes("SweepExpired")) data = { delete_submissions: { affected_rows: 0 } };
        else if (q.includes("QueuedDeliveries")) data = { deliveries: [] };
        else throw new Error(`unexpected query ${q.slice(0, 40)}`);
        return Response.json({ data });
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    useNoticeChannelForTests(undefined);
});

const NOW = new Date("2026-11-13T10:00:00Z");

describe("submission notices", () => {
    it("emails every admin once, with a link and nothing about the volunteer", async () => {
        await queueSubmissionNotice(ORG);
        expect(await dispatchNotices("https://attester.no", NOW)).toBe(1);
        expect(sentMail).toHaveLength(1);
        expect(sentMail[0].to).toEqual(["a@echo.no", "b@echo.no"]);
        expect(sentMail[0].text).toContain("https://attester.no/login/adminpage/echo");
        expect(rows.every((r) => r.sent_at !== null)).toBe(true);
    });

    it("stores only the organisation in the outbox", async () => {
        await queueSubmissionNotice(ORG);
        const insert = calls.find((c) => c.query.includes("QueueNotice"))!;
        expect(insert.variables).toEqual({ organizationId: ORG });
    });

    it("queues one notice however many submissions arrive", async () => {
        await queueSubmissionNotice(ORG);
        await queueSubmissionNotice(ORG);
        await queueSubmissionNotice(ORG);
        expect(rows).toHaveLength(1);
    });

    it("stays quiet inside the window and sends once it has passed", async () => {
        await queueSubmissionNotice(ORG);
        await dispatchNotices("https://attester.no", NOW);
        await queueSubmissionNotice(ORG);
        await dispatchNotices("https://attester.no", new Date(NOW.getTime() + 3600_000));
        expect(sentMail).toHaveLength(1);
        await dispatchNotices("https://attester.no", new Date(NOW.getTime() + 7 * 3600_000));
        expect(sentMail).toHaveLength(2);
    });

    it("does not email about a queue that has been cleared in the meantime", async () => {
        await queueSubmissionNotice(ORG);
        waiting = false;
        expect(await dispatchNotices("https://attester.no", NOW)).toBe(0);
        expect(sentMail).toHaveLength(0);
        expect(rows.every((r) => r.sent_at !== null)).toBe(true);
    });

    it("keeps the notice for a retry when the provider fails, and gives up after five tries", async () => {
        await queueSubmissionNotice(ORG);
        failSend = true;
        for (let i = 0; i < 6; i++) await dispatchNotices("https://attester.no", NOW);
        expect(rows[0].sent_at).toBeNull();
        expect(rows[0].attempts).toBe(5);
        failSend = false;
        await dispatchNotices("https://attester.no", NOW);
        expect(sentMail).toHaveLength(0);
    });

    it("does nothing at all when no email provider is configured", async () => {
        useNoticeChannelForTests(null);
        await queueSubmissionNotice(ORG);
        expect(await dispatchNotices("https://attester.no", NOW)).toBe(0);
        expect(calls).toHaveLength(0);
    });
});

describe("tick", () => {
    it("refuses a call without the webhook secret", async () => {
        process.env.NHOST_WEBHOOK_SECRET = "s3cret";
        expect((await handleTick(new Request("http://fn.test/v1/tick", { method: "POST" }))).status).toBe(401);
        const wrong = new Request("http://fn.test/v1/tick", { method: "POST", headers: { "nhost-webhook-secret": "nope" } });
        expect((await handleTick(wrong)).status).toBe(401);
        expect(calls).toHaveLength(0);
    });

    it("refuses everything when no secret is configured", async () => {
        delete process.env.NHOST_WEBHOOK_SECRET;
        const req = new Request("http://fn.test/v1/tick", { method: "POST", headers: { "nhost-webhook-secret": "" } });
        expect((await handleTick(req)).status).toBe(401);
    });

    it("sweeps and sends queued notices", async () => {
        process.env.NHOST_WEBHOOK_SECRET = "s3cret";
        await queueSubmissionNotice(ORG);
        const req = new Request("http://fn.test/v1/tick", { method: "POST", headers: { "nhost-webhook-secret": "s3cret" } });
        const res = await handleTick(req);
        expect(await res.json()).toEqual({ ok: true, notices: 1, deliveries: 0 });
        expect(calls.some((c) => c.query.includes("SweepExpired"))).toBe(true);
    });
});

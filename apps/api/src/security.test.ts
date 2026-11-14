import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { randomBytes } from "node:crypto";
import { handleApi } from "./app";
import { useCertificateChannelForTests } from "./channels";

// Drives the real routes with a real signed token against a scripted Hasura.

const ORG = "11111111-1111-1111-1111-111111111111";
const USER = "22222222-2222-2222-2222-222222222222";
const TMPL = "33333333-3333-3333-3333-333333333333";
const SUB = "44444444-4444-4444-4444-444444444444";

let privateKey: CryptoKey;
let jwk: JWK;
let token: string;

type Call = { query: string; variables: Record<string, unknown> };
let calls: Call[];
let answers: Record<string, unknown>;
const mutations = () =>
    calls.filter((c) => c.query.trimStart().startsWith("mutation") && !c.query.includes("SweepExpired"));

beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    privateKey = pair.privateKey;
    jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
    token = await new SignJWT({ "https://hasura.io/jwt/claims": { "x-hasura-user-id": USER } })
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .setExpirationTime("10m")
        .sign(privateKey);
});

beforeEach(() => {
    process.env.HASURA_GRAPHQL_URL = "http://hasura.test/v1/graphql";
    process.env.AUTH_JWKS_URL = "http://auth.test/jwks.json";
    process.env.NHOST_ADMIN_SECRET = "test-secret";
    process.env.PUBLIC_APP_URL = "https://attester.no";
    process.env.PLATFORM_ADMIN_EMAILS = "owner@attester.no";
    calls = [];
    answers = {
        GetOrgIdBySlug: { organizations: [{ id: ORG }] },
        CheckMembership: { user_organizations: [{ user_id: USER }] },
        GetUsersByIds: { users: [{ id: USER, email: "admin@echo.no", displayName: null, emailVerified: true }] },
        SweepExpired: {},
    };
    vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
        if (String(input).startsWith("http://auth.test")) return Response.json({ keys: [jwk] });
        const call = JSON.parse(String(init?.body)) as Call;
        calls.push(call);
        const name = /(?:query|mutation)\s+(\w+)/.exec(call.query)?.[1] ?? "";
        if (!(name in answers)) return Response.json({ errors: [{ message: `unscripted ${name}` }] });
        return Response.json({ data: answers[name] });
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    useCertificateChannelForTests(undefined);
    delete process.env.DELIVERY_KEY;
});

const call = (method: string, path: string, body?: unknown, signedIn = true) =>
    handleApi(
        new Request(`http://api.test/v1${path}`, {
            method,
            headers: { "content-type": "application/json", ...(signedIn ? { authorization: `Bearer ${token}` } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
        }),
    );

describe("anonymous submission", () => {
    const schema = [{ key: "name", label: "Navn", type: "text" }];
    const preflight = (form_schema: unknown, count = 0) => ({
        templates: [{ form_schema }],
        submissions_aggregate: { aggregate: { count } },
    });
    const submit = (data: unknown, templateId: unknown = TMPL) =>
        call("POST", "/org/echo/submissions", { templateId, data }, false);

    beforeEach(() => {
        answers.SubmissionPreflight = preflight(schema);
        answers.InsertSubmission = { insert_submissions_one: { id: SUB, created_at: "2026-11-13T10:00:00Z" } };
    });

    it("accepts the fields the form declares", async () => {
        expect((await submit({ name: "Ola" })).status).toBe(200);
    });

    it("hands back a status token once and stores only its hash", async () => {
        const body = (await (await submit({ name: "Ola" })).json()) as { statusToken: string };
        expect(body.statusToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
        const insert = mutations().find((c) => c.query.includes("InsertSubmission"))!;
        expect(insert.variables.statusTokenHash).toMatch(/^[0-9a-f]{64}$/);
        expect(JSON.stringify(insert.variables)).not.toContain(body.statusToken);
    });

    it("refuses a field the form never asked for, which the reviewer would not see", async () => {
        const res = await submit({ name: "Ola", brand: "not attester.no" });
        expect(res.status).toBe(400);
        expect(mutations()).toHaveLength(0);
    });

    it("bounds the number and size of keys when the template has no form schema", async () => {
        answers.SubmissionPreflight = preflight(null);
        expect((await submit({ a: "1", b: "2" })).status).toBe(200);
        const many = Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`k${i}`, "x"]));
        expect((await submit(many)).status).toBe(400);
        expect((await submit({ ["k".repeat(101)]: "x" })).status).toBe(400);
    });

    it("refuses when the organisation's queue is full", async () => {
        answers.SubmissionPreflight = preflight(schema, 2000);
        expect((await submit({ name: "Ola" })).status).toBe(429);
        expect(mutations()).toHaveLength(0);
    });

    it("never sends a malformed template id to the database, where it would be quoted into the log", async () => {
        const res = await submit({ name: "Ola" }, "not-a-uuid\ninjected log line");
        expect(res.status).toBe(400);
        expect(calls.some((c) => JSON.stringify(c.variables ?? {}).includes("injected"))).toBe(false);
    });

    it("answers 400, not 500, to a body that is not an object", async () => {
        const res = await handleApi(
            new Request("http://api.test/v1/org/echo/submissions", { method: "POST", body: "null" }),
        );
        expect(res.status).toBe(400);
    });
});

describe("Digipost switch", () => {
    it("cannot be turned on by an organisation's own admin", async () => {
        const res = await call("PATCH", "/org/echo/settings", { digipostEnabled: true });
        expect(res.status).toBe(403);
        expect(mutations()).toHaveLength(0);
    });

    it("can be turned on by the platform owner", async () => {
        answers.GetUsersByIds = { users: [{ id: USER, email: "owner@attester.no", displayName: null, emailVerified: true }] };
        answers.SetOrgSettings = {};
        const res = await call("PATCH", "/org/echo/settings", { digipostEnabled: true });
        expect(res.status).toBe(200);
        expect(mutations()[0].variables).toEqual({ organizationId: ORG, enabled: true });
    });

    it("erases the collected numbers when it is turned off", async () => {
        answers.GetUsersByIds = { users: [{ id: USER, email: "owner@attester.no", displayName: null, emailVerified: true }] };
        answers.SetOrgSettings = {};
        answers.SubmissionIdsOfOrg = { submissions: [{ id: SUB }] };
        answers.DeleteRecipientsOfOrg = {};
        await call("PATCH", "/org/echo/settings", { digipostEnabled: false });
        expect(calls.find((c) => c.query.includes("DeleteRecipientsOfOrg"))?.variables).toEqual({ ids: [SUB] });
    });
});

describe("platform admin", () => {
    it("is refused to an allowlisted address that was never verified", async () => {
        answers.GetUsersByIds = { users: [{ id: USER, email: "owner@attester.no", displayName: null, emailVerified: false }] };
        expect((await call("GET", "/admin/orgs")).status).toBe(403);
    });
});

describe("templates", () => {
    const qr = { name: "qr", type: "qrcode", position: { x: 0, y: 0 }, width: 30, height: 30 };
    const mark = { name: "brand", type: "text", content: "attester.no", position: { x: 0, y: 40 }, width: 30, height: 5 };
    const template = (fields: unknown[]) => ({ name: " Attest ", basePdf: "data:application/pdf;base64,AAAA", schemas: [fields] });

    it("refuses a template without a QR code or without the platform mark, even when the browser check is skipped", async () => {
        expect((await call("POST", "/org/echo/templates", template([mark]))).status).toBe(400);
        expect((await call("POST", "/org/echo/templates", template([qr]))).status).toBe(400);
        expect(mutations()).toHaveLength(0);
    });

    it("stores a valid template under its trimmed name", async () => {
        answers.InsertTemplate = { insert_templates_one: { id: TMPL, created_at: "", updated_at: "" } };
        expect((await call("POST", "/org/echo/templates", template([qr, mark]))).status).toBe(200);
        expect(mutations()[0].variables.name).toBe("Attest");
    });
});

describe("deleting a submission", () => {
    it("also cancels a letter still waiting to be sent", async () => {
        answers.DeleteSubmission = { delete_submissions: { affected_rows: 1 } };
        expect((await call("DELETE", `/org/echo/submissions/${SUB}`)).status).toBe(200);
        expect(mutations()[0].query).toContain("update_deliveries");
        expect(mutations()[0].query).toContain("payload: null");
    });

    it("answers 404 to an id that is not a uuid without asking the database", async () => {
        expect((await call("DELETE", "/org/echo/submissions/x")).status).toBe(404);
        expect(calls.some((c) => c.query.includes("DeleteSubmission"))).toBe(false);
    });
});

describe("removing a member", () => {
    it("removes the invites they left open", async () => {
        const other = "55555555-5555-5555-5555-555555555555";
        answers.GetMembers = { user_organizations: [{ user_id: USER, role: "admin", created_at: "" }, { user_id: other, role: "admin", created_at: "" }] };
        answers.RemoveMember = {};
        const res = await call("DELETE", "/org/echo/members", { userId: other });
        expect(res.status).toBe(200);
        expect(mutations()[0].query).toContain("delete_invites");
    });

    it("cannot add an account directly, only invite it", async () => {
        const res = await call("POST", "/org/echo/members", { email: "noen@example.com" });
        expect(res.status).toBe(405);
    });
});

describe("retention sweep", () => {
    it("erases delivery payloads that are past their time limit", async () => {
        const { sweepExpiredSubmissions } = await import("./lib/retention");
        await sweepExpiredSubmissions();
        const sweep = calls.find((c) => c.query.includes("SweepExpired"))!;
        expect(sweep.query).toContain("issued_at: { _is_null: false }");
        expect(sweep.query).toContain('_set: { status: "failed", payload: null }');
    });
});

describe("Digipost recipient check", () => {
    it("is refused when the organisation has not been granted Digipost", async () => {
        process.env.DELIVERY_KEY = randomBytes(32).toString("base64");
        let asked = 0;
        useCertificateChannelForTests({ name: "digipost", canReceive: async () => (asked++, true), deliver: async () => undefined });
        answers.OrgDigipost = { org_settings: [] };
        const res = await call("POST", `/org/echo/submissions/${SUB}/recipient-check`);
        expect(await res.json()).toEqual({ canReceive: false });
        expect(asked).toBe(0);
    });
});

describe("lists stay bounded", () => {
    it("pages the queue and looks up deliveries only for the rows on the page", async () => {
        answers.GetSubmissions = {
            submissions: [{ id: SUB, organization_id: ORG, template_id: TMPL, data: {}, created_at: "", issued_at: null }],
            submissions_aggregate: { aggregate: { count: 1201 } },
        };
        answers.GetRecipientFlags = {
            submission_recipients: [{ submission_id: SUB }],
            deliveries: [{ submission_id: SUB, status: "sent", sent_at: "2026-11-13T10:00:00Z" }],
        };
        const res = await call("GET", "/org/echo/submissions?limit=5000&offset=10");
        const body = (await res.json()) as { total: number; submissions: Array<Record<string, unknown>> };
        expect(body.total).toBe(1201);
        expect(body.submissions[0]).toMatchObject({ has_recipient: true, delivery: { status: "sent" } });

        const list = calls.find((c) => c.query.includes("GetSubmissions"))!;
        expect(list.variables).toMatchObject({ limit: 500, offset: 10 });
        const flags = calls.find((c) => c.query.includes("GetRecipientFlags"))!;
        expect(flags.variables).toMatchObject({ ids: [SUB], textIds: [SUB], organizationId: ORG });
    });

    it("falls back to a sane page when the numbers are nonsense", async () => {
        answers.GetSubmissions = { submissions: [], submissions_aggregate: { aggregate: { count: 0 } } };
        answers.GetRecipientFlags = { submission_recipients: [], deliveries: [] };
        await call("GET", "/org/echo/submissions?limit=abc&offset=-5");
        expect(calls.find((c) => c.query.includes("GetSubmissions"))!.variables).toMatchObject({ limit: 200, offset: 0 });
    });

    it("leaves the PDF and the layout out of the templates list", async () => {
        answers.GetTemplates = { templates: [] };
        await call("GET", "/org/echo/templates");
        const query = calls.find((c) => c.query.includes("GetTemplates"))!.query;
        expect(query).not.toContain("base_pdf");
        expect(query).not.toContain("schemas");
    });

    it("serves one full template to a member, scoped to their organisation", async () => {
        answers.GetFullTemplate = { templates: [{ id: TMPL, base_pdf: "data:application/pdf;base64,AAAA" }] };
        const res = await call("GET", `/org/echo/templates/${TMPL}/full`);
        expect(res.status).toBe(200);
        expect(calls.find((c) => c.query.includes("GetFullTemplate"))!.variables).toEqual({ id: TMPL, organizationId: ORG });
        expect((await call("GET", `/org/echo/templates/${TMPL}/full`, undefined, false)).status).toBe(401);
        answers.GetFullTemplate = { templates: [] };
        expect((await call("GET", `/org/echo/templates/${TMPL}/full`)).status).toBe(404);
    });
});

describe("my organisations", () => {
    beforeEach(() => {
        answers.GetUserOrgs = { user_organizations: [{ organization_id: ORG, role: "admin" }] };
        answers.GetOrgsByIds = { organizations: [{ id: ORG, slug: "echo", name: "Echo" }] };
    });

    it("says how many submissions wait in each, counting only unissued ones", async () => {
        answers.PendingSubmissions = { submissions_aggregate: { aggregate: { count: 3 } } };
        const res = await call("GET", "/me/organizations");
        expect(await res.json()).toEqual({ organizations: [{ id: ORG, slug: "echo", name: "Echo", role: "admin", pending: 3 }] });
        const count = calls.find((c) => c.query.includes("PendingSubmissions"))!;
        expect(count.variables).toEqual({ organizationId: ORG });
        expect(count.query).toContain("issued_at: { _is_null: true }");
    });

    it("still lists the organisations when the count fails", async () => {
        const res = await call("GET", "/me/organizations");
        expect(res.status).toBe(200);
        expect(((await res.json()) as { organizations: Array<{ pending: number }> }).organizations[0].pending).toBe(0);
    });
});

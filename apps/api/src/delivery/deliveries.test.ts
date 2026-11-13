import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import type { CertificateLetter } from "../ports";
import { useCertificateChannelForTests } from "../channels";
import { seal, unseal } from "../lib/seal";
import { attemptDelivery, processDeliveries, queueDelivery } from "./deliveries";
import { storeRecipient } from "./recipients";

type Row = {
    id: string;
    submission_id: string;
    status: "queued" | "sent" | "failed";
    payload: string | null;
    attempts: number;
    sent_at: string | null;
    expires_at: string;
};
type Call = { query: string; variables: Record<string, unknown> };

const NATIONAL_ID = "01018099912";
const PDF = new Uint8Array([37, 80, 68, 70, 45, 1, 2, 3]);
const NOW = new Date("2026-11-13T10:00:00Z");

let rows: Row[];
let recipients: Map<string, string>;
let calls: Call[];
let letters: CertificateLetter[];
let failDeliver: boolean;

const input = { organizationId: "org-1", submissionId: "sub-1", nationalId: NATIONAL_ID, subject: "Attest fra Echo", filename: "a.pdf", pdf: PDF };

beforeEach(() => {
    process.env.HASURA_GRAPHQL_URL = "http://hasura.test/v1/graphql";
    process.env.NHOST_ADMIN_SECRET = "test-secret";
    process.env.DELIVERY_KEY = randomBytes(32).toString("base64");
    rows = [];
    recipients = new Map();
    calls = [];
    letters = [];
    failDeliver = false;
    useCertificateChannelForTests({
        name: "digipost",
        async canReceive() {
            return true;
        },
        async deliver(letter) {
            if (failDeliver) throw new Error(`rejected ${letter.nationalId}`);
            letters.push(letter);
        },
    });
    vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
        const call = JSON.parse(String(init?.body)) as Call;
        calls.push(call);
        const q = call.query;
        const v = call.variables ?? {};
        const byId = () => rows.find((r) => r.id === v.id)!;
        let data: unknown = {};
        if (q.includes("ExistingDelivery")) data = { deliveries: rows.filter((r) => r.submission_id === v.submissionId) };
        else if (q.includes("mutation QueueDelivery")) {
            const row: Row = { id: `d${rows.length}`, submission_id: String(v.submissionId), status: "queued", payload: String(v.payload), attempts: 0, sent_at: null, expires_at: String(v.expiresAt) };
            rows.push(row);
            data = { insert_deliveries_one: row };
        } else if (q.includes("RequeueDelivery")) {
            Object.assign(byId(), { status: "queued", payload: v.payload, attempts: 0, expires_at: v.expiresAt });
            data = { update_deliveries_by_pk: byId() };
        } else if (q.includes("FinishDelivery")) {
            Object.assign(byId(), { status: v.status, payload: null, sent_at: v.sentAt });
        } else if (q.includes("DeliveryAttempt")) byId().attempts++;
        else if (q.includes("QueuedDeliveries")) data = { deliveries: rows.filter((r) => r.status === "queued") };
        else if (q.includes("StoreRecipient")) recipients.set(String(v.submissionId), String(v.sealed));
        else if (q.includes("DeleteRecipient")) recipients.delete(String(v.submissionId));
        else throw new Error(`unexpected query ${q.slice(0, 40)}`);
        return Response.json({ data });
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    useCertificateChannelForTests(undefined);
    delete process.env.DELIVERY_KEY;
});

describe("sealing", () => {
    it("round-trips and never stores the plaintext", () => {
        const sealed = seal(NATIONAL_ID);
        expect(sealed).not.toContain(NATIONAL_ID);
        expect(unseal(sealed)).toBe(NATIONAL_ID);
        expect(seal(NATIONAL_ID)).not.toBe(sealed);
    });

    it("refuses a tampered value", () => {
        const parts = seal(NATIONAL_ID).split(".");
        parts[3] = Buffer.from("x" + Buffer.from(parts[3], "base64").toString("binary"), "binary").toString("base64");
        expect(() => unseal(parts.join("."))).toThrow();
    });
});

describe("deliveries", () => {
    it("sends the letter, then erases the PDF and the recipient", async () => {
        await storeRecipient("sub-1", NATIONAL_ID);
        const row = await queueDelivery(input, NOW);
        expect(await attemptDelivery(row, NOW)).toBe("sent");

        expect(letters).toHaveLength(1);
        expect(letters[0].nationalId).toBe(NATIONAL_ID);
        expect(Array.from(letters[0].pdf)).toEqual(Array.from(PDF));
        expect(letters[0].id).toBe(row.id);

        expect(rows[0]).toMatchObject({ status: "sent", payload: null, sent_at: NOW.toISOString() });
        expect(recipients.size).toBe(0);
    });

    it("never writes the fødselsnummer or the PDF to the database unsealed", async () => {
        await storeRecipient("sub-1", NATIONAL_ID);
        await attemptDelivery(await queueDelivery(input, NOW), NOW);
        const written = JSON.stringify(calls);
        expect(written).not.toContain(NATIONAL_ID);
        expect(written).not.toContain(Buffer.from(PDF).toString("base64"));
    });

    it("keeps a failed attempt queued and retries it on the next tick", async () => {
        failDeliver = true;
        const row = await queueDelivery(input, NOW);
        expect(await attemptDelivery(row, NOW)).toBe("queued");
        expect(rows[0]).toMatchObject({ status: "queued", attempts: 1 });
        expect(rows[0].payload).not.toBeNull();

        failDeliver = false;
        expect(await processDeliveries(NOW)).toBe(1);
        expect(rows[0]).toMatchObject({ status: "sent", payload: null });
    });

    it("does not log the provider's message, which may quote the recipient", async () => {
        const logged: string[] = [];
        const spy = vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args.join(" ")));
        failDeliver = true;
        await attemptDelivery(await queueDelivery(input, NOW), NOW);
        spy.mockRestore();
        expect(logged.join("\n")).not.toContain(NATIONAL_ID);
    });

    it("erases the payload when the letter has waited too long", async () => {
        failDeliver = true;
        await queueDelivery(input, NOW);
        const later = new Date(NOW.getTime() + 25 * 3600_000);
        await processDeliveries(later);
        expect(rows[0]).toMatchObject({ status: "failed", payload: null });
        expect(letters).toHaveLength(0);
    });

    it("gives up after five attempts and erases the payload", async () => {
        failDeliver = true;
        await queueDelivery(input, NOW);
        for (let i = 0; i < 6; i++) await processDeliveries(NOW);
        expect(rows[0]).toMatchObject({ status: "failed", payload: null, attempts: 5 });
    });

    it("does not send the same certificate twice", async () => {
        await attemptDelivery(await queueDelivery(input, NOW), NOW);
        const again = await queueDelivery(input, NOW);
        expect(again.status).toBe("sent");
        expect(await attemptDelivery(again, NOW)).toBe("sent");
        expect(letters).toHaveLength(1);
        expect(rows).toHaveLength(1);
    });

    it("lets a failed delivery be queued again", async () => {
        failDeliver = true;
        await queueDelivery(input, NOW);
        await processDeliveries(new Date(NOW.getTime() + 25 * 3600_000));
        failDeliver = false;
        const again = await queueDelivery(input, NOW);
        expect(again.status).toBe("queued");
        expect(await attemptDelivery(again, NOW)).toBe("sent");
        expect(rows).toHaveLength(1);
    });
});

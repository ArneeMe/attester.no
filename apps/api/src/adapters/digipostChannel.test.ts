import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createVerify, generateKeyPairSync } from "node:crypto";
import { canonicalRequest, digipostChannel, DigipostError, messageXml } from "./digipostChannel";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const NS = "http://api.digipost.no/schema/v8";
const ENTRY = `<?xml version="1.0" encoding="UTF-8"?><entrypoint xmlns="${NS}">`
    + `<link rel="https://api.test.digipost.no/relations/create_message" uri="https://api.test.digipost.no/messages" media-type="application/vnd.digipost-v8+xml"/>`
    + `<link rel="https://api.test.digipost.no/relations/identify_recipient" uri="https://api.test.digipost.no/identification"/>`
    + `</entrypoint>`;
const identified = (code: string) => `<identification-result xmlns="${NS}"><result>${code}</result></identification-result>`;
const delivered = (method: string) =>
    `<message-delivery xmlns="${NS}"><delivery-method>${method}</delivery-method><sender-id>1234</sender-id><status>DELIVERED</status></message-delivery>`;

type Seen = { method: string; url: URL; headers: Headers; body: Buffer | null };
let seen: Seen[];
let respond: (req: Seen) => Response;

beforeEach(() => {
    seen = [];
    respond = () => new Response("", { status: 500 });
    vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
        const req: Seen = {
            method: init.method ?? "GET",
            url: new URL(input),
            headers: new Headers(init.headers),
            body: init.body ? Buffer.from(init.body as Uint8Array) : null,
        };
        seen.push(req);
        if (req.url.pathname === "/") return new Response(ENTRY);
        return respond(req);
    });
});

afterEach(() => vi.unstubAllGlobals());

const channel = () => digipostChannel({ apiUrl: "https://api.test.digipost.no/", brokerId: "1234", privateKeyPem });
const letter = {
    id: "0b9c5c1e-6a1f-4a43-9f0e-3f1f6c7a2b11",
    nationalId: "01018099912",
    subject: "Attest fra Bjørn & <Æsel>",
    filename: "a.pdf",
    pdf: new Uint8Array([37, 80, 68, 70, 45, 0, 255, 13, 10]),
};

function expectValidSignature(req: Seen) {
    const sha = req.headers.get("x-content-sha256") ?? undefined;
    const expected = canonicalRequest(req.method, req.url.pathname, req.url.search.slice(1), {
        date: req.headers.get("date")!,
        contentSha256: sha,
        userId: req.headers.get("x-digipost-userid")!,
    });
    const ok = createVerify("RSA-SHA256").update(expected).verify(publicKey, req.headers.get("x-digipost-signature")!, "base64");
    expect(ok).toBe(true);
    if (req.body) expect(sha).toBe(createHash("sha256").update(req.body).digest("base64"));
}

describe("canonicalRequest", () => {
    it("matches the layout of Digipost's own client", () => {
        expect(
            canonicalRequest("post", "/Messages", "A=B", { date: "Fri, 13 Nov 2026 10:00:00 GMT", contentSha256: "abc=", userId: "1234" }),
        ).toBe("POST\n/messages\ndate: Fri, 13 Nov 2026 10:00:00 GMT\nx-content-sha256: abc=\nx-digipost-userid: 1234\na=b\n");
    });

    it("leaves the content hash out of a request without a body", () => {
        expect(canonicalRequest("GET", "/", "", { date: "D", userId: "1" })).toBe("GET\n/\ndate: D\nx-digipost-userid: 1\n\n");
    });
});

describe("digipost channel", () => {
    it("signs every request so Digipost can verify it with the public key", async () => {
        respond = () => new Response(identified("DIGIPOST"));
        await channel().canReceive("01018099912");
        expect(seen).toHaveLength(2);
        seen.forEach(expectValidSignature);
        expect(seen[0].headers.get("date")).toMatch(/^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/);
    });

    it("asks the entry point where to go, once", async () => {
        respond = () => new Response(identified("DIGIPOST"));
        const c = channel();
        await c.canReceive("01018099912");
        await c.canReceive("01018099912");
        expect(seen.filter((r) => r.url.pathname === "/")).toHaveLength(1);
        expect(seen[1].url.pathname).toBe("/identification");
    });

    it("says yes only for a person who has Digipost", async () => {
        for (const [code, expected] of [["DIGIPOST", true], ["IDENTIFIED", false], ["UNIDENTIFIED", false], ["INVALID", false]] as const) {
            respond = () => new Response(identified(code));
            expect(await channel().canReceive("01018099912")).toBe(expected);
        }
    });

    it("sends the message XML and the untouched PDF in one multipart request", async () => {
        respond = () => new Response(delivered("DIGIPOST"));
        await channel().deliver(letter);
        const req = seen[1];
        expect(req.url.pathname).toBe("/messages");
        expectValidSignature(req);

        const boundary = /^multipart\/vnd\.digipost-v8\+xml; boundary=(.+)$/.exec(req.headers.get("content-type")!)![1];
        const parts = req.body!.toString("latin1").split(`--${boundary}`);
        expect(parts).toHaveLength(4);
        expect(parts[3]).toBe("--\r\n");
        expect(parts[1]).toContain('Content-Disposition: attachment; filename="message"');
        expect(parts[1]).toContain("Content-Type: application/vnd.digipost-v8+xml");
        expect(parts[2]).toContain(`filename="${letter.id}"`);
        expect(parts[2]).toContain("Content-Type: application/pdf");
        const pdf = Buffer.from(parts[2].slice(parts[2].indexOf("\r\n\r\n") + 4, -2), "latin1");
        expect(Array.from(pdf)).toEqual(Array.from(letter.pdf));
    });

    it("addresses the letter by fødselsnummer and asks for no print fallback", () => {
        const message = messageXml("1234", letter);
        expect(message).toContain("<personal-identification-number>01018099912</personal-identification-number>");
        expect(message).toContain("<sender-id>1234</sender-id>");
        expect(message).toContain(`<message-id>${letter.id}</message-id>`);
        expect(message).toContain("<subject>Attest fra Bjørn &amp; &lt;Æsel&gt;</subject>");
        expect(message).not.toContain("print");
        const order = ["<message-id>", "<sender-id>", "<recipient>", "<primary-document>", "<uuid>", "<subject>", "<file-type>", "<authentication-level>", "<sensitivity-level>"];
        const positions = order.map((tag) => message.indexOf(tag));
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it("fails when Digipost did not deliver digitally", async () => {
        respond = () => new Response(delivered("PRINT"));
        await expect(channel().deliver(letter)).rejects.toMatchObject({ code: "NOT_DELIVERED_DIGITALLY" });
    });

    it("treats a letter Digipost already has as delivered", async () => {
        respond = () =>
            new Response(`<error xmlns="${NS}"><error-code>DUPLICATE_MESSAGE</error-code><error-message>x</error-message><error-type>CLIENT_DATA</error-type></error>`, { status: 409 });
        await expect(channel().deliver(letter)).resolves.toBeUndefined();
    });

    it("reports the error code and never Digipost's message text", async () => {
        respond = () =>
            new Response(`<error xmlns="${NS}"><error-code>UNKNOWN_RECIPIENT</error-code><error-message>No user 01018099912</error-message><error-type>CLIENT_DATA</error-type></error>`, { status: 404 });
        const error = await channel().deliver(letter).catch((e) => e);
        expect(error).toBeInstanceOf(DigipostError);
        expect(error.code).toBe("UNKNOWN_RECIPIENT");
        expect(String(error.message)).not.toContain("01018099912");
    });
});

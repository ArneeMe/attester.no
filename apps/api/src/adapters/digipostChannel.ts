import { createHash, createPrivateKey, createSign, randomBytes, type KeyObject } from "node:crypto";
import type { CertificateChannel, CertificateLetter } from "../ports";

// Digipost's sender API, written from the official Java client
// (github.com/digipost/digipost-api-client-java) and its api_v8.xsd, and
// checked line by line against the owner's own Android client
// (arneeme/apps, android/digipost/Digipost.kt), which signs and sends the
// same way.
//
// Every request is signed with the sender's private key over a canonical
// string: method, path, the date, content-hash and user-id headers, and the
// query. A letter is one multipart request: the message XML, then the PDF.
// No print details are sent, so a person without Digipost is refused
// instead of getting paper mail.

const MEDIA_TYPE = "application/vnd.digipost-v8+xml";
const NAMESPACE = "http://api.digipost.no/schema/v8";
const TIMEOUT_MS = 20_000;

export type DigipostConfig = {
    apiUrl: string;
    brokerId: string;
    privateKeyPem: string;
    // Only when sending on behalf of another sender. Left out, Digipost uses
    // the sender the request is signed as.
    senderId?: string;
};

export class DigipostError extends Error {
    constructor(readonly code: string, readonly status: number) {
        // The code only. Digipost's message text can quote the request.
        super(`Digipost answered ${status} ${code}`);
        this.name = "DigipostError";
    }
}

const xml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const element = (body: string, name: string): string | null =>
    new RegExp(`<(?:\\w+:)?${name}[^>]*>([^<]*)</(?:\\w+:)?${name}>`).exec(body)?.[1] ?? null;

export function canonicalRequest(
    method: string,
    path: string,
    query: string,
    headers: { date: string; contentSha256?: string; userId: string },
): string {
    return (
        `${method.toUpperCase()}\n`
        + `${path.toLowerCase()}\n`
        + `date: ${headers.date}\n`
        + (headers.contentSha256 ? `x-content-sha256: ${headers.contentSha256}\n` : "")
        + `x-digipost-userid: ${headers.userId}\n`
        + `${query.toLowerCase()}\n`
    );
}

export function identificationXml(nationalId: string): string {
    return (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<identification xmlns="${NAMESPACE}">`
        + `<personal-identification-number>${xml(nationalId)}</personal-identification-number>`
        + `</identification>`
    );
}

export function messageXml(senderId: string | undefined, letter: CertificateLetter): string {
    return (
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
        + `<message xmlns="${NAMESPACE}">`
        + `<message-id>${xml(letter.id)}</message-id>`
        + (senderId ? `<sender-id>${xml(senderId)}</sender-id>` : "")
        + `<recipient><personal-identification-number>${xml(letter.nationalId)}</personal-identification-number></recipient>`
        + `<primary-document>`
        + `<uuid>${xml(letter.id)}</uuid>`
        + `<subject>${xml(letter.subject.slice(0, 255))}</subject>`
        + `<file-type>pdf</file-type>`
        + `<authentication-level>PASSWORD</authentication-level>`
        + `<sensitivity-level>NORMAL</sensitivity-level>`
        + `</primary-document>`
        + `</message>`
    );
}

export function multipartBody(boundary: string, message: string, documentId: string, pdf: Uint8Array): Buffer {
    const part = (headers: string[], content: Buffer) =>
        Buffer.concat([Buffer.from(`--${boundary}\r\n${headers.join("\r\n")}\r\n\r\n`), content, Buffer.from("\r\n")]);
    return Buffer.concat([
        part(
            [
                `Content-Disposition: attachment; filename="message"`,
                `Content-Type: ${MEDIA_TYPE}; charset=UTF-8`,
                `Content-Transfer-Encoding: binary`,
            ],
            Buffer.from(message, "utf8"),
        ),
        part(
            [
                `Content-Disposition: attachment; filename="${documentId}"`,
                `Content-Type: application/pdf`,
                `Content-Transfer-Encoding: binary`,
            ],
            Buffer.from(pdf),
        ),
        Buffer.from(`--${boundary}--\r\n`),
    ]);
}

export function digipostChannel(config: DigipostConfig): CertificateChannel {
    const base = config.apiUrl.replace(/\/+$/, "");
    let key: KeyObject | null = null;
    let links: Promise<Record<string, string>> | null = null;

    const send = async (method: string, pathAndQuery: string, body?: Buffer, contentType?: string): Promise<string> => {
        key ??= createPrivateKey(config.privateKeyPem);
        const [path, query = ""] = pathAndQuery.split("?");
        const date = new Date().toUTCString();
        const contentSha256 = body ? createHash("sha256").update(body).digest("base64") : undefined;
        const signature = createSign("RSA-SHA256")
            .update(canonicalRequest(method, path, query, { date, contentSha256, userId: config.brokerId }))
            .sign(key, "base64");

        const headers: Record<string, string> = {
            Accept: MEDIA_TYPE,
            Date: date,
            "X-Digipost-UserId": config.brokerId,
            "X-Digipost-Signature": signature,
            "User-Agent": "attester.no",
        };
        if (body && contentSha256 && contentType) {
            headers["X-Content-SHA256"] = contentSha256;
            headers["Content-Type"] = contentType;
            headers["MIME-Version"] = "1.0";
        }
        const res = await fetch(base + pathAndQuery, {
            method,
            headers,
            body: body ? new Uint8Array(body) : undefined,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const text = await res.text();
        if (!res.ok) throw new DigipostError(element(text, "error-code") ?? "UNKNOWN", res.status);
        return text;
    };

    // The API is hypermedia: the entry point lists where each action lives.
    const link = async (relation: string): Promise<string> => {
        links ??= send("GET", "/").then((entry) => {
            const found: Record<string, string> = {};
            for (const m of entry.matchAll(/<(?:\w+:)?link\b([^>]*)>/g)) {
                const rel = /\brel="([^"]*)"/.exec(m[1])?.[1];
                const uri = /\buri="([^"]*)"/.exec(m[1])?.[1];
                if (rel && uri) found[rel.slice(rel.lastIndexOf("/") + 1).toLowerCase()] = new URL(uri, base).pathname;
            }
            return found;
        });
        let found: Record<string, string>;
        try {
            found = await links;
        } catch (e) {
            links = null;
            throw e;
        }
        const path = found[relation];
        if (!path) throw new DigipostError(`NO_LINK_${relation.toUpperCase()}`, 0);
        return path;
    };

    return {
        name: "digipost",

        async canReceive(nationalId: string): Promise<boolean> {
            const body = Buffer.from(identificationXml(nationalId), "utf8");
            const result = await send("POST", await link("identify_recipient"), body, MEDIA_TYPE);
            return element(result, "result") === "DIGIPOST";
        },

        async deliver(letter: CertificateLetter): Promise<void> {
            const boundary = `attester-${randomBytes(16).toString("hex")}`;
            const body = multipartBody(boundary, messageXml(config.senderId, letter), letter.id, letter.pdf);
            let result: string;
            try {
                result = await send(
                    "POST",
                    await link("create_message"),
                    body,
                    `multipart/vnd.digipost-v8+xml; boundary=${boundary}`,
                );
            } catch (e) {
                // A repeat of a letter Digipost already took is a success.
                if (e instanceof DigipostError && e.code === "DUPLICATE_MESSAGE") return;
                throw e;
            }
            if (element(result, "delivery-method") !== "DIGIPOST") {
                throw new DigipostError("NOT_DELIVERED_DIGITALLY", 200);
            }
        },
    };
}

export function digipostConfigFromEnv(): DigipostConfig | null {
    const brokerId = process.env.DIGIPOST_BROKER_ID;
    const rawKey = process.env.DIGIPOST_PRIVATE_KEY;
    if (!brokerId || !rawKey) return null;
    // A PEM, or the same PEM base64 encoded for secret stores that dislike newlines.
    const privateKeyPem = rawKey.includes("-----BEGIN") ? rawKey : Buffer.from(rawKey, "base64").toString("utf8");
    return {
        // The test environment unless production is asked for by name.
        apiUrl: process.env.DIGIPOST_API_URL ?? "https://api.test.digipost.no",
        brokerId,
        privateKeyPem,
        senderId: process.env.DIGIPOST_SENDER_ID || undefined,
    };
}

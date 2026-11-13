import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM with a key that lives only in the function's environment.
// What is sealed is unreadable from a database copy alone.

function key(): Buffer | null {
    const raw = process.env.DELIVERY_KEY;
    if (!raw) return null;
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("DELIVERY_KEY must be 32 bytes, base64 encoded");
    return buf;
}

export function sealingAvailable(): boolean {
    return key() !== null;
}

export function seal(plaintext: string): string {
    const k = key();
    if (!k) throw new Error("DELIVERY_KEY not configured");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", k, iv);
    const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
}

export function unseal(sealed: string): string {
    const k = key();
    if (!k) throw new Error("DELIVERY_KEY not configured");
    const [version, iv, tag, body] = sealed.split(".");
    if (version !== "v1" || !iv || !tag || !body) throw new Error("Unknown sealed format");
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}

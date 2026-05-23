import { jwtVerify } from "jose";

export type JwtClaims = {
    userId: string;
};

const HASURA_CLAIMS_KEY = "https://hasura.io/jwt/claims";

let _secretKey: Uint8Array | null = null;
function getSecretKey(): Uint8Array {
    if (_secretKey) return _secretKey;
    const raw = process.env.NHOST_JWT_SECRET;
    if (!raw) throw new Error("NHOST_JWT_SECRET is not configured");
    // Nhost dashboard shows the secret as {"type":"HS256","key":"..."} — unwrap if so.
    let keyString = raw;
    try {
        const parsed = JSON.parse(raw) as { key?: string };
        if (parsed.key) keyString = parsed.key;
    } catch {
        // plain string — use as-is
    }
    _secretKey = new TextEncoder().encode(keyString);
    return _secretKey;
}

export async function verifyJwt(authHeader: string | null): Promise<JwtClaims | null> {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    // Outside the try so a missing/misconfigured secret surfaces as 500, not a silent 401.
    const secret = getSecretKey();

    try {
        const { payload } = await jwtVerify(token, secret);
        const hasuraClaims = payload[HASURA_CLAIMS_KEY] as Record<string, unknown> | undefined;
        const userId =
            (hasuraClaims?.["x-hasura-user-id"] as string | undefined) ??
            (typeof payload.sub === "string" ? payload.sub : undefined);
        if (!userId) return null;
        return { userId };
    } catch {
        return null;
    }
}

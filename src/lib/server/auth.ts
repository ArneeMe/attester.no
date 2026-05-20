import { jwtVerify } from "jose";

export type JwtClaims = {
    userId: string;
};

const HASURA_CLAIMS_KEY = "https://hasura.io/jwt/claims";

let _secretKey: Uint8Array | null = null;
function getSecretKey(): Uint8Array {
    if (_secretKey) return _secretKey;
    const secret = process.env.NHOST_JWT_SECRET;
    if (!secret) throw new Error("NHOST_JWT_SECRET is not configured");
    _secretKey = new TextEncoder().encode(secret);
    return _secretKey;
}

export async function verifyJwt(authHeader: string | null): Promise<JwtClaims | null> {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);

    try {
        const { payload } = await jwtVerify(token, getSecretKey());
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

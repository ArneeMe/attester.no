import { jwtVerify, createRemoteJWKSet } from "jose";

export type JwtClaims = {
    userId: string;
};

const HASURA_CLAIMS_KEY = "https://hasura.io/jwt/claims";

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
    if (_jwks) return _jwks;
    const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
    const region = process.env.NEXT_PUBLIC_NHOST_REGION;
    if (!subdomain || !region) throw new Error("NEXT_PUBLIC_NHOST_SUBDOMAIN / REGION not configured");
    const jwksUrl = new URL(`https://${subdomain}.auth.${region}.nhost.run/v1/.well-known/jwks.json`);
    _jwks = createRemoteJWKSet(jwksUrl);
    return _jwks;
}

export async function verifyJwt(authHeader: string | null): Promise<JwtClaims | null> {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);

    // Outside the try so misconfigured env vars surface as 500, not a silent 401.
    const jwks = getJwks();

    try {
        const { payload } = await jwtVerify(token, jwks);
        const hasuraClaims = payload[HASURA_CLAIMS_KEY] as Record<string, unknown> | undefined;
        const userId =
            (hasuraClaims?.["x-hasura-user-id"] as string | undefined) ??
            (typeof payload.sub === "string" ? payload.sub : undefined);
        if (!userId) return null;
        return { userId };
    } catch (e) {
        console.warn("JWT verification failed:", (e as Error).message);
        return null;
    }
}

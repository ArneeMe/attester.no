import { jwtVerify, createRemoteJWKSet } from "jose";
import { jwksUrl as resolveJwksUrl } from "../env";
import { log, scrub } from "./log";

export type JwtClaims = {
    userId: string;
};

const HASURA_CLAIMS_KEY = "https://hasura.io/jwt/claims";

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
    if (_jwks) return _jwks;
    const jwksUrl = new URL(resolveJwksUrl());
    _jwks = createRemoteJWKSet(jwksUrl);
    return _jwks;
}

export async function verifyJwt(authHeader: string | null): Promise<JwtClaims | null> {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);

    // Outside the try so misconfigured env vars surface as 500, not a silent 401.
    const jwks = getJwks();

    try {
        const { payload } = await jwtVerify(token, jwks, { algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "EdDSA"] });
        const hasuraClaims = payload[HASURA_CLAIMS_KEY] as Record<string, unknown> | undefined;
        const userId =
            (hasuraClaims?.["x-hasura-user-id"] as string | undefined) ??
            (typeof payload.sub === "string" ? payload.sub : undefined);
        if (!userId) return null;
        return { userId };
    } catch (e) {
        log("warn", "jwt_rejected", { reason: scrub((e as Error).message) });
        return null;
    }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, type JwtClaims } from "@/lib/server/auth";
import { userBelongsToOrg } from "@/lib/server/membership";

/**
 * Returns the verified caller's claims, or a 401 response.
 * Use when an endpoint only needs "is this a logged-in user" without org scoping.
 */
export async function requireSession(req: NextRequest): Promise<JwtClaims | NextResponse> {
    const claims = await verifyJwt(req.headers.get("authorization"));
    if (!claims) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    return claims;
}

/**
 * Returns the verified caller's claims if they belong to the given organization,
 * otherwise a 401/403 response. Use for all admin routes that act on a specific org.
 */
export async function requireOrgMember(
    req: NextRequest,
    organizationId: string,
): Promise<JwtClaims | NextResponse> {
    const session = await requireSession(req);
    if (session instanceof NextResponse) return session;
    if (!(await userBelongsToOrg(session.userId, organizationId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return session;
}

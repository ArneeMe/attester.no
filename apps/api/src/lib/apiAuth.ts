import { json } from "../http";
import { hasuraAdmin } from "./hasura";
import { verifyJwt, type JwtClaims } from "./auth";
import { userBelongsToOrg } from "./membership";

/**
 * Returns the verified caller's claims, or a 401 response.
 */
export async function requireSession(req: Request): Promise<JwtClaims | Response> {
    const claims = await verifyJwt(req.headers.get("authorization"));
    if (!claims) {
        return json({ error: "Invalid session" }, { status: 401 });
    }
    return claims;
}

/**
 * Resolve an org slug to its UUID. Returns null if no such org.
 */
export async function resolveOrgIdBySlug(slug: string): Promise<string | null> {
    const data = await hasuraAdmin<{ organizations: Array<{ id: string }> }>(
        `query GetOrgIdBySlug($slug: String!) {
            organizations(where: { slug: { _eq: $slug } }, limit: 1) { id }
        }`,
        { slug },
    );
    return data.organizations[0]?.id ?? null;
}

/**
 * Resolve slug → org, verify the caller is a member. Used by every org-scoped admin route.
 * Returns { userId, organizationId } on success, or a 401/403/404 response.
 */
export async function requireOrgMemberBySlug(
    req: Request,
    slug: string,
): Promise<{ userId: string; organizationId: string } | Response> {
    const session = await requireSession(req);
    if (session instanceof Response) return session;

    const organizationId = await resolveOrgIdBySlug(slug);
    if (!organizationId) {
        return json({ error: "Organization not found" }, { status: 404 });
    }

    if (!(await userBelongsToOrg(session.userId, organizationId))) {
        return json({ error: "Forbidden" }, { status: 403 });
    }
    return { userId: session.userId, organizationId };
}

/**
 * Verify membership by an already-known org id. Use when the org id is loaded
 * from another row first (e.g. the DELETE volunteer flow).
 */
export async function requireOrgMemberById(
    req: Request,
    organizationId: string,
): Promise<JwtClaims | Response> {
    const session = await requireSession(req);
    if (session instanceof Response) return session;
    if (!(await userBelongsToOrg(session.userId, organizationId))) {
        return json({ error: "Forbidden" }, { status: 403 });
    }
    return session;
}

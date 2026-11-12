import { json } from "../http";
import { requireSession } from "./apiAuth";
import { getUsersByIds } from "./authUsers";

// Platform admins sit above the org level: they may create organizations
// and attach their first member. Membership in the club is an env-var
// allowlist of account emails (comma-separated) — deliberately not a
// database role, so it stays code-only and can't be self-granted through
// any app surface. Unset = the /admin surface is disabled entirely.

function allowlist(): Set<string> {
    return new Set(
        (process.env.PLATFORM_ADMIN_EMAILS ?? "")
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
    );
}

/**
 * Verify the caller's session AND that their account email is on the
 * platform-admin allowlist. Returns { userId, email } or a 401/403.
 * The email is read from the auth.users row, not from client input.
 */
export async function requirePlatformAdmin(
    req: Request,
): Promise<{ userId: string; email: string } | Response> {
    const session = await requireSession(req);
    if (session instanceof Response) return session;

    const admins = allowlist();
    if (admins.size === 0) {
        return json({ error: "Platform admin is not configured" }, { status: 403 });
    }

    const [user] = await getUsersByIds([session.userId]);
    const email = user?.email?.toLowerCase();
    if (!email || !admins.has(email)) {
        return json({ error: "Forbidden" }, { status: 403 });
    }
    return { userId: session.userId, email };
}

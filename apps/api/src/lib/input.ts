const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 320;

// An id that is not a uuid never reaches Hasura. Hasura quotes a malformed
// uuid back in its error, and that error is logged.
export function isUuid(value: unknown): value is string {
    return typeof value === "string" && UUID_RE.test(value);
}

export function isEmail(value: unknown): value is string {
    return typeof value === "string" && value.length <= MAX_EMAIL_LEN && EMAIL_RE.test(value);
}

// A body that is missing, malformed or not an object reads as empty, so the
// field checks that follow answer 400 instead of the route throwing.
export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
    const parsed: unknown = await req.json().catch(() => null);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

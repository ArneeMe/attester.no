import { requestContext } from "./requestContext";

// One JSON object per line on stdout. That is the whole logging interface:
// any collector reads it, and nothing here depends on a host or a vendor.

type Level = "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

/**
 * Makes free text safe to keep. Error messages from Hasura, a JSON parser or
 * a provider can quote the value that caused them, and that value may be a
 * volunteer's. Everything that could be data goes: quoted text, emails, ids
 * and long digit runs. What stays is the shape of the message.
 */
export function scrub(text: string): string {
    return text
        .replace(/"(?:[^"\\]|\\.)*"/g, '"…"')
        .replace(/'(?:[^'\\]|\\.)*'/g, "'…'")
        .replace(/`[^`]*`/g, "`…`")
        .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g, "<email>")
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
        .replace(/\d{5,}/g, "#")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300);
}

export function log(level: Level, event: string, fields: Fields = {}): void {
    const ctx = requestContext();
    const line = JSON.stringify({
        time: new Date().toISOString(),
        level,
        event,
        ...(ctx ? { requestId: ctx.id, method: ctx.method, route: ctx.route } : {}),
        ...fields,
    });
    if (level === "error") console.error(line);
    else console.log(line);
}

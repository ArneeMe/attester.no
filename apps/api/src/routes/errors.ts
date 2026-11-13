import { json } from "../http";
import { readJsonObject } from "../lib/input";
import { reportFromOutside } from "../errors/report";

const text = (value: unknown, max: number): string => (typeof value === "string" ? value.slice(0, max) : "");

/**
 * Where the web app and the browser report their own failures. Anonymous on
 * purpose: an error page cannot require a login. It takes what broke and
 * where in the code, and nothing else. The request's headers are never read,
 * so no IP and no user agent can end up stored.
 *
 * Always answers 202, whether the report was kept or dropped, so the caller
 * learns nothing about the limits.
 */
export async function POST(req: Request) {
    const body = await readJsonObject(req);
    const source = body.source === "web" ? "web" : "browser";
    if (typeof body.kind === "string" && typeof body.place === "string") {
        reportFromOutside({
            source,
            place: text(body.place, 200),
            kind: text(body.kind, 100),
            message: text(body.message, 2000),
            stack: text(body.stack, 8000),
        });
    }
    return json({ received: true }, { status: 202 });
}

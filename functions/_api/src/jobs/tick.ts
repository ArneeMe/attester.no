import { createHash, timingSafeEqual } from "node:crypto";
import { json } from "../http";
import { sweepExpiredSubmissions } from "../lib/retention";
import { dispatchNotices } from "../notices/submissionWaiting";
import { processDeliveries } from "../delivery/deliveries";

const digest = (value: string) => createHash("sha256").update(value).digest();

function authorised(req: Request): boolean {
    const expected = process.env.NHOST_WEBHOOK_SECRET;
    const given = req.headers.get("nhost-webhook-secret");
    return !!expected && !!given && timingSafeEqual(digest(given), digest(expected));
}

/**
 * Scheduled work. Every job here is also run lazily somewhere else, so a
 * missed tick delays things and loses nothing.
 */
export async function handleTick(req: Request): Promise<Response> {
    if (!authorised(req)) return json({ error: "Unauthorized" }, { status: 401 });
    const origin = (process.env.PUBLIC_APP_URL ?? "https://attester.no").replace(/\/+$/, "");
    await sweepExpiredSubmissions();
    const notices = await dispatchNotices(origin);
    const deliveries = await processDeliveries();
    return json({ ok: true, notices, deliveries });
}

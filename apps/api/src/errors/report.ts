import { createHash } from "node:crypto";
import { errorSink } from "../channels";
import { log, scrub } from "../lib/log";
import { notifyPlatformOwner } from "../lib/notifyOwner";
import { requestContext } from "../lib/requestContext";
import type { ErrorReport } from "../ports";

// An error that repeats is written once a minute with a count, not once per
// request. Otherwise a failing database would be asked to store every
// failure of itself.
const FLUSH_MS = 60_000;
const NOTIFY_MS = 10 * 60_000;
const MAX_TRACKED = 1000;

type Pending = { report: ErrorReport; lastFlush: number };
const pending = new Map<string, Pending>();
let lastNotified = 0;

// Function names and positions only. The first line of a stack repeats the
// message, so it is dropped.
function frames(e: unknown): string {
    const stack = e instanceof Error && e.stack ? e.stack : "";
    return stack
        .split("\n")
        .filter((line) => line.trimStart().startsWith("at "))
        .slice(0, 8)
        .map((line) => line.trim())
        .join("\n");
}

async function flush(entry: Pending, now: number): Promise<void> {
    const report = { ...entry.report };
    entry.report.count = 0;
    entry.lastFlush = now;
    const sink = errorSink();
    if (!sink) return;
    const isNew = await sink.record(report);
    if (isNew && now - lastNotified > NOTIFY_MS) {
        lastNotified = now;
        // Says that something broke, never what.
        await notifyPlatformOwner("Ny feil på attester.no", "En ny type feil er registrert.", adminLink());
    }
}

function adminLink(): string | undefined {
    const origin = process.env.PUBLIC_APP_URL;
    return origin ? `${origin.replace(/\/+$/, "")}/admin` : undefined;
}

/**
 * Record that something failed. Safe to call anywhere: it never throws and
 * never waits for storage. `place` is a route pattern or a job name.
 */
export function reportError(e: unknown, source: "api" | "job", place: string): void {
    try {
        const ctx = requestContext();
        const kind = e instanceof Error ? e.name : "NonError";
        const message = scrub(e instanceof Error ? e.message : String(e));
        const stack = frames(e);
        const fingerprint = createHash("sha256")
            .update([source, place, kind, stack.split("\n")[0] ?? ""].join("|"))
            .digest("hex")
            .slice(0, 32);

        log("error", "error", { source, place, kind, message, fingerprint });

        const now = Date.now();
        let entry = pending.get(fingerprint);
        if (!entry) {
            if (pending.size >= MAX_TRACKED) return;
            entry = {
                report: { fingerprint, source, place, kind, message, stack, requestId: ctx?.id ?? null, count: 0 },
                lastFlush: 0,
            };
            pending.set(fingerprint, entry);
        }
        entry.report.count++;
        entry.report.requestId = ctx?.id ?? entry.report.requestId;
        if (now - entry.lastFlush >= FLUSH_MS) void flush(entry, now).catch(() => undefined);
    } catch {
        // Reporting must never be the thing that fails.
    }
}

/** Write out counts held back by the once-a-minute rule. */
export async function flushErrors(): Promise<void> {
    const now = Date.now();
    for (const entry of pending.values()) {
        if (entry.report.count > 0) await flush(entry, now).catch(() => undefined);
    }
}

export function resetErrorsForTests(): void {
    pending.clear();
    lastNotified = 0;
}

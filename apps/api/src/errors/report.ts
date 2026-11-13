import { createHash } from "node:crypto";
import { errorSink } from "../channels";
import { log, scrub, scrubStack } from "../lib/log";
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

// Reports from the browser and the web app arrive unauthenticated. Everything
// in them is somebody else's text, so it is cut, scrubbed and rate limited
// here before it is treated like one of our own.
const OUTSIDE_PER_MINUTE = 30;
let outsideWindow = 0;
let outsideCount = 0;

export type OutsideReport = { source: "web" | "browser"; place: string; kind: string; message: string; stack: string };

export function reportFromOutside(input: OutsideReport): boolean {
    try {
        const now = Date.now();
        if (now - outsideWindow >= 60_000) {
            outsideWindow = now;
            outsideCount = 0;
        }
        if (++outsideCount > OUTSIDE_PER_MINUTE) return false;

        const place = scrub(input.place).slice(0, 120);
        const kind = input.kind.replace(/[^\w.$ -]/g, "").slice(0, 60) || "Error";
        const message = scrub(input.message);
        const stack = scrubStack(input.stack);
        const fingerprint = createHash("sha256")
            .update([input.source, place, kind, stack.split("\n")[0] ?? ""].join("|"))
            .digest("hex")
            .slice(0, 32);

        log("warn", "outside_error", { source: input.source, place, kind, message, fingerprint });

        let entry = pending.get(fingerprint);
        if (!entry) {
            if (pending.size >= MAX_TRACKED) return false;
            entry = {
                report: { fingerprint, source: input.source, place, kind, message, stack, requestId: null, count: 0 },
                lastFlush: 0,
            };
            pending.set(fingerprint, entry);
        }
        entry.report.count++;
        if (now - entry.lastFlush >= FLUSH_MS) void flush(entry, now).catch(() => undefined);
        return true;
    } catch {
        return false;
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
    outsideWindow = 0;
    outsideCount = 0;
}

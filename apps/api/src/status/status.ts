import { createHash, randomBytes } from "node:crypto";

// A volunteer follows their request with a secret link, and nothing else:
// no account, no address. The server keeps only the hash of the secret, so
// a copy of the database can neither look a request up nor send a reminder.

export const FIRST_REMINDER_AFTER_DAYS = 3;
export const DAYS_BETWEEN_REMINDERS = 7;
export const MAX_REMINDERS = 3;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const DAY_MS = 24 * 3600_000;

export function newStatusToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: hashStatusToken(token)! };
}

// Null for anything that cannot be a token, so junk never reaches the database.
export function hashStatusToken(token: unknown): string | null {
    if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
    return createHash("sha256").update(token).digest("hex");
}

export type ReminderState = { canRemindAt: string | null; remaining: number };

/**
 * When the volunteer may next nudge the organisation. Null means never:
 * the reminders are used up.
 */
export function reminderState(
    row: { created_at: string; reminded_at: string | null; reminder_count: number },
): ReminderState {
    const remaining = Math.max(0, MAX_REMINDERS - row.reminder_count);
    if (remaining === 0) return { canRemindAt: null, remaining };
    const at = row.reminded_at
        ? Date.parse(row.reminded_at) + DAYS_BETWEEN_REMINDERS * DAY_MS
        : Date.parse(row.created_at) + FIRST_REMINDER_AFTER_DAYS * DAY_MS;
    return { canRemindAt: new Date(at).toISOString(), remaining };
}

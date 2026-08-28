import { describe, expect, it } from "vitest";
import { hoursUntilDeletion, ISSUED_RETENTION_HOURS, retentionCutoffIso } from "./retention";

const HOUR = 60 * 60 * 1000;

describe("retentionCutoffIso", () => {
    it("is exactly the retention window before now", () => {
        const now = Date.parse("2026-08-22T12:00:00.000Z");
        expect(retentionCutoffIso(now)).toBe(
            new Date(now - ISSUED_RETENTION_HOURS * HOUR).toISOString(),
        );
    });
});

describe("hoursUntilDeletion", () => {
    const now = Date.parse("2026-08-22T12:00:00.000Z");

    it("counts down the full window for a just-issued submission", () => {
        expect(hoursUntilDeletion(new Date(now), now)).toBe(ISSUED_RETENTION_HOURS);
    });

    it("rounds partial hours up", () => {
        const issued = new Date(now - 2.5 * HOUR);
        expect(hoursUntilDeletion(issued, now)).toBe(ISSUED_RETENTION_HOURS - 2);
    });

    it("never goes negative for an already-expired row", () => {
        const issued = new Date(now - (ISSUED_RETENTION_HOURS + 5) * HOUR);
        expect(hoursUntilDeletion(issued, now)).toBe(0);
    });

    it("returns null for a submission that has not been issued", () => {
        // The whole point of the 2026-08 model: an unissued submission has
        // no deletion clock. It waits for the admin, however long that takes.
        expect(hoursUntilDeletion(null, now)).toBeNull();
    });

    it("does not start the clock from submission time", () => {
        // Regression guard for the bug this replaced: a submission that came
        // in three days ago but was issued a minute ago must still have a
        // full window left, not be long expired.
        const justIssued = new Date(now - 1 * 60 * 1000);
        expect(hoursUntilDeletion(justIssued, now)).toBe(ISSUED_RETENTION_HOURS);
    });
});

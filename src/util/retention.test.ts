import { describe, expect, it } from "vitest";
import { hoursUntilDeletion, retentionCutoffIso, SUBMISSION_TTL_HOURS } from "./retention";

const HOUR = 60 * 60 * 1000;

describe("retentionCutoffIso", () => {
    it("is exactly TTL hours before now", () => {
        const now = Date.parse("2026-07-11T12:00:00.000Z");
        expect(retentionCutoffIso(now)).toBe(
            new Date(now - SUBMISSION_TTL_HOURS * HOUR).toISOString(),
        );
    });
});

describe("hoursUntilDeletion", () => {
    const now = Date.parse("2026-07-11T12:00:00.000Z");

    it("counts down from the full TTL for a brand new submission", () => {
        expect(hoursUntilDeletion(new Date(now), now)).toBe(SUBMISSION_TTL_HOURS);
    });

    it("rounds partial hours up", () => {
        const created = new Date(now - 2.5 * HOUR);
        expect(hoursUntilDeletion(created, now)).toBe(SUBMISSION_TTL_HOURS - 2);
    });

    it("never goes negative for already-expired rows", () => {
        const created = new Date(now - (SUBMISSION_TTL_HOURS + 5) * HOUR);
        expect(hoursUntilDeletion(created, now)).toBe(0);
    });
});

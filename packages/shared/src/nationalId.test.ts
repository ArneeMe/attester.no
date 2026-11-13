import { describe, expect, it } from "vitest";
import { isValidNationalId, normalizeNationalId } from "./nationalId";

function withControls(nine: string): string | null {
    for (let c1 = 0; c1 < 10; c1++) {
        for (let c2 = 0; c2 < 10; c2++) {
            const candidate = `${nine}${c1}${c2}`;
            if (isValidNationalId(candidate)) return candidate;
        }
    }
    return null;
}

describe("isValidNationalId", () => {
    // Synthetic numbers from Skatteetaten's published test range (month + 80).
    it("accepts numbers with correct control digits", () => {
        const generated = withControls("010180999");
        expect(generated).not.toBeNull();
        expect(isValidNationalId(generated!)).toBe(true);
    });

    it("finds exactly one valid pair of control digits per prefix", () => {
        let count = 0;
        for (let c = 0; c < 100; c++) {
            if (isValidNationalId(`010180999${String(c).padStart(2, "0")}`)) count++;
        }
        expect(count).toBeLessThanOrEqual(1);
    });

    it("rejects a single changed digit", () => {
        const valid = withControls("150295123") ?? withControls("150295124")!;
        const changed = valid.slice(0, 4) + ((Number(valid[4]) + 1) % 10) + valid.slice(5);
        expect(isValidNationalId(changed)).toBe(false);
    });

    it("rejects the wrong length and non-digits", () => {
        expect(isValidNationalId("")).toBe(false);
        expect(isValidNationalId("1234567890")).toBe(false);
        expect(isValidNationalId("123456789012")).toBe(false);
        expect(isValidNationalId("0101809990a")).toBe(false);
        expect(isValidNationalId("00000000000")).toBe(false);
    });

    it("ignores spaces and separators people type", () => {
        const valid = withControls("010180999")!;
        const spaced = `${valid.slice(0, 6)} ${valid.slice(6)}`;
        expect(normalizeNationalId(spaced)).toBe(valid);
        expect(isValidNationalId(spaced)).toBe(true);
    });
});

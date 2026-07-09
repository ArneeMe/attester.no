import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clientIp, resetRateLimiter } from "./rateLimit";

const WINDOW = 10 * 60 * 1000;

describe("checkRateLimit", () => {
    beforeEach(() => resetRateLimiter());

    it("allows hits up to the limit", () => {
        const t0 = 1_000_000;
        for (let i = 0; i < 5; i++) {
            expect(checkRateLimit("k", 5, WINDOW, t0 + i)).toBe(true);
        }
    });

    it("rejects the hit after the limit", () => {
        const t0 = 1_000_000;
        for (let i = 0; i < 5; i++) checkRateLimit("k", 5, WINDOW, t0);
        expect(checkRateLimit("k", 5, WINDOW, t0)).toBe(false);
    });

    it("resets after the window elapses", () => {
        const t0 = 1_000_000;
        for (let i = 0; i < 6; i++) checkRateLimit("k", 5, WINDOW, t0);
        expect(checkRateLimit("k", 5, WINDOW, t0 + WINDOW)).toBe(true);
    });

    it("tracks keys independently", () => {
        const t0 = 1_000_000;
        for (let i = 0; i < 6; i++) checkRateLimit("a", 5, WINDOW, t0);
        expect(checkRateLimit("a", 5, WINDOW, t0)).toBe(false);
        expect(checkRateLimit("b", 5, WINDOW, t0)).toBe(true);
    });
});

describe("clientIp", () => {
    it("prefers cf-connecting-ip", () => {
        const h = new Headers({
            "cf-connecting-ip": "203.0.113.7",
            "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        });
        expect(clientIp(h)).toBe("203.0.113.7");
    });

    it("falls back to first x-forwarded-for entry", () => {
        const h = new Headers({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
        expect(clientIp(h)).toBe("10.0.0.1");
    });

    it("returns 'unknown' with no headers", () => {
        expect(clientIp(new Headers())).toBe("unknown");
    });
});

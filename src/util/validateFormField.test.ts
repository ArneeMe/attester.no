import { describe, expect, it } from "vitest";
import { validateField } from "./validateFormField";
import type { FormFieldSchema } from "@/types/formSchema";

const f = (over: Partial<FormFieldSchema>): FormFieldSchema =>
    ({ key: "k", label: "K", type: "text", ...over } as FormFieldSchema);

describe("validateField", () => {
    it("requires non-optional fields", () => {
        expect(validateField(f({}), "")).toBe("Må fylles ut");
        expect(validateField(f({}), "   ")).toBe("Må fylles ut");
        expect(validateField(f({}), "x")).toBeNull();
    });

    it("allows empty optional fields", () => {
        expect(validateField(f({ optional: true }), "")).toBeNull();
    });

    it("rejects unparseable dates but accepts ISO dates", () => {
        expect(validateField(f({ type: "date" }), "ikke en dato")).toBe("Ugyldig dato");
        expect(validateField(f({ type: "date" }), "2026-07-11")).toBeNull();
    });

    it("validates optional fields when they DO have a value", () => {
        expect(validateField(f({ type: "date", optional: true }), "tull")).toBe("Ugyldig dato");
    });

    it("rejects non-numeric numbers", () => {
        expect(validateField(f({ type: "number" }), "abc")).toBe("Må være et tall");
        expect(validateField(f({ type: "number" }), "42")).toBeNull();
    });
});

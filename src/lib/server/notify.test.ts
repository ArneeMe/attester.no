import { describe, expect, it } from "vitest";
import { buildSubmissionNotification } from "./notify";

describe("buildSubmissionNotification", () => {
    it("includes org name and admin link", () => {
        const { subject, text } = buildSubmissionNotification("Brødkokeri", "brodkokeri");
        expect(subject).toContain("Brødkokeri");
        expect(text).toContain("https://attester.no/login/adminpage/brodkokeri");
    });

    it("contains no submission data placeholders", () => {
        // The notification must stay content-free by design — it should
        // only ever be built from org identity, never volunteer fields.
        const { text } = buildSubmissionNotification("Org", "org");
        expect(text).toContain("ingen personopplysninger");
    });
});

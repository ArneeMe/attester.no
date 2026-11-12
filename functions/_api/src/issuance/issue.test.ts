import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STARTER_TEMPLATES } from "../../../../apps/web/src/app/pdfinfo/starterTemplates";
import { canonicalHash } from "../../../_shared/src/canonicalHash";
import { selectHashFields } from "../../../_shared/src/verifyFieldSelection";
import { certificateInputs, osloDate, verifyUrl } from "./certificatePdf";
import { issueCertificate, previewCertificate } from "./issue";

const starter = STARTER_TEMPLATES[0];
const ORG = "11111111-1111-1111-1111-111111111111";
const SUB = "22222222-2222-2222-2222-222222222222";
const TMPL = "33333333-3333-3333-3333-333333333333";

const data: Record<string, string> = Object.fromEntries(
    starter.formSchema.map((f) => [f.key, f.type === "date" ? "2024-01-01" : `Bjørn Æsel & ${f.key}`]),
);

const template = {
    id: TMPL,
    base_pdf: starter.template.basePdf as unknown as string,
    schemas: starter.template.schemas,
    field_bindings: starter.fieldBindings,
};

type Call = { query: string; variables: Record<string, unknown> };
let calls: Call[];
let existingCertificate: string | null;
let submissionExists: boolean;

beforeEach(() => {
    process.env.HASURA_GRAPHQL_URL = "http://hasura.test/v1/graphql";
    process.env.NHOST_ADMIN_SECRET = "test-secret";
    calls = [];
    existingCertificate = null;
    submissionExists = true;
    vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
        const call = JSON.parse(String(init?.body)) as Call;
        calls.push(call);
        if (call.query.includes("LoadForIssue")) {
            return Response.json({
                data: {
                    submissions: submissionExists ? [{ data, template_id: TMPL }] : [],
                    org_assets: [],
                    certificates: existingCertificate ? [{ id: existingCertificate }] : [],
                },
            });
        }
        if (call.query.includes("LoadTemplateForIssue")) return Response.json({ data: { templates: [template] } });
        if (call.query.includes("InsertCertificate")) {
            return Response.json({ data: { insert_certificates_one: { id: "cert-1" }, update_submissions_by_pk: { id: SUB } } });
        }
        throw new Error("unexpected query");
    });
});

afterEach(() => vi.unstubAllGlobals());

const request = { organizationId: ORG, orgSlug: "echo", submissionId: SUB, userId: "user-1", origin: "https://attester.no" };
const isPdf = (bytes: Uint8Array) => Buffer.from(bytes.slice(0, 5)).toString() === "%PDF-";

describe("issueCertificate", () => {
    it("renders a PDF and stores a hash the verify page will recompute", async () => {
        const result = await issueCertificate(request);
        if (!result.ok) throw new Error(result.error);
        expect(isPdf(result.pdf)).toBe(true);
        expect(result.alreadyIssued).toBe(false);

        const insert = calls.find((c) => c.query.includes("InsertCertificate"))!;
        expect(insert.query).toContain("issued_at");
        expect(insert.variables.issuedBy).toBe("user-1");

        const url = new URL(result.verifyUrl);
        expect(url.origin + url.pathname).toBe("https://attester.no/org/echo/verify");
        expect(url.searchParams.get("t")).toBe(TMPL);
        const params: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
            if (key !== "t") params[key] = value;
        });
        const fields = selectHashFields(starter.formSchema, params);
        expect(await canonicalHash(new URLSearchParams(fields))).toBe(insert.variables.hash);
    });

    it("keeps special characters intact through the URL", () => {
        const url = new URL(
            verifyUrl("https://attester.no", "echo", "tmpl-1", "sub-1", {
                name: "Bjørn Æsel",
                group: "Webkom & venner",
                role: "Leder=Nestleder",
            }),
        );
        expect(url.searchParams.get("name")).toBe("Bjørn Æsel");
        expect(url.searchParams.get("group")).toBe("Webkom & venner");
        expect(url.searchParams.get("role")).toBe("Leder=Nestleder");
    });

    it("stores nothing but ids and the hash", async () => {
        await issueCertificate(request);
        const insert = calls.find((c) => c.query.includes("InsertCertificate"))!;
        expect(Object.keys(insert.variables).sort()).toEqual(
            ["hash", "issuedBy", "organizationId", "submissionId", "submissionUuid", "templateId"],
        );
        expect(JSON.stringify(insert.variables)).not.toContain("Bjørn");
    });

    it("returns the PDF again without a second certificate or a new issued_at", async () => {
        existingCertificate = "cert-0";
        const result = await issueCertificate(request);
        if (!result.ok) throw new Error(result.error);
        expect(result.alreadyIssued).toBe(true);
        expect(result.certificateId).toBe("cert-0");
        expect(isPdf(result.pdf)).toBe(true);
        expect(calls.some((c) => c.query.includes("InsertCertificate"))).toBe(false);
    });

    it("scopes the submission lookup to the caller's organisation", async () => {
        submissionExists = false;
        const result = await issueCertificate(request);
        expect(result).toEqual({ ok: false, status: 404, error: "Submission not found" });
        expect(calls[0].variables.organizationId).toBe(ORG);
        expect(calls[0].query).toContain("organization_id: { _eq: $organizationId }");
    });

    it("rejects an id that is not a uuid before asking the database", async () => {
        const result = await issueCertificate({ ...request, submissionId: "x" });
        expect(result.ok).toBe(false);
        expect(calls).toHaveLength(0);
    });
});

describe("previewCertificate", () => {
    it("renders without registering anything", async () => {
        const result = await previewCertificate(request);
        if (!result.ok) throw new Error(result.error);
        expect(isPdf(result.pdf)).toBe(true);
        expect(calls.some((c) => c.query.includes("mutation"))).toBe(false);
    });
});

describe("certificate inputs", () => {
    it("puts the verify URL in the QR field", () => {
        const inputs = certificateInputs({
            origin: "https://attester.no",
            orgSlug: "echo",
            template,
            submissionId: SUB,
            data,
            assets: [],
            now: new Date("2026-01-01T12:00:00Z"),
        });
        expect(Object.values(inputs)).toContain(verifyUrl("https://attester.no", "echo", TMPL, SUB, data));
    });

    it("dates the certificate in Norwegian time, not the server's", () => {
        expect(osloDate(new Date("2026-06-30T22:30:00Z"))).toBe("01.07.2026");
        expect(osloDate(new Date("2026-12-31T22:59:00Z"))).toBe("31.12.2026");
    });
});

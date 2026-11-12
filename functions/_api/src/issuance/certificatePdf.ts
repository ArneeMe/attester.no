import { generate } from "@pdfme/generator";
import { barcodes, image, text } from "@pdfme/schemas";
import type { Schema, Template } from "@pdfme/common";
import { buildCertParams } from "../../../_shared/src/certParams";
import { decorateTemplateForGenerate } from "../../../_shared/src/decorateTemplate";
import { buildPdfInput, type SystemValues } from "../../../_shared/src/resolveBinding";
import type { FieldBindings } from "../../../_shared/src/types/fieldBindings";
import type { OrgAsset } from "../../../_shared/src/types/orgAssets";

export type CertificateTemplate = {
    id: string;
    base_pdf: string;
    schemas: Template["schemas"];
    field_bindings: FieldBindings | null;
};

export type RenderInput = {
    origin: string;
    orgSlug: string;
    template: CertificateTemplate;
    submissionId: string;
    data: Record<string, string>;
    assets: OrgAsset[];
    now: Date;
    watermark?: boolean;
};

export function verifyUrl(
    origin: string,
    orgSlug: string,
    templateId: string,
    submissionId: string,
    data: Record<string, string>,
): string {
    return `${origin}/org/${encodeURIComponent(orgSlug)}/verify?${buildCertParams(templateId, submissionId, data).toString()}`;
}

export function osloDate(now: Date): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Oslo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("day")}.${get("month")}.${get("year")}`;
}

export function certificateFilename(data: Record<string, string>, submissionId: string): string {
    return data.name ? `${data.name}_attest.pdf` : `attest_${submissionId}.pdf`;
}

const previewWatermark = (pageIndex: number): Schema => ({
    name: `__preview_watermark__${pageIndex}`,
    type: "text",
    content: "FORHÅNDSVISNING: IKKE GYLDIG ATTEST",
    position: { x: 10, y: 130 },
    width: 190,
    height: 20,
    rotate: 30,
    alignment: "center",
    verticalAlignment: "middle",
    fontSize: 24,
    lineHeight: 1,
    characterSpacing: 1,
    fontColor: "#b9b9b9",
    backgroundColor: "",
    opacity: 0.7,
    required: false,
} as Schema);

export function certificateInputs(input: RenderInput): Record<string, string> {
    const system: SystemValues = {
        today: osloDate(input.now),
        qr_code: verifyUrl(input.origin, input.orgSlug, input.template.id, input.submissionId, input.data),
        qr_info: "Scan for å verifisere",
        qr_page: input.origin,
    };
    return buildPdfInput(input.template.schemas, input.template.field_bindings ?? {}, {
        submission: input.data,
        assets: input.assets,
        system,
    });
}

export async function renderCertificatePdf(input: RenderInput): Promise<Uint8Array> {
    const decorated = decorateTemplateForGenerate({
        basePdf: input.template.base_pdf,
        schemas: input.template.schemas,
    });
    const template: Template = input.watermark
        ? {
              ...decorated,
              schemas: (decorated.schemas ?? []).map((page, i) => [...(page ?? []), previewWatermark(i)]),
          }
        : decorated;
    return generate({
        template,
        inputs: [certificateInputs(input)],
        plugins: { text, image, qrcode: barcodes.qrcode },
    });
}

import { hasuraAdmin } from "../lib/hasura";
import { buildCertParams } from "@attester/shared/certParams";
import { canonicalHash } from "@attester/shared/canonicalHash";
import { fromAssetRow, type AssetRow } from "@attester/shared/types/orgAssets";
import {
    certificateFilename,
    renderCertificatePdf,
    verifyUrl,
    type CertificateTemplate,
} from "./certificatePdf";
import { certificateChannel } from "../channels";
import {
    attemptDelivery, deliveriesLastDay, DIGIPOST_DAILY_LIMIT, queueDelivery, toView, type DeliveryView,
} from "../delivery/deliveries";
import { digipostEnabled, loadRecipient } from "../delivery/recipients";

export type IssueRequest = {
    organizationId: string;
    orgSlug: string;
    submissionId: string;
    userId: string;
    origin: string;
    deliver?: "digipost";
};

export type RenderedCertificate = {
    pdf: Uint8Array;
    filename: string;
    verifyUrl: string;
};

export type IssueResult =
    | ({ ok: true; certificateId: string; alreadyIssued: boolean; delivery: DeliveryView | null } & RenderedCertificate)
    | { ok: false; status: number; error: string };

type Loaded = {
    data: Record<string, string>;
    template: CertificateTemplate;
    assets: AssetRow[];
    certificateId: string | null;
    orgName: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(organizationId: string, submissionId: string): Promise<Loaded | { status: number; error: string }> {
    if (!UUID_RE.test(submissionId)) return { status: 404, error: "Submission not found" };
    const res = await hasuraAdmin<{
        submissions: Array<{ data: Record<string, string>; template_id: string }>;
        org_assets: AssetRow[];
        certificates: Array<{ id: string }>;
        organizations: Array<{ name: string }>;
    }>(
        `query LoadForIssue($organizationId: uuid!, $submissionUuid: uuid!, $submissionId: String!) {
            submissions(where: { id: { _eq: $submissionUuid }, organization_id: { _eq: $organizationId } }, limit: 1) {
                data template_id
            }
            org_assets(
                where: { organization_id: { _eq: $organizationId } },
                order_by: [{ kind: asc }, { sort_order: asc }, { created_at: asc }]
            ) {
                id organization_id kind name content is_default sort_order created_at updated_at
            }
            certificates(
                where: { organization_id: { _eq: $organizationId }, submission_id: { _eq: $submissionId } },
                limit: 1
            ) { id }
            organizations(where: { id: { _eq: $organizationId } }, limit: 1) { name }
        }`,
        { organizationId, submissionUuid: submissionId, submissionId },
    );
    const submission = res.submissions[0];
    if (!submission) return { status: 404, error: "Submission not found" };

    const tmpl = await hasuraAdmin<{ templates: CertificateTemplate[] }>(
        `query LoadTemplateForIssue($id: uuid!, $organizationId: uuid!) {
            templates(where: { id: { _eq: $id }, organization_id: { _eq: $organizationId } }, limit: 1) {
                id base_pdf schemas field_bindings
            }
        }`,
        { id: submission.template_id, organizationId },
    );
    const template = tmpl.templates[0];
    if (!template) return { status: 409, error: "Template no longer exists" };

    return {
        data: submission.data,
        template,
        assets: res.org_assets,
        certificateId: res.certificates[0]?.id ?? null,
        orgName: res.organizations[0]?.name ?? "",
    };
}

async function render(req: IssueRequest, loaded: Loaded, watermark: boolean): Promise<RenderedCertificate> {
    const pdf = await renderCertificatePdf({
        origin: req.origin,
        orgSlug: req.orgSlug,
        template: loaded.template,
        submissionId: req.submissionId,
        data: loaded.data,
        assets: loaded.assets.map(fromAssetRow),
        now: new Date(),
        watermark,
    });
    return {
        pdf,
        filename: certificateFilename(loaded.data, req.submissionId),
        verifyUrl: verifyUrl(req.origin, req.orgSlug, loaded.template.id, req.submissionId, loaded.data),
    };
}

export async function previewCertificate(
    req: IssueRequest,
): Promise<({ ok: true } & RenderedCertificate) | { ok: false; status: number; error: string }> {
    const loaded = await load(req.organizationId, req.submissionId);
    if ("error" in loaded) return { ok: false, ...loaded };
    return { ok: true, ...(await render(req, loaded, true)) };
}

async function deliver(req: IssueRequest, loaded: Loaded, nationalId: string, rendered: RenderedCertificate): Promise<DeliveryView> {
    const row = await queueDelivery({
        organizationId: req.organizationId,
        submissionId: req.submissionId,
        nationalId,
        subject: `Attest fra ${loaded.orgName}`,
        filename: rendered.filename,
        pdf: rendered.pdf,
    });
    const status = await attemptDelivery(row);
    return { ...toView(row), status, sentAt: status === "sent" ? new Date().toISOString() : row.sent_at };
}

export async function issueCertificate(req: IssueRequest): Promise<IssueResult> {
    const loaded = await load(req.organizationId, req.submissionId);
    if ("error" in loaded) return { ok: false, ...loaded };

    // Settle whether delivery is possible before anything is registered.
    let nationalId: string | null = null;
    if (req.deliver === "digipost") {
        if (!certificateChannel() || !(await digipostEnabled(req.organizationId))) {
            return { ok: false, status: 409, error: "Digipost delivery is not available for this organization" };
        }
        if ((await deliveriesLastDay(req.organizationId)) >= DIGIPOST_DAILY_LIMIT) {
            return { ok: false, status: 429, error: "Daily Digipost limit reached for this organization" };
        }
        nationalId = await loadRecipient(req.submissionId);
        if (!nationalId) {
            return { ok: false, status: 409, error: "This submission has no Digipost recipient" };
        }
    }

    // Render before registering, so a template that cannot render never
    // leaves a certificate nobody holds.
    const rendered = await render(req, loaded, false);

    let certificateId = loaded.certificateId;
    const alreadyIssued = certificateId !== null;
    if (!certificateId) {
        const hash = await canonicalHash(buildCertParams(loaded.template.id, req.submissionId, loaded.data));
        const inserted = await hasuraAdmin<{ insert_certificates_one: { id: string } }>(
            `mutation InsertCertificate($organizationId: uuid!, $submissionId: String!, $submissionUuid: uuid!, $hash: String!, $templateId: uuid!, $issuedBy: uuid!) {
                insert_certificates_one(object: {
                    organization_id: $organizationId,
                    submission_id: $submissionId,
                    hash: $hash,
                    template_id: $templateId,
                    issued_by: $issuedBy
                }) { id }
                update_submissions_by_pk(
                    pk_columns: { id: $submissionUuid },
                    _set: { issued_at: "now()" }
                ) { id }
            }`,
            {
                organizationId: req.organizationId,
                submissionId: req.submissionId,
                submissionUuid: req.submissionId,
                hash,
                templateId: loaded.template.id,
                issuedBy: req.userId,
            },
        );
        certificateId = inserted.insert_certificates_one.id;
    }

    const delivery = nationalId ? await deliver(req, loaded, nationalId, rendered) : null;
    return { ok: true, certificateId, alreadyIssued, delivery, ...rendered };
}

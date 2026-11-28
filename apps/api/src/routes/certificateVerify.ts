import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { resolveOrgIdBySlug } from "../lib/apiAuth";
import { serverError } from "../lib/apiError";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const submissionId = new URL(req.url).searchParams.get("submissionId");
    if (!submissionId) {
        return json({ error: "Missing submissionId" }, { status: 400 });
    }

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return json({ error: "Organization not found" }, { status: 404 });
        }

        const data = await hasuraAdmin<{
            certificates: Array<{ hash: string; template_id: string | null }>;
        }>(
            `query VerifyCertificate($submissionId: String!, $organizationId: uuid!) {
                certificates(
                    where: {
                        submission_id: { _eq: $submissionId },
                        organization_id: { _eq: $organizationId }
                    },
                    limit: 1
                ) { hash template_id }
            }`,
            { submissionId, organizationId },
        );
        const cert = data.certificates[0] ?? null;
        return json({ hash: cert?.hash ?? null, template_id: cert?.template_id ?? null });
    } catch (e) {
        return serverError(e, "api/org/[slug]/certificates/verify");
    }
}

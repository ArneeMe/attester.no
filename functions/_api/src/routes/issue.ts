import { json, publicOrigin } from "../http";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { serverError } from "../lib/apiError";
import { issueCertificate } from "../issuance/issue";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    try {
        const result = await issueCertificate({
            organizationId: auth.organizationId,
            orgSlug: slug,
            submissionId: id,
            userId: auth.userId,
            origin: publicOrigin(req),
        });
        if (!result.ok) return json({ error: result.error }, { status: result.status });
        return json({
            id: result.certificateId,
            alreadyIssued: result.alreadyIssued,
            filename: result.filename,
            verifyUrl: result.verifyUrl,
            pdf: Buffer.from(result.pdf).toString("base64"),
        });
    } catch (e) {
        return serverError(e, "api/org/[slug]/submissions/[id]/issue");
    }
}

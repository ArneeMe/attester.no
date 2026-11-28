import { json, appOrigin } from "../http";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { serverError } from "../lib/apiError";
import { previewCertificate } from "../issuance/issue";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    try {
        const result = await previewCertificate({
            organizationId: auth.organizationId,
            orgSlug: slug,
            submissionId: id,
            userId: auth.userId,
            origin: appOrigin(),
        });
        if (!result.ok) return json({ error: result.error }, { status: result.status });
        return json({
            filename: result.filename,
            verifyUrl: result.verifyUrl,
            pdf: Buffer.from(result.pdf).toString("base64"),
        });
    } catch (e) {
        return serverError(e, "api/org/[slug]/submissions/[id]/preview");
    }
}

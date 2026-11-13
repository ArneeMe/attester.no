import { json } from "../http";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { submissionBelongsToOrg } from "../lib/ownership";
import { serverError } from "../lib/apiError";
import { certificateChannel } from "../channels";
import { digipostEnabled, loadRecipient } from "../delivery/recipients";

/**
 * Can this submission's certificate be sent to Digipost? Answers yes or no.
 * The number itself never leaves the server.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    try {
        const channel = certificateChannel();
        if (!channel || !(await digipostEnabled(auth.organizationId))) return json({ canReceive: false });
        if (!(await submissionBelongsToOrg(id, auth.organizationId))) {
            return json({ error: "Not found" }, { status: 404 });
        }
        const nationalId = await loadRecipient(id);
        if (!nationalId) return json({ canReceive: false });
        return json({ canReceive: await channel.canReceive(nationalId) });
    } catch (e) {
        return serverError(e, "api/org/[slug]/submissions/[id]/recipient-check");
    }
}

import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { serverError } from "../lib/apiError";
import { certificateChannel } from "../channels";
import { digipostEnabled } from "../delivery/recipients";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    try {
        return json({
            digipostAvailable: !!certificateChannel(),
            digipostEnabled: await digipostEnabled(auth.organizationId),
        });
    } catch (e) {
        return serverError(e, "api/org/[slug]/settings");
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    const body = (await req.json().catch(() => null)) as { digipostEnabled?: unknown } | null;
    if (typeof body?.digipostEnabled !== "boolean") {
        return json({ error: "digipostEnabled must be true or false" }, { status: 400 });
    }

    try {
        await hasuraAdmin(
            `mutation SetOrgSettings($organizationId: uuid!, $enabled: Boolean!) {
                insert_org_settings_one(
                    object: { organization_id: $organizationId, digipost_enabled: $enabled },
                    on_conflict: { constraint: org_settings_pkey, update_columns: [digipost_enabled] }
                ) { organization_id }
            }`,
            { organizationId: auth.organizationId, enabled: body.digipostEnabled },
        );
        return json({ digipostAvailable: !!certificateChannel(), digipostEnabled: body.digipostEnabled });
    } catch (e) {
        return serverError(e, "api/org/[slug]/settings");
    }
}

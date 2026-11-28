import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug, resolveOrgIdBySlug } from "../lib/apiAuth";
import { requirePlatformAdmin } from "../lib/platformAdmin";
import { readJsonObject } from "../lib/input";
import { serverError } from "../lib/apiError";
import { certificateChannel } from "../channels";
import { deleteRecipientsOfOrg, digipostEnabled } from "../delivery/recipients";

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

// Only the platform owner turns Digipost on for an organisation. Every
// letter is sent in attester.no's name and at its cost, so an organisation
// must not be able to grant itself that.
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requirePlatformAdmin(req);
    if (auth instanceof Response) return auth;

    const body = await readJsonObject(req);
    if (typeof body.digipostEnabled !== "boolean") {
        return json({ error: "digipostEnabled must be true or false" }, { status: 400 });
    }

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) return json({ error: "Organization not found" }, { status: 404 });

        await hasuraAdmin(
            `mutation SetOrgSettings($organizationId: uuid!, $enabled: Boolean!) {
                insert_org_settings_one(
                    object: { organization_id: $organizationId, digipost_enabled: $enabled },
                    on_conflict: { constraint: org_settings_pkey, update_columns: [digipost_enabled] }
                ) { organization_id }
            }`,
            { organizationId, enabled: body.digipostEnabled },
        );
        // Turned off: the numbers already collected have no use left.
        if (!body.digipostEnabled) await deleteRecipientsOfOrg(organizationId);
        return json({ digipostAvailable: !!certificateChannel(), digipostEnabled: body.digipostEnabled });
    } catch (e) {
        return serverError(e, "api/org/[slug]/settings");
    }
}

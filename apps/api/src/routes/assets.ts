import { json } from "../http";
import { hasuraAdmin } from "../lib/hasura";
import { requireOrgMemberBySlug } from "../lib/apiAuth";
import { validateAssetContent } from "@attester/shared/validateAssetContent";
import type { AssetRow, AssetKind } from "@attester/shared/types/orgAssets";
import { serverError } from "../lib/apiError";

const VALID_KINDS: AssetKind[] = ['signature', 'logo', 'body_text', 'lookup_list'];
const MAX_ASSET_NAME_LEN = 200;

export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    try {
        const data = await hasuraAdmin<{ org_assets: AssetRow[] }>(
            `query GetAssets($organizationId: uuid!) {
                org_assets(
                    where: { organization_id: { _eq: $organizationId } },
                    order_by: [{ kind: asc }, { sort_order: asc }, { created_at: asc }]
                ) {
                    id organization_id kind name content is_default sort_order created_at updated_at
                }
            }`,
            { organizationId: auth.organizationId },
        );
        return json({ assets: data.org_assets });
    } catch (e) {
        return serverError(e, "api/org/[slug]/assets");
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof Response) return auth;

    const body = await req.json();
    const { kind, name, content, isDefault, sortOrder } = body;
    if (!kind || !VALID_KINDS.includes(kind)) {
        return json({ error: "Invalid or missing kind" }, { status: 400 });
    }
    if (typeof name !== "string" || !name.trim()) {
        return json({ error: "Missing name" }, { status: 400 });
    }
    if (name.length > MAX_ASSET_NAME_LEN) {
        return json({ error: "Name too long" }, { status: 400 });
    }
    if (content === undefined || content === null || typeof content !== "object") {
        return json({ error: "Missing content" }, { status: 400 });
    }
    const v = validateAssetContent(kind, content);
    if (!v.ok) return json({ error: v.error }, { status: 400 });

    try {
        const data = await hasuraAdmin<{ insert_org_assets_one: AssetRow }>(
            `mutation InsertAsset(
                $organizationId: uuid!, $kind: String!, $name: String!,
                $content: jsonb!, $isDefault: Boolean!, $sortOrder: Int!
            ) {
                insert_org_assets_one(object: {
                    organization_id: $organizationId, kind: $kind, name: $name,
                    content: $content, is_default: $isDefault, sort_order: $sortOrder
                }) {
                    id organization_id kind name content is_default sort_order created_at updated_at
                }
            }`,
            {
                organizationId: auth.organizationId,
                kind,
                name: name.trim(),
                content,
                isDefault: Boolean(isDefault),
                sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
            },
        );
        return json({ asset: data.insert_org_assets_one });
    } catch (e) {
        return serverError(e, "api/org/[slug]/assets");
    }
}

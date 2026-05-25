import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";
import type { AssetRow, AssetKind } from "@/types/orgAssets";

export const runtime = "edge";

const VALID_KINDS: AssetKind[] = ['signature', 'logo', 'body_text', 'lookup_list'];

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

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
        return NextResponse.json({ assets: data.org_assets });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { kind, name, content, isDefault, sortOrder } = body;
    if (!kind || !VALID_KINDS.includes(kind)) {
        return NextResponse.json({ error: "Invalid or missing kind" }, { status: 400 });
    }
    if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }
    if (content === undefined || content === null || typeof content !== "object") {
        return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

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
        return NextResponse.json({ asset: data.insert_org_assets_one });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

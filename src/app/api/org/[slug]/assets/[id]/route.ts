import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug } from "@/lib/server/apiAuth";
import type { AssetRow } from "@/types/orgAssets";

export const runtime = "edge";

async function getAssetOrgId(id: string): Promise<string | null> {
    const data = await hasuraAdmin<{ org_assets: { organization_id: string }[] }>(
        `query GetAssetOrg($id: uuid!) {
            org_assets(where: { id: { _eq: $id } }, limit: 1) { organization_id }
        }`,
        { id },
    );
    return data.org_assets[0]?.organization_id ?? null;
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    const ownerOrg = await getAssetOrgId(id);
    if (!ownerOrg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (ownerOrg !== auth.organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const set: Record<string, unknown> = {};
    if (typeof body.name === "string") set.name = body.name.trim();
    if (body.content !== undefined && body.content !== null && typeof body.content === "object") {
        set.content = body.content;
    }
    if (typeof body.isDefault === "boolean") set.is_default = body.isDefault;
    if (Number.isFinite(body.sortOrder)) set.sort_order = body.sortOrder;
    set.updated_at = new Date().toISOString();

    try {
        const data = await hasuraAdmin<{ update_org_assets_by_pk: AssetRow }>(
            `mutation UpdateAsset($id: uuid!, $set: org_assets_set_input!) {
                update_org_assets_by_pk(pk_columns: { id: $id }, _set: $set) {
                    id organization_id kind name content is_default sort_order created_at updated_at
                }
            }`,
            { id, set },
        );
        return NextResponse.json({ asset: data.update_org_assets_by_pk });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    const ownerOrg = await getAssetOrgId(id);
    if (!ownerOrg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (ownerOrg !== auth.organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        await hasuraAdmin(
            `mutation DeleteAsset($id: uuid!) {
                delete_org_assets_by_pk(id: $id) { id }
            }`,
            { id },
        );
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

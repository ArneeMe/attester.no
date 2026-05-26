import { authHeader } from '@/lib/nhost';
import type {
    AssetContent,
    AssetKind,
    AssetRow,
    OrgAsset,
} from '@/types/orgAssets';
import { fromAssetRow } from '@/types/orgAssets';

export async function listOrgAssets(orgSlug: string): Promise<OrgAsset[]> {
    const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/assets`, {
        headers: authHeader(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to load assets');
    return (json.assets as AssetRow[]).map(fromAssetRow);
}

export type CreateAssetInput = {
    kind: AssetKind;
    name: string;
    content: AssetContent;
    isDefault?: boolean;
    sortOrder?: number;
};

export async function createOrgAsset(
    orgSlug: string,
    input: CreateAssetInput,
): Promise<OrgAsset> {
    const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/assets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeader() },
        body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to create asset');
    return fromAssetRow(json.asset as AssetRow);
}

export type UpdateAssetInput = Partial<
    Pick<OrgAsset, 'name' | 'content' | 'isDefault' | 'sortOrder'>
>;

export async function updateOrgAsset(
    orgSlug: string,
    assetId: string,
    input: UpdateAssetInput,
): Promise<OrgAsset> {
    const res = await fetch(
        `/api/org/${encodeURIComponent(orgSlug)}/assets/${encodeURIComponent(assetId)}`,
        {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', ...authHeader() },
            body: JSON.stringify(input),
        },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Failed to update asset');
    return fromAssetRow(json.asset as AssetRow);
}

export async function deleteOrgAsset(orgSlug: string, assetId: string): Promise<void> {
    const res = await fetch(
        `/api/org/${encodeURIComponent(orgSlug)}/assets/${encodeURIComponent(assetId)}`,
        { method: 'DELETE', headers: authHeader() },
    );
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to delete asset');
    }
}

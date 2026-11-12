/**
 * Per-org content library. Each asset belongs to one organization and has a
 * kind. The `name` column is the human-readable label/title; the `content`
 * blob carries kind-specific fields.
 *
 * Signatures, logos, body-text blocks, and lookup-lists used to be three
 * special-cased columns on `organizations`. They're unified here so any org
 * can grow new asset types without schema changes.
 */

export type AssetKind = 'signature' | 'logo' | 'body_text' | 'lookup_list';

export type SignatureContent = {
    photo: string;
    role: string;
    phone: string;
};

export type LogoContent = {
    image: string;
};

export type BodyTextContent = {
    text: string;
};

export type LookupItem = {
    name: string;
    description?: string;
    [extra: string]: string | undefined;
};

export type LookupListContent = {
    items: LookupItem[];
};

export type AssetContent =
    | SignatureContent
    | LogoContent
    | BodyTextContent
    | LookupListContent
    | Record<string, unknown>;

export type OrgAsset = {
    id: string;
    organizationId: string;
    kind: AssetKind;
    name: string;
    content: AssetContent;
    isDefault: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
};

export type AssetRow = {
    id: string;
    organization_id: string;
    kind: AssetKind;
    name: string;
    content: AssetContent;
    is_default: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
};

export function fromAssetRow(row: AssetRow): OrgAsset {
    return {
        id: row.id,
        organizationId: row.organization_id,
        kind: row.kind,
        name: row.name,
        content: row.content,
        isDefault: row.is_default,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export const KIND_LABELS_NB: Record<AssetKind, string> = {
    signature: 'Signaturer',
    logo: 'Logoer',
    body_text: 'Tekstblokker',
    lookup_list: 'Oppslagslister',
};

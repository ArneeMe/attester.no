export type OfferableTemplate = {
    id: string;
    name: string;
    description: string | null;
    is_offered: boolean;
};

export type OfferedTemplate = {
    id: string;
    name: string;
    description: string | null;
};

export function selectOfferedTemplates(rows: OfferableTemplate[]): OfferedTemplate[] {
    return rows
        .filter((r) => r.is_offered)
        .map((r) => ({ id: r.id, name: r.name, description: r.description ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name, 'no'));
}

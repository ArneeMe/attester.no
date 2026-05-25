import type {
    FieldBinding,
    FieldBindings,
    SystemSlot,
} from '@/types/fieldBindings';
import type {
    OrgAsset,
    LookupListContent,
    LookupItem,
} from '@/types/orgAssets';
import type { Template } from '@pdfme/common';
import { formatDate } from '@/util/formatDate';

export type SystemValues = Record<SystemSlot, string>;

export type ResolveContext = {
    submission: Record<string, string>;
    assets: OrgAsset[];
    system: SystemValues;
};

/**
 * Reads a sub-field out of an asset. `name` is the asset row's name column
 * (the human label); everything else lives in the content jsonb.
 */
function readAssetField(asset: OrgAsset, subField: string | undefined): string {
    if (!subField || subField === 'name') return asset.name;
    const content = asset.content as Record<string, unknown>;
    const v = content[subField];
    return typeof v === 'string' ? v : '';
}

/**
 * Picks the Nth default asset of a given kind, ordered by sort_order then
 * created_at. `position` is 0-indexed.
 */
function pickDefaultAsset(
    assets: OrgAsset[],
    kind: OrgAsset['kind'],
    position: number,
): OrgAsset | null {
    const candidates = assets
        .filter((a) => a.kind === kind && a.isDefault)
        .sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
            return a.createdAt.localeCompare(b.createdAt);
        });
    return candidates[position] ?? null;
}

function interpolate(template: string, data: Record<string, string>): string {
    return template.replace(/\{([^}]+)\}/g, (_, expr: string) => {
        const [key, fmt] = expr.split(':');
        const raw = data[key] ?? '';
        if (!raw) return '';
        if (fmt === 'date') return formatDate(raw);
        return raw;
    });
}

export function resolveBinding(binding: FieldBinding, ctx: ResolveContext): string {
    // The DB stores bindings as opaque jsonb. If something we don't recognise
    // slips through (older row, hand-edited, etc.) we'd rather render empty
    // than throw mid-PDF — so an exhaustive switch with a safe default.
    switch (binding.source) {
        case 'system':
            return ctx.system[binding.system] ?? '';

        case 'submission':
            return ctx.submission[binding.key] ?? '';

        case 'composite': {
            if (binding.requireAll?.some((k) => !ctx.submission[k])) return '';
            return interpolate(binding.template, ctx.submission);
        }

        case 'asset': {
            const asset = ctx.assets.find((a) => a.id === binding.assetId);
            if (!asset) return '';
            return readAssetField(asset, binding.subField);
        }

        case 'asset_default': {
            const asset = pickDefaultAsset(ctx.assets, binding.kind, binding.position ?? 0);
            if (!asset) return '';
            return readAssetField(asset, binding.subField);
        }

        case 'lookup': {
            const list = ctx.assets.find((a) => a.id === binding.assetId);
            if (!list || list.kind !== 'lookup_list') return '';
            const items = (list.content as LookupListContent).items ?? [];
            const lookupValue = ctx.submission[binding.byKey];
            const item: LookupItem | undefined = items.find((i) => i.name === lookupValue);
            if (!item) return '';
            const v = item[binding.subField];
            return typeof v === 'string' ? v : '';
        }

        default:
            return '';
    }
}

/**
 * Builds the flat input object pdfme.generate expects.
 *
 *  - Bound fields always get their resolved value (even empty string).
 *  - Unbound fields get the matching submission key if it exists, otherwise
 *    are *omitted* so pdfme falls back to the schema's `content` default.
 *    This lets admins place purely-static text (e.g. the "attester.no"
 *    brand mark) without needing to wire a binding.
 *  - Image-type fields are omitted unless their value is a valid data:
 *    URL. pdfme's image plugin throws on empty / non-image strings, so an
 *    org without a default signature would otherwise blow up the whole
 *    generate() call (rather than rendering an empty image slot).
 */
export function buildPdfInput(
    schemas: Template['schemas'],
    bindings: FieldBindings,
    ctx: ResolveContext,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const page of schemas ?? []) {
        for (const field of page ?? []) {
            const name = field?.name;
            if (typeof name !== 'string' || name in out) continue;
            const binding = (bindings ?? {})[name];
            let value: string | undefined;
            if (binding) {
                value = resolveBinding(binding, ctx);
            } else if (ctx.submission[name] !== undefined) {
                value = ctx.submission[name];
            }
            if (value === undefined) continue;
            if (field.type === 'image' && !value.startsWith('data:image/')) continue;
            out[name] = value;
        }
    }
    return out;
}

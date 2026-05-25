import type { AssetKind } from "@/types/orgAssets";

// Reasonable size caps so a single asset can't bloat the DB row or the
// memory budget of the edge runtime. Images get the biggest slice; text
// blocks and lookup lists are tighter.
const MAX_IMAGE_DATA_URL = 1_000_000; // ~1MB base64 ≈ 750KB binary
const MAX_BODY_TEXT = 16_000;
const MAX_LOOKUP_ITEMS = 500;
const MAX_LOOKUP_TOTAL_JSON = 200_000;

export type ValidationResult = { ok: true } | { ok: false; error: string };

function isPlainObject(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isStringOrEmpty(v: unknown): v is string {
    return typeof v === "string";
}

/**
 * Per-kind content shape + size validation, run server-side before any
 * insert/update of org_assets. Defensive: keeps us safe from clients that
 * skip the (also-present) client-side validation, or from a future feature
 * that builds asset rows programmatically.
 */
export function validateAssetContent(kind: AssetKind, content: unknown): ValidationResult {
    if (!isPlainObject(content)) {
        return { ok: false, error: "Asset content must be an object" };
    }

    switch (kind) {
        case "signature": {
            const { photo, role, phone } = content as { photo?: unknown; role?: unknown; phone?: unknown };
            if (photo !== undefined && !isStringOrEmpty(photo)) {
                return { ok: false, error: "signature.photo must be a string" };
            }
            if (role !== undefined && !isStringOrEmpty(role)) {
                return { ok: false, error: "signature.role must be a string" };
            }
            if (phone !== undefined && !isStringOrEmpty(phone)) {
                return { ok: false, error: "signature.phone must be a string" };
            }
            if (isStringOrEmpty(photo) && photo.length > MAX_IMAGE_DATA_URL) {
                return { ok: false, error: "signature photo too large (max ~1MB)" };
            }
            if (isStringOrEmpty(photo) && photo.length > 0 && !photo.startsWith("data:image/")) {
                return { ok: false, error: "signature photo must be a data:image/... URL" };
            }
            return { ok: true };
        }

        case "logo": {
            const { image } = content as { image?: unknown };
            if (image !== undefined && !isStringOrEmpty(image)) {
                return { ok: false, error: "logo.image must be a string" };
            }
            if (isStringOrEmpty(image) && image.length > MAX_IMAGE_DATA_URL) {
                return { ok: false, error: "logo image too large (max ~1MB)" };
            }
            if (isStringOrEmpty(image) && image.length > 0 && !image.startsWith("data:image/")) {
                return { ok: false, error: "logo image must be a data:image/... URL" };
            }
            return { ok: true };
        }

        case "body_text": {
            const { text } = content as { text?: unknown };
            if (text !== undefined && !isStringOrEmpty(text)) {
                return { ok: false, error: "body_text.text must be a string" };
            }
            if (isStringOrEmpty(text) && text.length > MAX_BODY_TEXT) {
                return { ok: false, error: `body_text too long (max ${MAX_BODY_TEXT} chars)` };
            }
            return { ok: true };
        }

        case "lookup_list": {
            const { items } = content as { items?: unknown };
            if (!Array.isArray(items)) {
                return { ok: false, error: "lookup_list.items must be an array" };
            }
            if (items.length > MAX_LOOKUP_ITEMS) {
                return { ok: false, error: `Too many items (max ${MAX_LOOKUP_ITEMS})` };
            }
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                if (!isPlainObject(it)) {
                    return { ok: false, error: `Item ${i} must be an object` };
                }
                if (typeof it.name !== "string") {
                    return { ok: false, error: `Item ${i} is missing a string "name"` };
                }
                for (const [k, v] of Object.entries(it)) {
                    if (v !== undefined && v !== null && typeof v !== "string") {
                        return { ok: false, error: `Item ${i} field "${k}" must be a string` };
                    }
                }
            }
            // Stringify-size guard catches the "1000 small items each with
            // 1MB descriptions" case the per-item check above wouldn't.
            if (JSON.stringify(content).length > MAX_LOOKUP_TOTAL_JSON) {
                return { ok: false, error: "Lookup list too large" };
            }
            return { ok: true };
        }
    }
}

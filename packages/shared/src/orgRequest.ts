export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const MAX_SLUG_LEN = 64;
export const MAX_NAME_LEN = 200;
export const MAX_CONTACT_NAME_LEN = 200;
export const MAX_EMAIL_LEN = 320;
export const MAX_MESSAGE_LEN = 2000;

export interface OrgRequestInput {
    slug?: unknown;
    organizationName?: unknown;
    orgNumber?: unknown;
    contactEmail?: unknown;
    contactName?: unknown;
    message?: unknown;
    website?: unknown;
}

export interface OrgRequest {
    slug: string;
    organizationName: string;
    orgNumber: string | null;
    contactEmail: string;
    contactName: string | null;
    message: string | null;
}

export type OrgRequestField =
    | 'slug'
    | 'organizationName'
    | 'orgNumber'
    | 'contactEmail'
    | 'contactName'
    | 'message';

export type ValidationError = 'required' | 'too_long' | 'bad_slug' | 'bad_email' | 'bad_org_number';

export type OrgRequestResult =
    | { ok: true; value: OrgRequest }
    | { ok: false; field: OrgRequestField; error: ValidationError }
    | { ok: false; field: null; error: 'honeypot' };

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

const NORDIC: Record<string, string> = { å: 'a', æ: 'ae', ø: 'o', ä: 'a', ö: 'o', é: 'e', è: 'e', ü: 'u' };

export function suggestSlug(organizationName: string): string {
    const folded = organizationName
        .toLowerCase()
        .replace(/[åæøäöéèü]/g, (c) => NORDIC[c] ?? c)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    return folded
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_SLUG_LEN)
        .replace(/-+$/g, '');
}

export const ORG_NUMBER_DIGITS = 9;

const ORG_NUMBER_WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2];

// Norwegian organisasjonsnummer: nine digits, last one a MOD11 check digit.
export function isValidOrgNumber(value: string): boolean {
    const digits = value.replace(/\s/g, '');
    if (!/^\d{9}$/.test(digits)) return false;
    const sum = ORG_NUMBER_WEIGHTS.reduce((acc, weight, i) => acc + weight * Number(digits[i]), 0);
    const remainder = sum % 11;
    const check = remainder === 0 ? 0 : 11 - remainder;
    return check !== 10 && check === Number(digits[8]);
}

export function normalizeOrgNumber(value: string): string {
    return value.replace(/\s/g, '');
}

export function validateOrgRequest(input: OrgRequestInput): OrgRequestResult {
    // A real submission leaves this empty; the form renders it hidden.
    if (text(input.website)) return { ok: false, field: null, error: 'honeypot' };

    const organizationName = text(input.organizationName);
    if (!organizationName) return { ok: false, field: 'organizationName', error: 'required' };
    if (organizationName.length > MAX_NAME_LEN) {
        return { ok: false, field: 'organizationName', error: 'too_long' };
    }

    const slug = text(input.slug).toLowerCase();
    if (!slug) return { ok: false, field: 'slug', error: 'required' };
    if (slug.length > MAX_SLUG_LEN) return { ok: false, field: 'slug', error: 'too_long' };
    if (!SLUG_RE.test(slug)) return { ok: false, field: 'slug', error: 'bad_slug' };

    const rawOrgNumber = text(input.orgNumber);
    if (rawOrgNumber && !isValidOrgNumber(rawOrgNumber)) {
        return { ok: false, field: 'orgNumber', error: 'bad_org_number' };
    }

    const contactEmail = text(input.contactEmail).toLowerCase();
    if (!contactEmail) return { ok: false, field: 'contactEmail', error: 'required' };
    if (contactEmail.length > MAX_EMAIL_LEN) {
        return { ok: false, field: 'contactEmail', error: 'too_long' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return { ok: false, field: 'contactEmail', error: 'bad_email' };
    }

    const contactName = text(input.contactName);
    if (contactName.length > MAX_CONTACT_NAME_LEN) {
        return { ok: false, field: 'contactName', error: 'too_long' };
    }

    const message = text(input.message);
    if (message.length > MAX_MESSAGE_LEN) {
        return { ok: false, field: 'message', error: 'too_long' };
    }

    return {
        ok: true,
        value: {
            slug,
            organizationName,
            orgNumber: rawOrgNumber ? normalizeOrgNumber(rawOrgNumber) : null,
            contactEmail,
            contactName: contactName || null,
            message: message || null,
        },
    };
}

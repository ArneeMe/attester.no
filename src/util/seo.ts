import type { Metadata } from 'next';

export const SITE_URL = 'https://attester.no';

/**
 * Canonical + hreflang metadata for the public pages. Norwegian is the
 * canonical language; the English variant lives at ?lang=en. Search
 * engines get told both exist so neither is treated as duplicate content.
 */
export function publicPageMetadata(
    path: string,
    lang: string | null | undefined,
    title: string | undefined,
    description: string,
): Metadata {
    const canonical = `${SITE_URL}${path}`;
    return {
        ...(title ? { title } : {}),
        description,
        alternates: {
            canonical,
            languages: {
                'nb-NO': canonical,
                en: `${canonical}?lang=en`,
                'x-default': canonical,
            },
        },
        openGraph: {
            title: title ?? 'attester.no',
            description,
            url: canonical,
            siteName: 'attester.no',
            locale: lang === 'en' ? 'en_US' : 'nb_NO',
            type: 'website',
        },
    };
}

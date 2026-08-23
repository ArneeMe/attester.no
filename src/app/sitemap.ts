import type { MetadataRoute } from 'next';
import { listPublicOrgs } from '@/lib/server/orgs';
import { SITE_URL } from '@/util/seo';

export const runtime = 'edge';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const statics: MetadataRoute.Sitemap = [
        { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
        { url: `${SITE_URL}/om`, changeFrequency: 'monthly', priority: 0.9 },
    ];

    // Org form pages are public entry points; the sitemap must still render
    // if the database is unreachable.
    let orgPages: MetadataRoute.Sitemap = [];
    try {
        orgPages = (await listPublicOrgs()).map((org) => ({
            url: `${SITE_URL}/org/${encodeURIComponent(org.slug)}`,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        }));
    } catch {
        // directory unavailable — ship the static pages
    }

    return [...statics, ...orgPages];
}

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                // Admin and API surfaces have no business in search indexes.
                // Verify pages stay crawlable-in-principle but are unlinked
                // and unguessable (the URL is the secret).
                disallow: ['/login', '/api'],
            },
        ],
    };
}

import type { NextConfig } from "next";

// Standard hardening headers applied to every response. CSP is deliberately
// omitted here — adding a strict policy without runtime testing tends to
// break pdfme's blob previews, MUI's emotion-injected styles, and the
// Nhost SDK's auth URLs in subtle ways. Add it after you've smoke-tested
// the app behind a Report-Only header in prod.
const securityHeaders = [
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    },
];

const nextConfig: NextConfig = {
    experimental: {},
    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;

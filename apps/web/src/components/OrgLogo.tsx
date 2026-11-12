'use client'
import React, { useEffect, useState } from 'react';

/**
 * The org's default logo, fetched from the public branding endpoint.
 * Renders nothing until loaded and nothing at all if the org has no
 * default logo — layout must not depend on it.
 */
const OrgLogo: React.FC<{ orgSlug: string; height?: number }> = ({ orgSlug, height = 56 }) => {
    const [logo, setLogo] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/org/${encodeURIComponent(orgSlug)}/branding`)
            .then((r) => (r.ok ? r.json() : null))
            .then((json: { logo?: string | null } | null) => {
                if (!cancelled && json?.logo) setLogo(json.logo);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [orgSlug]);

    if (!logo) return null;
    return (
        // Logos are base64 data URLs from the asset library — next/image
        // has nothing to optimize here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" style={{ height, maxWidth: '100%', objectFit: 'contain' }} />
    );
};

export default OrgLogo;

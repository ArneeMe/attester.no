import React from 'react';

/**
 * Renders schema.org structured data. The payload is always built from our
 * own dictionary strings — never from user input — so serializing it into
 * a script tag is safe.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}

-- Errors the platform itself has hit, one row per distinct error. Holds what
-- broke and where in the code. It must never hold who was affected or what
-- they sent: no request body, no path with ids, no IP, no user. The message
-- is scrubbed of quoted text, emails, ids and digit runs before it gets here
-- (apps/api/src/lib/log.ts).
CREATE TABLE IF NOT EXISTS platform_errors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint text NOT NULL UNIQUE,
    source text NOT NULL,
    place text NOT NULL,
    kind text NOT NULL,
    message text NOT NULL DEFAULT '',
    stack text NOT NULL DEFAULT '',
    request_id text,
    count int NOT NULL DEFAULT 1,
    first_seen timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS platform_errors_last_seen_idx ON platform_errors(last_seen);

-- After running: track the `platform_errors` table in Hasura.

-- Outbox for email notices to an organisation's admins. A row says that
-- something is waiting for an organisation and nothing else: no submission
-- id, no volunteer field, no recipient address. Recipients are looked up
-- from the membership table when the notice is sent.
CREATE TABLE IF NOT EXISTS notices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('submission_waiting')),
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    attempts int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS notices_unsent_idx ON notices(created_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS notices_org_idx ON notices(organization_id);

-- After running: track the `notices` table in Hasura.

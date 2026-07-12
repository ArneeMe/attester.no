-- Org invites: lets a member invite a colleague by email. The invite token
-- is a capability: whoever registers/logs in with the invited email and
-- presents the token is added to the org, so the two-step "register, then
-- ask someone to add you" dance collapses into one link.
--
-- Run in the Hasura SQL console, then track the table.

CREATE TABLE IF NOT EXISTS invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
    redeemed_at timestamptz
);
CREATE INDEX IF NOT EXISTS invites_token_idx ON invites(token);
CREATE INDEX IF NOT EXISTS invites_org_idx ON invites(organization_id);

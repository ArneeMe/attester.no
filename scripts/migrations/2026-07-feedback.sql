-- Anonymous platform feedback from volunteers, shown to the org's admins.
-- Carries NO identity by design: no user id, no submission reference, no IP.
-- The UI tells the writer not to include personal data in the comment.
--
-- Run in the Hasura SQL console, then track the table (no relationships
-- needed — the API resolves the org by slug itself).

CREATE TABLE IF NOT EXISTS feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_org_idx ON feedback(organization_id, created_at DESC);

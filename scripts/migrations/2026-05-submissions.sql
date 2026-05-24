-- PR 2: generic submissions table replacing hardcoded volunteers.
-- Run in the Hasura SQL console, then track the table and add relationships per the notes below.

-- 1. New submissions table.
CREATE TABLE submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submissions_org_idx ON submissions(organization_id);
CREATE INDEX submissions_template_idx ON submissions(template_id);

-- 2. Clarity rename. certificates.volunteer_id was a free-form string id;
--    submissions also use a uuid identifier in the URL. The column stays a string.
ALTER TABLE certificates RENAME COLUMN volunteer_id TO submission_id;

-- 3. Drop the legacy volunteers table. Anything in it is dev/test data; certs
--    that referenced its ids continue to verify via the renamed column.
DROP TABLE volunteers;

-- Hasura console steps after running the SQL above:
--   1. Data → "Untracked tables/views" → track `submissions`.
--   2. submissions → Relationships:
--        - object: organization_id → organizations.id
--        - object: template_id → templates.id
--   3. After the rename, re-track certificates so `submission_id` is visible
--      in Hasura's GraphQL schema (the old `volunteer_id` field will disappear).
--   4. Permissions: the Next.js API routes use the admin secret, so Hasura
--      role permissions aren't on the hot path. Mirror existing patterns if
--      you want to harden them.

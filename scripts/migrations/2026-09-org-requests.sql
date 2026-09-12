-- Organisations asking to be set up. The public form writes a pending row; a
-- platform admin approves or rejects it at /admin.
--
-- org_number is the Norwegian organisasjonsnummer, optional because plenty of
-- student societies and local chapters are not registered at all.
--
-- Run in the Hasura SQL console, then track the table.

CREATE TABLE IF NOT EXISTS org_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_slug text NOT NULL,
    organization_name text NOT NULL,
    org_number text,
    contact_email text NOT NULL,
    contact_name text,
    message text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    handled_at timestamptz,
    handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS org_requests_status_idx ON org_requests(status, created_at);

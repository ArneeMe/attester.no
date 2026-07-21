-- Audit: record WHICH admin issued each certificate. Explicitly allowed by
-- the privacy model (CLAUDE.md: "user X issued cert <id> at time T" with no
-- payload describing what the cert says). Nullable — legacy rows and the
-- seed scripts have no issuer.
--
-- Run in the Hasura SQL console, then re-track `certificates` so issued_by
-- shows up in the GraphQL schema.

ALTER TABLE certificates
    ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

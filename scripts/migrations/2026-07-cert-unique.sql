-- Backstop for certificate idempotency: at most ONE cert per submission
-- per org, enforced by the database instead of only by the API's
-- check-then-insert (which has a small race window under concurrent
-- clicks). The API treats a violation as "already issued" and returns
-- the existing row.
--
-- BEFORE running: check for pre-existing duplicates (possible from the
-- era before the idempotent POST). If this returns rows, keep the oldest
-- of each group and delete the rest — they carry identical hashes:
--
--   SELECT organization_id, submission_id, COUNT(*)
--   FROM certificates
--   GROUP BY organization_id, submission_id
--   HAVING COUNT(*) > 1;
--
-- Run in the Hasura SQL console. No re-tracking needed (index only).

CREATE UNIQUE INDEX IF NOT EXISTS certificates_org_submission_unique
    ON certificates(organization_id, submission_id);

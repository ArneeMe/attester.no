-- Retention model fix: the deletion clock starts at ISSUANCE, not submission.
--
-- Before this, the sweep deleted every submission 24h after it was created,
-- whether or not anyone had processed it. An org that reviews its queue
-- weekly lost applications before an admin ever saw them, and the volunteer
-- was left waiting for a certificate that had been silently deleted.
--
-- After this: `issued_at` is stamped when the certificate is inserted, the
-- sweep only deletes rows where `issued_at` is older than the window, and
-- unissued submissions wait for the admin indefinitely (cleared by the
-- explicit "Slett data" action).
--
-- Nullable with no default and no backfill — on purpose. Any submission
-- already in the table is by definition one the sweep hasn't collected, so
-- leaving `issued_at` NULL is correct: it means "not issued yet, don't
-- touch". Backfilling created_at here would immediately delete every
-- pre-existing row, which is exactly the bug being fixed.
--
-- Run in the Hasura SQL console, then re-track `submissions` so issued_at
-- appears in the GraphQL schema (the sweep and the dashboard both query it).

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS issued_at timestamptz;

-- Partial index: the sweep only ever scans issued rows.
CREATE INDEX IF NOT EXISTS submissions_issued_at_idx
    ON submissions(issued_at)
    WHERE issued_at IS NOT NULL;

-- Lets a volunteer follow their own request and nudge the organisation, with
-- a secret link and no account. Only the hash of the secret is stored, so a
-- copy of the database can neither look a request up nor send a reminder.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS status_token_hash text;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reminded_at timestamptz;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reminder_count int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS submissions_status_token_idx
    ON submissions(status_token_hash)
    WHERE status_token_hash IS NOT NULL;

-- After running: reload the `submissions` table's columns in Hasura.

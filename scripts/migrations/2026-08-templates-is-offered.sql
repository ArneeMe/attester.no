-- Replaces templates.is_default with templates.is_offered, the marker for
-- "this template is on the public form's menu".
--
-- Re-runnable. Run in the Hasura SQL console, then re-track `templates`.
--
-- Step 3 fails with a metadata error if run as plain SQL, because Hasura
-- tracks the column. Either tick "Cascade metadata" in the SQL runner, or
-- remove the column from Data -> templates -> Modify, which handles the
-- metadata itself.
--
-- NOTE: org_assets.is_default is a DIFFERENT column, for signatures, logos and
-- text blocks. It is still in use. Do not touch it.

-- 1. New column.
ALTER TABLE templates
    ADD COLUMN IF NOT EXISTS is_offered boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS templates_offered_idx
    ON templates(organization_id)
    WHERE is_offered;

-- 2. Carry the old default over, or every existing org's public form finds
--    nothing to offer. Guarded so this file survives a re-run after step 3.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'templates' AND column_name = 'is_default'
    ) THEN
        UPDATE templates SET is_offered = true WHERE is_default = true;
    END IF;
END $$;

-- 3. Drop the old column. Nothing reads it any more.
ALTER TABLE templates DROP COLUMN IF EXISTS is_default;

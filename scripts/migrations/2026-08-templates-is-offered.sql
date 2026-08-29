-- Replaces templates.is_default with templates.is_offered.
--
-- Run the whole file in order, then re-track `templates` in Hasura so the
-- schema change reaches GraphQL. Step 3 is destructive and irreversible.
--
-- NOTE: org_assets.is_default is a DIFFERENT column for signatures, logos and
-- text blocks. It is still in use. Do not touch it.

-- 1. New column.
ALTER TABLE templates
    ADD COLUMN IF NOT EXISTS is_offered boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS templates_offered_idx
    ON templates(organization_id)
    WHERE is_offered;

-- 2. Carry the old default over, or every existing org's public form would
--    find nothing to offer. Must run before step 3. Guarded so the file stays
--    re-runnable after step 3 has already dropped the column.
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

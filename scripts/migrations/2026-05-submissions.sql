-- PR 2 (revised): create submissions, backfill from any existing volunteers,
-- rename certificates.volunteer_id → submission_id.
--
-- Safe to run on a DB where:
--   - volunteers exists with legit rows (gets backfilled into submissions),
--   - volunteers exists empty (no-op),
--   - submissions already exists (no-op for the table create; backfill
--     skips rows already present),
--   - the rename was already done previously (no-op).
--
-- The volunteers table is NOT auto-dropped. Once you've verified the app
-- works end-to-end against submissions, drop it manually:
--   DROP TABLE volunteers;

-- 1. New submissions table.
CREATE TABLE IF NOT EXISTS submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS submissions_org_idx ON submissions(organization_id);
CREATE INDEX IF NOT EXISTS submissions_template_idx ON submissions(template_id);

-- 2. Heads-up: any volunteer whose org has no template will be skipped by
--    the backfill (submissions.template_id is NOT NULL). Look at the
--    NOTICE/WARNING output to know if anything was dropped on the floor.
DO $$
DECLARE
    skipped int;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'volunteers') THEN
        RAISE NOTICE 'volunteers table does not exist — nothing to backfill, fresh install.';
    ELSE
        SELECT COUNT(*) INTO skipped
        FROM volunteers v
        WHERE NOT EXISTS (SELECT 1 FROM templates t WHERE t.organization_id = v.organization_id);
        IF skipped > 0 THEN
            RAISE WARNING '% volunteer(s) will be skipped — their org has no template. Seed a template for those orgs first if you need them backfilled.', skipped;
        END IF;
    END IF;
END$$;

-- 3. Backfill volunteers → submissions, preserving volunteer.id as
--    submissions.id so certificates.submission_id keeps matching.
--    Maps the old fixed shape into the VOLUNTEER_FORM_SCHEMA keys
--    (name, group, start, end, role, group1..3, start1..3, end1..3, role1..3).
--    jsonb_strip_nulls drops missing extra-role fields so the resulting
--    data payload matches what the new form would have produced.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'volunteers') THEN
        INSERT INTO submissions (id, organization_id, template_id, data, created_at)
        SELECT
            v.id,
            v.organization_id,
            (SELECT t.id FROM templates t
             WHERE t.organization_id = v.organization_id
             ORDER BY t.is_default DESC, t.created_at ASC
             LIMIT 1),
            jsonb_strip_nulls(jsonb_build_object(
                'name',   v.person_name,
                'group',  v.group_name,
                'start',  v.start_date,
                'end',    v.end_date,
                'role',   v.role,
                'group1', v.extra_roles->0->>'groupName',
                'start1', v.extra_roles->0->>'startDate',
                'end1',   v.extra_roles->0->>'endDate',
                'role1',  v.extra_roles->0->>'role',
                'group2', v.extra_roles->1->>'groupName',
                'start2', v.extra_roles->1->>'startDate',
                'end2',   v.extra_roles->1->>'endDate',
                'role2',  v.extra_roles->1->>'role',
                'group3', v.extra_roles->2->>'groupName',
                'start3', v.extra_roles->2->>'startDate',
                'end3',   v.extra_roles->2->>'endDate',
                'role3',  v.extra_roles->2->>'role'
            )),
            v.created_at
        FROM volunteers v
        WHERE NOT EXISTS (SELECT 1 FROM submissions s WHERE s.id = v.id)
          AND EXISTS (SELECT 1 FROM templates t WHERE t.organization_id = v.organization_id);
    END IF;
END$$;

-- 4. Rename certificates.volunteer_id → submission_id (idempotent).
--    The column was a free-form string id; submissions ids are uuids
--    stored here as strings, so the column type stays as is.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'certificates' AND column_name = 'volunteer_id') THEN
        ALTER TABLE certificates RENAME COLUMN volunteer_id TO submission_id;
    END IF;
END$$;

-- Hasura console steps:
--   1. Data → "Untracked tables/views" → track `submissions`.
--   2. submissions → Relationships:
--        - object: organization_id → organizations.id
--        - object: template_id → templates.id
--   3. Re-track `certificates` so `submission_id` shows in the GraphQL schema
--      (`volunteer_id` will disappear).
--
-- After verifying the app works end-to-end and every legit volunteer
-- landed in submissions:
--   DROP TABLE volunteers;

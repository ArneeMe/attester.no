-- PR 3: org_assets table generalizes the per-org content library.
-- Replaces the echo-specific columns (signatures, groups, generic_text) with a
-- single table holding signatures, logos, body-text blocks, and lookup-lists.
-- Templates gain a field_bindings column that maps pdfme field names to either
-- submission data, system values, or rows in this asset library.
--
-- Run in the Hasura SQL console, then track the new table and column.

-- 1. The asset library. One row per asset; `kind` discriminates.
--    Content shapes per kind (kept loose by jsonb for forward compatibility):
--      signature    { photo, role, phone }        -- asset.name is the person's name
--      logo         { image }                     -- asset.name is a human label
--      body_text    { text }                      -- asset.name is the block title
--      lookup_list  { items: [{ name, ... }] }    -- asset.name is the list name
CREATE TABLE org_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('signature', 'logo', 'body_text', 'lookup_list')),
    name text NOT NULL,
    content jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_default boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX org_assets_org_idx ON org_assets(organization_id);
CREATE INDEX org_assets_kind_idx ON org_assets(organization_id, kind);

-- 2. Per-template binding from pdfme field name → data source.
--    See src/types/fieldBindings.ts for the union shape.
--    `{}` means: fall back to submission.data[<field name>] for every field.
ALTER TABLE templates ADD COLUMN field_bindings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Migrate echo signatures jsonb array → individual org_assets rows.
INSERT INTO org_assets (organization_id, kind, name, content, is_default, sort_order)
SELECT
    o.id,
    'signature',
    COALESCE(s.value->>'name', 'Signatur ' || s.ordinality::text),
    jsonb_build_object(
        'photo', COALESCE(s.value->>'photo', ''),
        'role',  COALESCE(s.value->>'role',  ''),
        'phone', COALESCE(s.value->>'phone', '')
    ),
    true,
    s.ordinality::int - 1
FROM organizations o
CROSS JOIN LATERAL jsonb_array_elements(o.signatures) WITH ORDINALITY AS s(value, ordinality)
WHERE o.signatures IS NOT NULL AND jsonb_array_length(o.signatures) > 0;

-- 4. Migrate echo generic_text → one body_text asset per org that has any.
INSERT INTO org_assets (organization_id, kind, name, content, is_default)
SELECT o.id, 'body_text', 'Generell tekst', jsonb_build_object('text', o.generic_text), true
FROM organizations o
WHERE o.generic_text IS NOT NULL AND o.generic_text <> '';

-- 5. Migrate echo groups dict → one lookup_list asset per org that has any.
INSERT INTO org_assets (organization_id, kind, name, content, is_default)
SELECT
    o.id,
    'lookup_list',
    'Undergrupper',
    jsonb_build_object('items', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('name', key, 'description', value)), '[]'::jsonb)
        FROM jsonb_each_text(o.groups)
    )),
    true
FROM organizations o
WHERE o.groups IS NOT NULL AND o.groups <> '{}'::jsonb;

-- 6. Populate echo's existing template field_bindings so the old PDF keeps
--    rendering identically through the new generic resolver.
UPDATE templates t
SET field_bindings = jsonb_build_object(
    'signature_date',     jsonb_build_object('source', 'system', 'system', 'today'),
    'qr_code',            jsonb_build_object('source', 'system', 'system', 'qr_code'),
    'qr_page',            jsonb_build_object('source', 'system', 'system', 'qr_page'),
    'qr_info',            jsonb_build_object('source', 'composite', 'template', 'Scan for å verifisere'),
    'student_name_date',  jsonb_build_object('source', 'composite', 'template', 'Attest til {name}'),
    'student_role',       jsonb_build_object('source', 'composite',
                              'template', '{name} har vært {role} i {group} fra {start:date} til {end:date}',
                              'requireAll', jsonb_build_array('name', 'role', 'group', 'start', 'end')),
    'verv_1',             jsonb_build_object('source', 'composite',
                              'template', '{name} har og hatt en stilling som {role1} i {group1} fra {start1:date} til {end1:date}',
                              'requireAll', jsonb_build_array('name', 'role1', 'group1', 'start1', 'end1')),
    'verv_2',             jsonb_build_object('source', 'composite',
                              'template', '{name} har og hatt en stilling som {role2} i {group2} fra {start2:date} til {end2:date}',
                              'requireAll', jsonb_build_array('name', 'role2', 'group2', 'start2', 'end2')),
    'verv_3',             jsonb_build_object('source', 'composite',
                              'template', '{name} har og hatt en stilling som {role3} i {group3} fra {start3:date} til {end3:date}',
                              'requireAll', jsonb_build_array('name', 'role3', 'group3', 'start3', 'end3')),
    'group_info',         jsonb_build_object('source', 'lookup',
                              'assetId', (SELECT id::text FROM org_assets
                                          WHERE organization_id = t.organization_id
                                            AND kind = 'lookup_list'
                                            AND name = 'Undergrupper'
                                          LIMIT 1),
                              'byKey', 'group', 'subField', 'description'),
    'echo_info',          jsonb_build_object('source', 'asset_default', 'kind', 'body_text', 'subField', 'text'),
    'signature_photo_1',  jsonb_build_object('source', 'asset_default', 'kind', 'signature', 'position', 0, 'subField', 'photo'),
    'signature_name_1',   jsonb_build_object('source', 'asset_default', 'kind', 'signature', 'position', 0, 'subField', 'name'),
    'signature_role_1',   jsonb_build_object('source', 'asset_default', 'kind', 'signature', 'position', 0, 'subField', 'role'),
    'signature_phone_1',  jsonb_build_object('source', 'asset_default', 'kind', 'signature', 'position', 0, 'subField', 'phone'),
    'signature_photo_2',  jsonb_build_object('source', 'asset_default', 'kind', 'signature', 'position', 1, 'subField', 'photo'),
    'signature_name_2',   jsonb_build_object('source', 'asset_default', 'kind', 'signature', 'position', 1, 'subField', 'name'),
    'signature_role_2',   jsonb_build_object('source', 'asset_default', 'kind', 'signature', 'position', 1, 'subField', 'role'),
    'signature_phone_2',  jsonb_build_object('source', 'asset_default', 'kind', 'signature', 'position', 1, 'subField', 'phone')
)
FROM organizations o
WHERE t.organization_id = o.id AND o.slug = 'echo';

-- 7. Promote echo's `group` form field from free text to a dropdown sourced
--    from the Undergrupper lookup-list, so volontøren picks from the known
--    set instead of free-typing (and the lookup binding actually matches).
UPDATE templates t
SET form_schema = (
    SELECT jsonb_agg(
        CASE
            WHEN elem->>'key' = 'group' AND (elem->>'optional')::boolean IS NOT TRUE
                THEN jsonb_build_object(
                    'key', 'group',
                    'label', 'Gruppe',
                    'type', 'dropdown',
                    'optionsFromAsset', (
                        SELECT id::text FROM org_assets
                        WHERE organization_id = t.organization_id
                          AND kind = 'lookup_list'
                          AND name = 'Undergrupper'
                        LIMIT 1
                    )
                )
            ELSE elem
        END
    )
    FROM jsonb_array_elements(t.form_schema) AS elem
)
FROM organizations o
WHERE t.organization_id = o.id AND o.slug = 'echo' AND t.form_schema IS NOT NULL;

-- 8. Drop the legacy columns. From now on, all per-org content lives in org_assets.
ALTER TABLE organizations DROP COLUMN signatures;
ALTER TABLE organizations DROP COLUMN groups;
ALTER TABLE organizations DROP COLUMN generic_text;

-- Hasura console steps after running the SQL above:
--   1. Data → "Untracked tables/views" → track `org_assets`.
--   2. org_assets → Relationships: object: organization_id → organizations.id.
--   3. Re-track `templates` so `field_bindings` shows up in the GraphQL schema.
--   4. Re-track `organizations` to drop the removed columns from the schema.
--   5. Permissions: same as elsewhere, the Next.js API routes use the admin
--      secret. Mirror existing patterns if/when hardening roles.

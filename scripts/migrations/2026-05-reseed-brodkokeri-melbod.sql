-- Reset brodkokeri + melbod and re-seed each with a working template + a
-- handful of pending submissions ready for "Generer PDF".
--
-- WARNING: wipes ALL certificates, submissions, templates, and org_assets
-- for these two orgs. The organizations rows themselves and any
-- user_organizations memberships are preserved.
--
-- The seeded template is the "Rolleattest" starter shape — its pdfme field
-- names (signature_photo_1, qr_code, …) are wired through field_bindings to
-- the form's submission keys (name/role/start/end), so PDFs render with
-- real data instead of blank.
--
-- A placeholder body_text asset, a placeholder signature asset, and a
-- subgroup lookup_list (Undergrupper) are inserted per org. The form's
-- `group` field is a dropdown sourced from the lookup_list so volunteers
-- pick from canonical names instead of free-typing. The signature image
-- is a small inlined PNG (stylized scribble) — swap in a real one via
-- Innhold afterwards.
--
-- Also runs an idempotent NOT-EXISTS insert for echo's Undergrupper list
-- (in case the org_assets migration step 5 was missed), without touching
-- any of echo's real data.
--
-- After running, click "Generer PDF" on each submission in the admin UI to
-- mint the cert hash + download the PDF.
--
-- Run in the Hasura SQL console. Idempotent: re-running re-seeds.

DO $reseed$
DECLARE
    target_slugs text[] := ARRAY['brodkokeri', 'melbod'];
    target_slug text;
    org_id uuid;
    tmpl_id uuid;
    blank_pdf text := 'data:application/pdf;base64,JVBERi0xLjcKJeLjz9MKNSAwIG9iago8PAovRmlsdGVyIC9GbGF0ZURlY29kZQovTGVuZ3RoIDM4Cj4+CnN0cmVhbQp4nCvkMlAwUDC1NNUzMVGwMDHUszRSKErlCtfiyuMK5AIAXQ8GCgplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL01lZGlhQm94IFswIDAgNTk1LjQ0IDg0MS45Ml0KL1Jlc291cmNlcyA8PAo+PgovQ29udGVudHMgNSAwIFIKL1BhcmVudCAyIDAgUgo+PgplbmRvYmoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWzQgMCBSXQovQ291bnQgMQo+PgplbmRvYmoKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL3RyYXBwZWQgKGZhbHNlKQovQ3JlYXRvciAoU2VyaWYgQWZmaW5pdHkgRGVzaWduZXIgMS4xMC40KQovVGl0bGUgKFVudGl0bGVkLnBkZikKL0NyZWF0aW9uRGF0ZSAoRDoyMDIyMDEwNjE0MDg1OCswOScwMCcpCi9Qcm9kdWNlciAoaUxvdmVQREYpCi9Nb2REYXRlIChEOjIwMjIwMTA2MDUwOTA5WikKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL1NpemUgNwovUm9vdCAxIDAgUgovSW5mbyAzIDAgUgovSUQgWzwyODhCM0VENTAyOEU0MDcyNERBNzNCOUE0Nzk4OUEwQT4gPEY1RkJGNjg4NkVERDZBQUNBNDRCNEZDRjBBRDUxRDlDPl0KL1R5cGUgL1hSZWYKL1cgWzEgMiAyXQovRmlsdGVyIC9GbGF0ZURlY29kZQovSW5kZXggWzAgN10KL0xlbmd0aCAzNgo+PgpzdHJlYW0KeJxjYGD4/5+RUZmBgZHhFZBgDAGxakAEP5BgEmFgAABlRwQJCmVuZHN0cmVhbQplbmRvYmoKc3RhcnR4cmVmCjUzMgolJUVPRgo=';

    placeholder_signature text := 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAAA8CAYAAABYfzddAAACaklEQVR42u3dQVLEMAxEUU7Cmbj/ZaDYU4M9sWO18n4V2yGtqGXZiZ2PDwAAAAAAAAAAAAAAAAAAAADAMj4/v75//2gDQhO8Y6J31qaY4s8k7xTgztrSTKGY3pTgXYLbWdtfGhVTBm4V3FRdo9eapK1znpVKlC6BTdU2mtxpZmDgG+dOnQycpG00wV+Zobq2mULF5BfatOTApWobMeYrw1bXNdNtGKnfDGraSPVO1U418H9JnWbgdzRz7sTNrhi0mdEpVdeVuWNVbasKF+dO3OSRka7qKLUqBtXazLTi9O5qOgMvNnCFoK680RUTfVT31REvJdcsaC1I3EQD74pFhSRP0jVbTDovrC5P9FOmWZ3oV64jzcBP11Wtu4gwcJVReGTut2rhqPIolZTouwzc2sS7zPbfs8fdQd31P06/sbVbVyfzMnBwUHf9/unugoG10ceTcXey3PX7pwycGrdTU5O2o/BJYR0KhMKXUfhaGvj0gkx6y9TZwLvXDrp1Lo8bfe+Yp56K4W4TnCjsV42W8FSCgYtcA131RkoGbiqm64P7FS/AnJzu3P1iT3rH91gDzwY1aTfUzLWkvkOesNYyek+iRuj03ScMnDMKV7wn0Rsf0raPJe9tTd8ad3VraNL+cAbe3Nokni6x0sBVTcDAD26fRyt98gbu0e6i8tzxSudU9boZeHNFnzmkLTXR0x9tpGqLPrkj7YjUFcfGVO8uuhk4/dxpR/QsDGiHKvqkw/CTOgsGPtzapAT2iZ+jYWAGbv3FQx+EQ2sTP727oA3QXdAG6C7mTOxOAwAAAAAAAAAAAAAAAAAAAEA2P/o0QGrW3gcmAAAAAElFTkSuQmCC';

    -- Rolleattest starter shape. Coords in mm on A4 (210 × 297).
    schemas_json jsonb := '[[
        {"name":"title","type":"text","content":"Attest","position":{"x":20,"y":30},"width":170,"height":14,"rotate":0,"alignment":"center","verticalAlignment":"top","fontSize":28,"lineHeight":1.3,"characterSpacing":0},
        {"name":"recipient","type":"text","content":"{name}","position":{"x":20,"y":65},"width":170,"height":12,"rotate":0,"alignment":"center","verticalAlignment":"top","fontSize":20,"lineHeight":1.3,"characterSpacing":0},
        {"name":"body","type":"text","content":"har hatt vervet {role} fra {start:date} til {end:date}.","position":{"x":20,"y":100},"width":170,"height":20,"rotate":0,"alignment":"center","verticalAlignment":"top","fontSize":13,"lineHeight":1.5,"characterSpacing":0},
        {"name":"org_text","type":"text","content":"","position":{"x":20,"y":140},"width":170,"height":50,"rotate":0,"alignment":"left","verticalAlignment":"top","fontSize":11,"lineHeight":1.4,"characterSpacing":0},
        {"name":"signature_photo_1","type":"image","content":"","position":{"x":25,"y":215},"width":50,"height":22,"rotate":0},
        {"name":"signature_name_1","type":"text","content":"","position":{"x":25,"y":240},"width":70,"height":5,"rotate":0,"alignment":"left","verticalAlignment":"top","fontSize":10,"lineHeight":1.3,"characterSpacing":0},
        {"name":"signature_role_1","type":"text","content":"","position":{"x":25,"y":246},"width":70,"height":4,"rotate":0,"alignment":"left","verticalAlignment":"top","fontSize":8,"lineHeight":1.3,"characterSpacing":0},
        {"name":"signature_photo_2","type":"image","content":"","position":{"x":95,"y":215},"width":50,"height":22,"rotate":0},
        {"name":"signature_name_2","type":"text","content":"","position":{"x":95,"y":240},"width":70,"height":5,"rotate":0,"alignment":"left","verticalAlignment":"top","fontSize":10,"lineHeight":1.3,"characterSpacing":0},
        {"name":"signature_role_2","type":"text","content":"","position":{"x":95,"y":246},"width":70,"height":4,"rotate":0,"alignment":"left","verticalAlignment":"top","fontSize":8,"lineHeight":1.3,"characterSpacing":0},
        {"name":"qr_code","type":"qrcode","content":"https://attester.no","position":{"x":160,"y":220},"width":28,"height":28,"rotate":0},
        {"name":"brand","type":"text","content":"attester.no","position":{"x":20,"y":275},"width":170,"height":6,"rotate":0,"alignment":"center","verticalAlignment":"top","fontSize":9,"lineHeight":1.3,"characterSpacing":0}
    ]]'::jsonb;

    field_bindings_json jsonb := '{
        "title":             {"source":"composite","template":"Attest"},
        "recipient":         {"source":"composite","template":"{name}"},
        "body":              {"source":"composite","template":"{name} har hatt vervet {role} i {group} fra {start:date} til {end:date}.","requireAll":["name","role","group","start","end"]},
        "org_text":          {"source":"asset_default","kind":"body_text","subField":"text"},
        "signature_photo_1": {"source":"asset_default","kind":"signature","position":0,"subField":"photo"},
        "signature_name_1":  {"source":"asset_default","kind":"signature","position":0,"subField":"name"},
        "signature_role_1":  {"source":"asset_default","kind":"signature","position":0,"subField":"role"},
        "signature_photo_2": {"source":"asset_default","kind":"signature","position":1,"subField":"photo"},
        "signature_name_2":  {"source":"asset_default","kind":"signature","position":1,"subField":"name"},
        "signature_role_2":  {"source":"asset_default","kind":"signature","position":1,"subField":"role"},
        "qr_code":           {"source":"system","system":"qr_code"}
    }'::jsonb;

    -- Subgroups per org. Stored as a lookup_list asset (`Undergrupper`) so
    -- the public form can render them as a dropdown — keeps the values
    -- canonical (no "Webkom" vs "Webcom" typo drift). The volunteer picks
    -- one; the {group} placeholder in the body binding resolves to it.
    groups_by_slug jsonb := '{
        "brodkokeri": {
            "items": [
                {"name":"Surdeigsgruppa",   "description":"Lager surdeigsbrød"},
                {"name":"Loffgruppa",        "description":"Hvitt brød og loff"},
                {"name":"Kakekomiteen",      "description":"Kaker og søtsaker"},
                {"name":"Rugbrødslauget",    "description":"Rugbrød og grovbrød"},
                {"name":"Hovedstyret",       "description":"Styret for Brødkokeriet"}
            ]
        },
        "melbod": {
            "items": [
                {"name":"Mølleriet",         "description":"Mølle- og kornarbeid"},
                {"name":"Bakekomiteen",      "description":"Daglig baking"},
                {"name":"Frokostvakta",      "description":"Morgenvakt og frokost"},
                {"name":"Innkjøp",           "description":"Innkjøp av mel og råvarer"},
                {"name":"Hovedstyret",       "description":"Styret for Melboden"}
            ]
        }
    }'::jsonb;

    submissions_by_slug jsonb := '{
        "brodkokeri": [
            {"name":"[TEST] Ola Nordmann",    "role":"Leder",        "group":"Surdeigsgruppa",  "start":"2022-08-01","end":"2023-05-31"},
            {"name":"[TEST] Kari Hansen",     "role":"Nestleder",    "group":"Kakekomiteen",    "start":"2022-09-15","end":"2023-06-30"},
            {"name":"[TEST] Per Olsen",       "role":"Kasserer",     "group":"Rugbrødslauget",  "start":"2023-01-10","end":"2023-12-20"},
            {"name":"[TEST] Liv Berg",        "role":"Webansvarlig", "group":"Hovedstyret",     "start":"2023-02-01","end":"2024-01-31"},
            {"name":"[TEST] Sondre Pedersen", "role":"PR-ansvarlig", "group":"Loffgruppa",      "start":"2023-03-15","end":"2024-02-28"}
        ],
        "melbod": [
            {"name":"[TEST] Henrik Hansen",   "role":"Brygger",      "group":"Mølleriet",       "start":"2022-03-01","end":"2023-02-28"},
            {"name":"[TEST] Anne Larsen",     "role":"Leder",        "group":"Hovedstyret",     "start":"2023-01-15","end":"2023-12-15"},
            {"name":"[TEST] Erik Andersen",   "role":"Smaksdommer",  "group":"Bakekomiteen",    "start":"2022-06-01","end":"2023-05-31"},
            {"name":"[TEST] Maria Johansen",  "role":"PR-ansvarlig", "group":"Frokostvakta",    "start":"2023-04-01","end":"2024-03-31"},
            {"name":"[TEST] Astrid Eriksen",  "role":"Nestleder",    "group":"Innkjøp",         "start":"2023-05-10","end":"2024-04-30"}
        ]
    }'::jsonb;

    lookup_id uuid;
    form_schema_json jsonb;
    sub jsonb;
BEGIN
    FOREACH target_slug IN ARRAY target_slugs LOOP
        SELECT id INTO org_id FROM organizations WHERE slug = target_slug;
        IF org_id IS NULL THEN
            RAISE NOTICE 'org "%": not found, skipping', target_slug;
            CONTINUE;
        END IF;

        -- Wipe in FK-dependency order. certificates → submissions →
        -- templates → org_assets. (templates.id is referenced by submissions
        -- via ON DELETE RESTRICT, so submissions must go first.)
        DELETE FROM certificates WHERE organization_id = org_id;
        DELETE FROM submissions  WHERE organization_id = org_id;
        DELETE FROM templates    WHERE organization_id = org_id;
        DELETE FROM org_assets   WHERE organization_id = org_id;

        -- Subgroup lookup list first — the template's form_schema references
        -- its id so the public form can render groups as a dropdown.
        INSERT INTO org_assets (organization_id, kind, name, content, is_default, sort_order)
        VALUES (
            org_id,
            'lookup_list',
            'Undergrupper',
            groups_by_slug->target_slug,
            true,
            0
        ) RETURNING id INTO lookup_id;

        -- Form schema with `group` as a dropdown sourced from the list above.
        form_schema_json := jsonb_build_array(
            jsonb_build_object('key','name', 'label','Navn',         'type','text'),
            jsonb_build_object('key','role', 'label','Rolle / verv', 'type','text'),
            jsonb_build_object('key','group','label','Gruppe',       'type','dropdown',
                               'optionsFromAsset', lookup_id::text),
            jsonb_build_object('key','start','label','Startdato',    'type','date'),
            jsonb_build_object('key','end',  'label','Sluttdato',    'type','date')
        );

        -- Fresh default template.
        INSERT INTO templates (
            organization_id, name, description, base_pdf,
            schemas, form_schema, field_bindings, is_default
        ) VALUES (
            org_id,
            initcap(target_slug) || ' attest',
            'Auto-seeded rolleattest. Bytt ut maldesignet via PDF-mal.',
            blank_pdf,
            schemas_json,
            form_schema_json,
            field_bindings_json,
            true
        ) RETURNING id INTO tmpl_id;

        -- Placeholder body_text so the `org_text` binding renders something.
        INSERT INTO org_assets (organization_id, kind, name, content, is_default, sort_order)
        VALUES (
            org_id,
            'body_text',
            'Generell tekst',
            jsonb_build_object(
                'text',
                'Attesten er utstedt av ' || initcap(target_slug) ||
                '. Skann QR-koden for å verifisere ektheten.'
            ),
            true,
            0
        );

        -- Placeholder signature asset so the `signature_*` bindings render
        -- something on the PDF. The photo is a small inlined PNG (stylized
        -- scribble). Swap it in Innhold for a real signature image.
        INSERT INTO org_assets (organization_id, kind, name, content, is_default, sort_order)
        VALUES (
            org_id,
            'signature',
            'Test signatur',
            jsonb_build_object(
                'photo', placeholder_signature,
                'role',  'Leder',
                'phone', ''
            ),
            true,
            0
        );

        -- Sample submissions.
        FOR sub IN SELECT * FROM jsonb_array_elements(submissions_by_slug->target_slug) LOOP
            INSERT INTO submissions (organization_id, template_id, data)
            VALUES (org_id, tmpl_id, sub);
        END LOOP;

        RAISE NOTICE 'org "%": reseeded — template % + 5 submissions', target_slug, tmpl_id;
    END LOOP;
END$reseed$;

-- Echo's Undergrupper list is set up by 2026-05-org-assets.sql (step 5).
-- If it's somehow missing (migration not yet run, manually deleted, etc.),
-- create it with the canonical echo subgroups. Idempotent: NOT-EXISTS gate
-- means re-running this block doesn't touch echo's real data.
INSERT INTO org_assets (organization_id, kind, name, content, is_default, sort_order)
SELECT
    o.id,
    'lookup_list',
    'Undergrupper',
    '{
        "items": [
            {"name":"Webkom",         "description":"Webgruppa"},
            {"name":"Bedkom",         "description":"Bedriftskontakten"},
            {"name":"Hovedstyret",    "description":"Hovedstyret"},
            {"name":"Sosialkom",      "description":"Sosialkomiteen"},
            {"name":"Bokkom",         "description":"Bokkomiteen"},
            {"name":"Tilflyttingskom","description":"Tilflytterkomiteen"}
        ]
    }'::jsonb,
    true,
    0
FROM organizations o
WHERE o.slug = 'echo'
  AND NOT EXISTS (
      SELECT 1 FROM org_assets a
      WHERE a.organization_id = o.id
        AND a.kind = 'lookup_list'
        AND a.name = 'Undergrupper'
  );

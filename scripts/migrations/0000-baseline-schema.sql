-- Baseline schema for a FRESH install of attester.no.
--
-- The core tables (organizations, user_organizations, templates,
-- certificates, legacy_certificates) predate the committed migrations and
-- only existed in the live Nhost project; this file reconstructs them from
-- the code's GraphQL usage so the whole schema is reproducible from the
-- repo. Everything is IF NOT EXISTS, so running it against the existing
-- production database is a no-op.
--
-- Fresh install: run ONLY this file, then do the Hasura console steps at
-- the bottom. The 2026-05-* files are historical migrations of the echo
-- single-org database and are not needed on a fresh install (this file
-- already includes their end state: org_assets, submissions,
-- templates.field_bindings, certificates.submission_id).

-- Identity only. All per-org content lives in org_assets; do NOT add
-- content columns here (see CLAUDE.md, "Org assets are the per-org
-- content library").
CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Membership: which Nhost auth users administer which org. user_id points
-- at Nhost's auth.users; the role column exists for future differentiation
-- but every member is treated as admin today.
CREATE TABLE IF NOT EXISTS user_organizations (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'admin',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, organization_id)
);

-- Immutable PDF templates. Editing a template inserts a new row; certs
-- reference the exact row they were rendered with (see CLAUDE.md).
CREATE TABLE IF NOT EXISTS templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    base_pdf text NOT NULL,
    schemas jsonb NOT NULL DEFAULT '[]'::jsonb,
    form_schema jsonb,
    field_bindings jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_org_idx ON templates(organization_id);

-- Per-org content library. Content shapes per kind:
--   signature    { photo, role, phone }        -- name = the person's name
--   logo         { image }                     -- name = a human label
--   body_text    { text }                      -- name = the block title
--   lookup_list  { items: [{ name, ... }] }    -- name = the list name
CREATE TABLE IF NOT EXISTS org_assets (
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
CREATE INDEX IF NOT EXISTS org_assets_org_idx ON org_assets(organization_id);
CREATE INDEX IF NOT EXISTS org_assets_kind_idx ON org_assets(organization_id, kind);

-- Volunteer form submissions. Deleted automatically in the same
-- transaction that inserts the certificate — rows here are transient
-- review-queue state, never long-term storage.
CREATE TABLE IF NOT EXISTS submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS submissions_org_idx ON submissions(organization_id);
CREATE INDEX IF NOT EXISTS submissions_template_idx ON submissions(template_id);

-- The hash IS the certificate: no volunteer fields, ever (see CLAUDE.md).
-- submission_id is the opaque lookup key embedded in the QR URL's `id`
-- param (a submissions uuid stored as text; the submission row itself is
-- deleted at issuance). template_id is SET NULL on template deletion —
-- the hash keeps verifying regardless of presentation.
CREATE TABLE IF NOT EXISTS certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    submission_id text NOT NULL,
    hash text NOT NULL,
    template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
    issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS certificates_lookup_idx ON certificates(organization_id, submission_id);

-- One-time snapshot of echo's pre-migration certs. The app NEVER inserts
-- here; the legacy /verify route reads it until ~2030 (see CLAUDE.md).
CREATE TABLE IF NOT EXISTS legacy_certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id text NOT NULL,
    hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS legacy_certificates_volunteer_idx ON legacy_certificates(volunteer_id);

-- Anonymous platform feedback from volunteers, shown to the org's admins.
-- Carries NO identity by design: no user id, no submission reference.
CREATE TABLE IF NOT EXISTS feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_org_idx ON feedback(organization_id, created_at DESC);

-- Org invites: token is a capability that, combined with logging in as the
-- invited email, grants membership in the org. See the invites API routes.
CREATE TABLE IF NOT EXISTS invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
    redeemed_at timestamptz
);
CREATE INDEX IF NOT EXISTS invites_token_idx ON invites(token);
CREATE INDEX IF NOT EXISTS invites_org_idx ON invites(organization_id);

-- Hasura console steps (fresh install):
--   1. Data → "Untracked tables/views" → track every table above.
--   2. Relationships: object relationships on each organization_id /
--      template_id column, mirroring the tracked FKs.
--   3. No role permissions needed — the Next.js API routes talk to Hasura
--      with the admin secret and enforce tenancy in code
--      (src/lib/server/apiAuth.ts).
--   4. Create the first org + member by hand until the onboarding UI
--      exists:
--        INSERT INTO organizations (slug, name) VALUES ('myorg', 'My Org');
--        INSERT INTO user_organizations (user_id, organization_id)
--        SELECT u.id, o.id FROM auth.users u, organizations o
--        WHERE u.email = 'admin@example.org' AND o.slug = 'myorg';

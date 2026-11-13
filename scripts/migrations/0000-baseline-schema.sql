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
    is_offered boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_org_idx ON templates(organization_id);
CREATE INDEX IF NOT EXISTS templates_offered_idx
    ON templates(organization_id)
    WHERE is_offered;

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

-- Volunteer form submissions — the review queue, not long-term storage.
--
-- issued_at is stamped when the certificate is inserted, and it is the
-- deletion clock: the sweep removes rows whose issued_at is older than the
-- regeneration window (packages/shared/src/retention.ts). NULL means "not issued yet",
-- and those rows are never swept — they wait for an admin, who clears them
-- with the explicit "Slett data" action. See CLAUDE.md "Volunteer deletion".
CREATE TABLE IF NOT EXISTS submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    issued_at timestamptz
);
CREATE INDEX IF NOT EXISTS submissions_org_idx ON submissions(organization_id);
CREATE INDEX IF NOT EXISTS submissions_template_idx ON submissions(template_id);
CREATE INDEX IF NOT EXISTS submissions_issued_at_idx
    ON submissions(issued_at)
    WHERE issued_at IS NOT NULL;

-- The hash IS the certificate: no volunteer fields, ever (see CLAUDE.md).
-- submission_id is the opaque lookup key embedded in the QR URL's `id`
-- param (a submissions uuid stored as text; the submission row outlives
-- issuance by the regeneration window, then the sweep removes it).
-- template_id is SET NULL on template deletion —
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
CREATE UNIQUE INDEX IF NOT EXISTS certificates_org_submission_unique
    ON certificates(organization_id, submission_id);

-- One-time snapshot of echo's pre-migration certs. The app NEVER inserts
-- here; the legacy /verify route reads it until ~2030 (see CLAUDE.md).
CREATE TABLE IF NOT EXISTS legacy_certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id text NOT NULL,
    hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS legacy_certificates_volunteer_idx ON legacy_certificates(volunteer_id);

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

-- Organisations asking to be set up, pending until a platform admin approves.
-- Contact details are business records, not volunteer data, so the retention
-- sweep does not apply to them.
CREATE TABLE IF NOT EXISTS org_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_slug text NOT NULL,
    organization_name text NOT NULL,
    org_number text,
    contact_email text NOT NULL,
    contact_name text,
    message text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    handled_at timestamptz,
    handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS org_requests_status_idx ON org_requests(status, created_at);

-- Outbox for email notices to an organisation's admins. A row says that
-- something is waiting for an organisation and nothing else: no submission
-- id, no volunteer field, no recipient address. Recipients are looked up
-- from the membership table when the notice is sent.
CREATE TABLE IF NOT EXISTS notices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('submission_waiting')),
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    attempts int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS notices_unsent_idx ON notices(created_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS notices_org_idx ON notices(organization_id);

-- Per-organisation switches. organizations stays identity only.
CREATE TABLE IF NOT EXISTS org_settings (
    organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    digipost_enabled boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Where a certificate may be delivered, kept apart from what it says. The
-- fødselsnummer is sealed with a key the database does not hold, is never in
-- submissions.data (so never in the QR link or the hash), dies with the
-- submission, and is deleted as soon as the letter is sent.
CREATE TABLE IF NOT EXISTS submission_recipients (
    submission_id uuid PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
    national_id_enc text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Delivery queue and delivery record in one. While a letter is queued,
-- payload holds the sealed PDF and recipient. The CHECK makes the database
-- itself refuse to keep a payload on a row that is sent or failed, so what
-- remains is "sent via Digipost at time T" and nothing about the content.
CREATE TABLE IF NOT EXISTS deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    submission_id text NOT NULL,
    channel text NOT NULL CHECK (channel IN ('digipost')),
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
    payload text,
    attempts int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    expires_at timestamptz NOT NULL,
    CONSTRAINT deliveries_payload_only_while_queued CHECK (status = 'queued' OR payload IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS deliveries_one_per_certificate
    ON deliveries(organization_id, submission_id, channel);
CREATE INDEX IF NOT EXISTS deliveries_queued_idx ON deliveries(created_at) WHERE status = 'queued';

-- Errors the platform itself has hit, one row per distinct error. Holds what
-- broke and where in the code. It must never hold who was affected or what
-- they sent: no request body, no path with ids, no IP, no user. The message
-- is scrubbed of quoted text, emails, ids and digit runs before it gets here
-- (apps/api/src/lib/log.ts).
CREATE TABLE IF NOT EXISTS platform_errors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint text NOT NULL UNIQUE,
    source text NOT NULL,
    place text NOT NULL,
    kind text NOT NULL,
    message text NOT NULL DEFAULT '',
    stack text NOT NULL DEFAULT '',
    request_id text,
    count int NOT NULL DEFAULT 1,
    first_seen timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS platform_errors_last_seen_idx ON platform_errors(last_seen);

-- Hasura console steps (fresh install):
--   1. Data → "Untracked tables/views" → track every table above.
--   2. Relationships: object relationships on each organization_id /
--      template_id column, mirroring the tracked FKs.
--   3. No role permissions needed — the API talks to Hasura with the
--      admin secret and enforces tenancy in code
--      (apps/api/src/lib/apiAuth.ts).
--   4. Create the first org + member by hand until the onboarding UI
--      exists:
--        INSERT INTO organizations (slug, name) VALUES ('myorg', 'My Org');
--        INSERT INTO user_organizations (user_id, organization_id)
--        SELECT u.id, o.id FROM auth.users u, organizations o
--        WHERE u.email = 'admin@example.org' AND o.slug = 'myorg';

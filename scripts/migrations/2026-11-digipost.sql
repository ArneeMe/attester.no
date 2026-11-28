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

-- After running: track org_settings, submission_recipients and deliveries in Hasura.

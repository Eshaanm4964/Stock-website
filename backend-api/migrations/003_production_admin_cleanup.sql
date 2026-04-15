ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

UPDATE users
SET is_demo = TRUE
WHERE role = 'user' AND fixed_user_id IN ('CLIENT-1001', 'CLIENT-2002', 'CLIENT-3003');

CREATE TABLE IF NOT EXISTS signup_otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_otps_email_phone_created
ON signup_otps(email, phone_number, created_at DESC);

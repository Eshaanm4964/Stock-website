ALTER TABLE portfolio_holdings
    ADD CONSTRAINT ck_portfolio_holdings_quantity_positive CHECK (quantity > 0),
    ADD CONSTRAINT ck_portfolio_holdings_buy_price_positive CHECK (buy_price > 0);

ALTER TABLE alerts
    ADD CONSTRAINT ck_alerts_target_price_positive CHECK (target_price > 0),
    ADD CONSTRAINT ck_alerts_condition_valid CHECK (condition IN ('above', 'below'));

ALTER TABLE login_otps
    ADD CONSTRAINT ck_login_otps_purpose_valid CHECK (purpose IN ('login'));

ALTER TABLE reviews
    ADD CONSTRAINT ck_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);

CREATE TABLE IF NOT EXISTS auth_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL,
    stage VARCHAR(30) NOT NULL,
    identifier VARCHAR(120) NOT NULL,
    phone_number VARCHAR(20),
    ip_address VARCHAR(64),
    success BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason VARCHAR(120),
    metadata_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80),
    ip_address VARCHAR(64),
    details_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_stage_created ON auth_attempts(stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier_created ON auth_attempts(identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);

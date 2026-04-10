CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    fixed_user_id VARCHAR(30) UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    bio TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE portfolio_holdings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(10) NOT NULL DEFAULT 'NSE',
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    buy_price NUMERIC(12, 2) NOT NULL CHECK (buy_price > 0),
    sector VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE watchlist_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(10) NOT NULL DEFAULT 'NSE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_watchlist_user_symbol UNIQUE (user_id, symbol)
);

CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    target_price NUMERIC(12, 2) NOT NULL CHECK (target_price > 0),
    condition VARCHAR(10) NOT NULL CHECK (condition IN ('above', 'below')),
    is_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE login_otps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('login')),
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_attempts (
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

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(120) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    message TEXT NOT NULL,
    is_seeded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_settings (
    id SERIAL PRIMARY KEY,
    show_faq_insights BOOLEAN NOT NULL DEFAULT TRUE,
    chat_nudges_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80),
    ip_address VARCHAR(64),
    details_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolio_holdings_user_symbol ON portfolio_holdings(user_id, symbol);
CREATE INDEX idx_portfolio_holdings_symbol ON portfolio_holdings(symbol);
CREATE INDEX idx_login_otps_user_purpose_created ON login_otps(user_id, purpose, created_at DESC);
CREATE INDEX idx_auth_attempts_stage_created ON auth_attempts(stage, created_at DESC);
CREATE INDEX idx_auth_attempts_identifier_created ON auth_attempts(identifier, created_at DESC);
CREATE INDEX idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

# Backup And Recovery Plan

This project stores operational data in PostgreSQL or Supabase Postgres. The goal of this plan is to protect user portfolios, login metadata, reviews, and admin settings.

## What Must Be Protected

- `users`
- `portfolio_holdings`
- `login_otps`
- `auth_attempts`
- `admin_audit_logs`
- `reviews`
- `admin_settings`
- environment secrets such as `SECRET_KEY`, database credentials, and provider API keys

## Production Recommendations

1. Use Supabase managed backups on a paid plan.
2. Enable daily backups and point-in-time recovery if the client budget allows it.
3. Keep application secrets in the hosting platform secret manager, not in the repo.
4. Store a copy of the current schema migration files outside the app server.
5. Restrict database write access to the backend only.

## Backup Routine

### Database

- Daily automated backup from Supabase.
- Weekly verified restore test into a staging database.
- Before every production migration, create an on-demand manual backup or snapshot.

### Secrets

- Keep `SECRET_KEY`, database password, and API keys in:
  - Supabase project secrets or secure password manager
  - backend hosting provider secret store
- Export a secure credential handover document for the client owner.

### Application Files

- Keep the codebase in Git.
- Tag releases before schema or auth changes.
- Store generated migration SQL files with the release.

## Recovery Steps

### Scenario 1: Accidental Data Loss

1. Stop write traffic if corruption is ongoing.
2. Identify the last healthy backup timestamp.
3. Restore backup into a staging database first.
4. Verify:
   - user count
   - holdings count
   - latest audit logs
   - latest auth attempts
5. Promote the restored database or replay safe changes manually.

### Scenario 2: Broken Deployment

1. Roll back the application deployment to the previous release.
2. If a schema migration caused the issue, restore from the backup taken before migration.
3. Re-run smoke tests:
   - admin login
   - user login
   - OTP request
   - portfolio load
   - admin dashboard

### Scenario 3: Secret Exposure

1. Rotate exposed API keys immediately.
2. Rotate database password.
3. Rotate `SECRET_KEY` and force re-login for all users.
4. Review `admin_audit_logs` and `auth_attempts` for suspicious access patterns.

## Minimum Launch Checklist

- `APP_ENV=production`
- `OTP_DEBUG_MODE=false`
- strong non-default `SECRET_KEY`
- backups enabled
- restore process tested at least once
- migration files archived with release notes

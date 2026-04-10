# Supabase Phase 2 Setup

## 1. Create the Supabase project

- Create a new project in Supabase.
- Choose the region closest to your users.
- Save the database password safely.

## 2. Choose how to sign up

- For a client-owned production setup, prefer an email-based account owned by the business or client.
- GitHub login is fine for personal development, but email is easier to hand over cleanly later.

## 3. Get the Postgres connection string

- In Supabase, open `Project Settings -> Database`.
- Copy the direct Postgres connection string.
- Convert it to SQLAlchemy async format:

```env
DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

## 4. Update backend env

Set these values in `backend-api/.env`:

```env
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
FRONTEND_URL=http://localhost:5500
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
OTP_DEBUG_MODE=true
```

## 5. Run the schema

Use the SQL in:

- `sql_schema.sql`
- or `migrations/001_phase2_supabase.sql`

Run it inside the Supabase SQL editor.

## 6. Start the backend

```powershell
cd "D:\stock trader web\backend-api"
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload
```

On startup, the app will also seed:

- admin user
- demo users
- sample holdings
- default site settings
- initial reviews

## 7. Verify Phase 2

- Admin and user login still work
- Reviews page loads from backend
- New reviews persist across refresh/devices
- FAQ visibility and chatbot nudges are controlled through admin website controls
- Portfolio/user/admin data persists in Postgres instead of local SQLite

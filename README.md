# Stock Trader Web

## Active Layout

```text
backend-api/           FastAPI backend, database config, migrations
web/                   Active frontend pages, styles, and scripts
docs/                  Project structure and handoff notes
legacy/                Archived frontend scripts kept for reference
scripts/               Local run helpers
```

## Start The Project

### Backend
```powershell
cd "D:\stock trader web\backend-api"
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload
```

### Frontend
```powershell
cd "D:\stock trader web\web"
python -m http.server 5500
```

Open:

```text
http://localhost:5500/login.html
```

## Notes

- `web/` is the live frontend used by the project.
- `legacy/` contains old JS files that are no longer part of the active app.
- `backend-api/` is still the active backend.
- Run the frontend from `web/`, not from the project root.

Set-Location "D:\stock trader web\backend-api"
. .\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload

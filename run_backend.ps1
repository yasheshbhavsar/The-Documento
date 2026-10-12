# AI Immigration Backend Runner for Windows PowerShell
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"
$venvScripts = Join-Path $backendDir ".venv\Scripts"

if (-not (Test-Path $venvScripts)) {
    Write-Error "Virtual environment not found at $venvScripts. Please ensure backend is initialized."
    exit 1
}

$alembicExe = Join-Path $venvScripts "alembic.exe"
$uvicornExe = Join-Path $venvScripts "uvicorn.exe"
$alembicIni = Join-Path $backendDir "alembic.ini"

Set-Location $backendDir

Write-Host "Running Alembic migrations to head..." -ForegroundColor Cyan
& $alembicExe -c $alembicIni upgrade head

Write-Host "Starting FastAPI server at http://localhost:8000..." -ForegroundColor Green
Write-Host "OpenAPI documentation: http://localhost:8000/docs" -ForegroundColor Yellow
& $uvicornExe backend.app.main:app --reload --port 8000

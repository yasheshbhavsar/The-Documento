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

if (-not $env:DATABASE_URL) {
    $envFile = Join-Path $scriptDir ".env"
    $backendEnv = Join-Path $backendDir ".env"
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $parts = $line.Split("=", 2)
                [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
            }
        }
    } elseif (Test-Path $backendEnv) {
        Get-Content $backendEnv | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $parts = $line.Split("=", 2)
                [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
            }
        }
    }
}

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "postgresql+psycopg://ai_immigration:local_dev_only@localhost:5432/ai_immigration"
    Write-Host "No DATABASE_URL set. Defaulting to local PostgreSQL: $env:DATABASE_URL" -ForegroundColor Gray
}

$env:PYTHONPATH = $scriptDir
Set-Location $backendDir

Write-Host "Running Alembic migrations to head..." -ForegroundColor Cyan
& $alembicExe -c $alembicIni upgrade head

Write-Host "Starting FastAPI server at http://localhost:8000..." -ForegroundColor Green
Write-Host "OpenAPI documentation: http://localhost:8000/docs" -ForegroundColor Yellow
& $uvicornExe backend.app.main:app --reload --port 8000

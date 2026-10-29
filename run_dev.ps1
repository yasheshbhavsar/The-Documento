<#
.SYNOPSIS
    Starts both Backend (FastAPI) and Frontend (Next.js) for local development on Windows.

.DESCRIPTION
    1. Verifies prerequisites (Python, Node.js, npm, Docker/PostgreSQL).
    2. Ensures .env exists (creates from .env.example if missing).
    3. Checks frontend dependencies and backend virtual environment.
    4. Opens two separate terminal windows for Backend and Frontend, or runs them concurrently.
#>

[CmdletBinding()]
param(
    [switch]$SingleWindow
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
$backendDir = Join-Path $scriptDir "backend"
$frontendDir = Join-Path $scriptDir "apps\web"
$venvDir = Join-Path $backendDir ".venv"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       The Documento - Local Development Launcher         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Node.js and npm
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not found in PATH! Please install Node.js v18+ from https://nodejs.org/"
    exit 1
}

# 2. Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue) -and -not (Test-Path (Join-Path $venvDir "Scripts\python.exe"))) {
    Write-Warning "Python is not found in PATH! Backend requires Python 3.12+."
    Write-Warning "Download from https://www.python.org/downloads/ (Remember to check 'Add python.exe to PATH')."
}

# 3. Check .env
$envFile = Join-Path $scriptDir ".env"
$envExample = Join-Path $scriptDir ".env.example"
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Write-Host "[Info] Copying .env.example -> .env" -ForegroundColor Yellow
    Copy-Item $envExample $envFile
}

# 4. Check Frontend node_modules
$webModules = Join-Path $frontendDir "node_modules"
$cobeModule = Join-Path $webModules "cobe"
if (-not (Test-Path $webModules) -or -not (Test-Path $cobeModule)) {
    Write-Host "[Setup] Installing frontend dependencies in apps/web..." -ForegroundColor Yellow
    npm --prefix $frontendDir install
}

# 5. Check Backend .venv
$backendVenvScripts = Join-Path $venvDir "Scripts"
if (-not (Test-Path $backendVenvScripts)) {
    Write-Host ""
    Write-Host "[Action Required] Backend virtual environment not found at backend/.venv!" -ForegroundColor Red
    Write-Host "To set up the backend virtual environment, run:" -ForegroundColor Yellow
    Write-Host "   cd `"$backendDir`"" -ForegroundColor White
    Write-Host "   python -m venv .venv" -ForegroundColor White
    Write-Host "   .\.venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "   pip install -r requirements.txt" -ForegroundColor White
    Write-Host ""
    $resp = Read-Host "Would you like this script to try creating the venv now? (y/N)"
    if ($resp -match "^[Yy]") {
        if (Get-Command python -ErrorAction SilentlyContinue) {
            Set-Location $backendDir
            python -m venv .venv
            & (Join-Path $backendVenvScripts "pip.exe") install --upgrade pip
            & (Join-Path $backendVenvScripts "pip.exe") install -r requirements.txt
            Set-Location $scriptDir
        } else {
            Write-Error "Cannot create venv: python is not available in PATH. Please install Python first."
            exit 1
        }
    } else {
        exit 1
    }
}

# 6. Check Database connectivity hint
Write-Host "[Database] Make sure PostgreSQL is running (e.g. 'docker compose up -d')." -ForegroundColor Cyan

# 7. Launch servers
if ($SingleWindow) {
    Write-Host "[Starting] Launching FE & BE concurrently in this terminal..." -ForegroundColor Green
    npm run dev:all
} else {
    Write-Host "[Starting] Launching Backend in a separate window (http://localhost:8000)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-Command", "cd `"$scriptDir`"; powershell -ExecutionPolicy Bypass -File ./run_backend.ps1"

    Write-Host "[Starting] Launching Frontend in a separate window (http://localhost:3000)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-Command", "cd `"$frontendDir`"; npm run dev"

    Write-Host ""
    Write-Host "Both servers are launching in separate windows:" -ForegroundColor Cyan
    Write-Host "  - Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host "  - Backend API: http://localhost:8000" -ForegroundColor White
    Write-Host "  - OpenAPI Swagger: http://localhost:8000/docs" -ForegroundColor White
    Write-Host ""
}

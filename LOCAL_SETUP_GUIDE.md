# The Documento — Local Development & Database Setup Guide

> **System Audit Summary for Windows:**
> - **Node.js**: Installed (`v24.13.1`)
> - **npm**: Installed (`v11.8.0`)
> - **Docker**: Installed (`v29.5.3`, Compose `v5.1.4`) — *requires Docker Desktop to be running*
> - **Python**: **Action Required** — Python is not currently found in PATH. You need to install Python 3.12+.

---

## Table of Contents
1. [Prerequisites & What to Install](#1-prerequisites--what-to-install)
2. [Native Local PostgreSQL Setup (Step-by-Step)](#2-native-local-postgresql-setup-step-by-step)
3. [Running Docker with Your Local PostgreSQL (Automatic Updates & Migrations)](#3-running-docker-with-your-local-postgresql-automatic-updates--migrations)
4. [Alternative: Running Full Database Stack in Docker](#4-alternative-running-full-database-stack-in-docker)
5. [Environment Configuration (.env)](#5-environment-configuration-env)
6. [First-Time Installation Steps](#6-first-time-installation-steps)
7. [Running Frontend and Backend Simultaneously](#7-running-frontend-and-backend-simultaneously)
8. [Verification & Default URLs](#8-verification--default-urls)
9. [Troubleshooting & FAQ](#9-troubleshooting--faq)

---

## 1. Prerequisites & What to Install

| Tool | Required Version | Status on Your Machine | Action Needed |
| :--- | :--- | :--- | :--- |
| **Node.js & npm** | Node 18+ (20+ recommended) | Installed (`v24.13.1`, npm `11.8.0`) | None |
| **Python** | Python 3.12 (3.11+ supported) | **Not Installed / Not in PATH** | **Install Python 3.12** from [python.org](https://www.python.org/downloads/). **CRITICAL**: Check the box **"Add python.exe to PATH"** during setup! |
| **PostgreSQL** | PostgreSQL 16 or 17 | Not installed natively | Follow [Section 2](#2-native-local-postgresql-setup-step-by-step) to install locally |
| **Docker & Docker Compose** | Docker 24+ | Installed (`v29.5.3`, Compose `v5.1.4`) | Open **Docker Desktop** app to start the engine |
| **Git** | 2.x | Installed | None |

---

## 2. Native Local PostgreSQL Setup (Step-by-Step)

If you want PostgreSQL running directly on your Windows machine with your own local database:

### Step 2.1: Download & Install PostgreSQL for Windows
1. Go to the official PostgreSQL Windows installer:  
   👉 [EnterpriseDB PostgreSQL Downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
2. Download **PostgreSQL 17** (or 16) for Windows x86-64.
3. Run the `.exe` installer:
   - **Installation Directory**: Keep default (`C:\Program Files\PostgreSQL\17`).
   - **Components**: Check all:
     - ✅ **PostgreSQL Server**
     - ✅ **pgAdmin 4** (GUI management application)
     - ✅ **Command Line Tools** (`psql`)
   - **Superuser Password**: Set a password for the default `postgres` user (e.g., `local_dev_only` or your chosen password). **Remember this password!**
   - **Port**: Keep `5432`.
   - **Locale**: Keep default.
   - Click **Next** through the installation. When finished, you can uncheck/cancel Stack Builder.

### Step 2.2: Verify PostgreSQL Windows Service is Running
Open PowerShell and run:
```powershell
Get-Service -Name postgresql*
```
You should see status `Running`.

### Step 2.3: Create Database and User
Open **SQL Shell (psql)** from your Windows Start Menu (or pgAdmin 4).

1. Press `Enter` to accept defaults for:
   - `Server [localhost]`: Press `Enter`
   - `Database [postgres]`: Press `Enter`
   - `Port [5432]`: Press `Enter`
   - `Username [postgres]`: Press `Enter`
   - `Password for user postgres`: Type the password you set during installation.
2. In the `postgres=#` prompt, paste the following SQL commands:
   ```sql
   CREATE USER ai_immigration WITH ENCRYPTED PASSWORD 'local_dev_only';
   CREATE DATABASE ai_immigration OWNER ai_immigration;
   GRANT ALL PRIVILEGES ON DATABASE ai_immigration TO ai_immigration;
   \c ai_immigration
   GRANT ALL ON SCHEMA public TO ai_immigration;
   ```
3. Type `\q` and press `Enter` to exit psql.

### Step 2.4: Allow Docker Containers to Access Your Local Windows PostgreSQL
> **Why this is required:** When Docker runs, containers run in a virtual network. To allow Docker containers to connect to your local Windows PostgreSQL:

1. Open `C:\Program Files\PostgreSQL\17\data\postgresql.conf` in Notepad (run Notepad as Administrator):
   - Find line `#listen_addresses = 'localhost'`
   - Change it to:
     ```ini
     listen_addresses = '*'
     ```
2. Open `C:\Program Files\PostgreSQL\17\data\pg_hba.conf` in Notepad:
   - Scroll to the bottom and add this line:
     ```ini
     host    all             all             0.0.0.0/0               scram-sha-256
     ```
3. Restart the PostgreSQL Windows Service to apply the changes:
   ```powershell
   Restart-Service postgresql*
   ```

---

## 3. Running Docker with Your Local PostgreSQL (Automatic Updates & Migrations)

Now that PostgreSQL is installed on your Windows machine, here is how Docker works with it:

### ⚠️ Avoid Port 5432 Conflict
Since your native Windows PostgreSQL is already listening on port `5432`, you should **not** start another PostgreSQL container on port `5432`.

Instead, use Docker to run the supporting services (**Redis** and **MinIO**) and the **automatic database migrator**:

### Step 3.1: Start Redis and MinIO in Docker
Run:
```powershell
npm run db:services
```
*(This executes `docker compose up -d redis minio`, starting Redis on `6379` and MinIO on `9000/9001` without conflicting with your local PostgreSQL).*

### Step 3.2: Use Docker to Automatically Update / Migrate Your Local PostgreSQL
To apply all database schema updates, create tables, and seed initial data into your local Windows PostgreSQL database using Docker, run:

```powershell
npm run db:migrate:docker
```

#### How this works under the hood:
1. Docker spins up the migration container defined in `docker-compose.yml`.
2. It resolves your Windows machine via `host.docker.internal:5432`.
3. It runs `alembic upgrade head`, creating and updating all 18+ tables, schemas, relations, and role configurations in your local Windows PostgreSQL database.
4. The container automatically shuts down when migration finishes (`--rm`).

You can also run migrations natively without Docker if you have Python setup:
```powershell
npm run db:migrate:local
```

---

## 4. Alternative: Running Full Database Stack in Docker

If at any point you want Docker to manage PostgreSQL, Redis, and MinIO all together:

1. Stop your local Windows PostgreSQL service:
   ```powershell
   Stop-Service postgresql*
   ```
2. Start the full container stack:
   ```powershell
   npm run db:up
   # Or: docker compose up -d
   ```
3. When finished:
   ```powershell
   npm run db:down
   # Or: docker compose down
   ```

---

## 5. Environment Configuration (.env)

The root `.env` file is already created from `.env.example`.

For your local Windows PostgreSQL setup, verify that `DATABASE_URL` in `.env` is:
```env
# Database (PostgreSQL)
DATABASE_URL=postgresql+psycopg://ai_immigration:local_dev_only@localhost:5432/ai_immigration

# Background Jobs / Redis (from Docker)
REDIS_URL=redis://localhost:6379/0

# Private Immutable Object Storage (MinIO / S3)
OBJECT_STORAGE_ENDPOINT=http://localhost:9000
OBJECT_STORAGE_BUCKET=ai-immigration
USE_LOCAL_STORAGE=true
DOCUMENT_STORAGE_DIR=./storage_data

# Security & Session Authentication
JWT_SECRET_KEY=local_development_secret_key_change_in_production_min_32_chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
AUTH_REQUIRED=false

# Network & Rate Limiting
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
RATE_LIMIT_PER_MINUTE=120
```

---

## 6. First-Time Installation Steps

### Step 1: Install Python
If you haven't yet, install Python 3.12:
- Download from [python.org/downloads](https://www.python.org/downloads/)
- Run installer and **check the box: "Add python.exe to PATH"**
- Restart your terminal and verify:
  ```powershell
  python --version
  ```

### Step 2: Set up Backend Virtual Environment
```powershell
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Return to root directory
cd ..
```

> **Note for PowerShell execution policy:**
> If you get `cannot be loaded because running scripts is disabled on this system`, run once:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

### Step 3: Install Frontend Dependencies
From the project root:
```powershell
npm run setup:frontend
# Or:
npm --prefix apps/web install
```

### Step 4: Run Database Migrations to Update Schema
Ensure your local PostgreSQL is running, then run either:
```powershell
# Option A: Via Docker (no local alembic required)
npm run db:migrate:docker

# Option B: Via Local Python
npm run db:migrate:local
```

---

## 7. Running Frontend and Backend Simultaneously

You have three convenient ways to run both services together:

### Method 1: All-In-One NPM Command (Single Terminal)
Runs both Backend and Frontend in one terminal window with color-coded logs:
```powershell
npm run dev:all
```
- Automatically checks database connection
- Runs Alembic migrations to update schema
- Boots FastAPI on `http://localhost:8000`
- Boots Next.js on `http://localhost:3000`
- Press `Ctrl + C` once to gracefully shut down both services.

---

### Method 2: Dual-Window PowerShell Launcher (Recommended on Windows)
Runs a script that opens two separate PowerShell windows for FE and BE:
```powershell
powershell -ExecutionPolicy Bypass -File .\run_dev.ps1
```
This gives you independent log streams for the backend and frontend so you can inspect server logs easily without them mixing.

---

### Method 3: Two Separate Terminals (Manual)
If you prefer standard separate terminals (e.g., in VS Code or Windows Terminal):

**Terminal 1 (Backend):**
```powershell
npm run backend
# Or:
powershell -ExecutionPolicy Bypass -File ./run_backend.ps1
```

**Terminal 2 (Frontend):**
```powershell
npm run dev
# Or:
npm --prefix apps/web run dev
```

---

## 8. Verification & Default URLs

Once running, access the platform at:

| Component | URL | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:3000](http://localhost:3000) | Next.js Case Management Portal |
| **Backend API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive Swagger OpenAPI documentation |
| **API Health Check** | [http://localhost:8000/api/v1/health/live](http://localhost:8000/api/v1/health/live) | Backend health endpoint |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | S3 Object Storage UI (`localadmin` / `local_dev_only_change_me`) |
| **Local PostgreSQL** | `localhost:5432` | Connect via pgAdmin or DBeaver (`ai_immigration` / `local_dev_only`) |

---

## 9. Troubleshooting & FAQ

### 1. `port is already allocated` or `bind: address already in use`
- This happens if native Windows PostgreSQL is running on port 5432 and you attempt to run `docker compose up -d` with a `postgres` container.
- Solution: Run `npm run db:services` instead, which only starts Redis and MinIO in Docker and leaves port 5432 for your native PostgreSQL.

### 2. `FATAL: password authentication failed for user "ai_immigration"`
- Make sure the password in your `.env` file matches the password you specified in PostgreSQL when creating the user.
- If you used `local_dev_only`, ensure `DATABASE_URL` in `.env` contains `:local_dev_only@localhost:5432`.

### 3. `could not connect to server: Connection refused (0x0000274D/10061)`
- Make sure the PostgreSQL Windows service is running:
  ```powershell
  Get-Service postgresql*
  Start-Service postgresql*
  ```

### 4. Docker Migrations Cannot Reach `host.docker.internal`
- Verify that `listen_addresses = '*'` is set in `C:\Program Files\PostgreSQL\17\data\postgresql.conf` and `0.0.0.0/0` is allowed in `pg_hba.conf`, then restart the service:
  ```powershell
  Restart-Service postgresql*
  ```

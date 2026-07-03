# LeadPro — Lead Management System

A full-stack lead management platform for BD executives, software engineers, managers, and admins.

## Stack

- **Backend:** FastAPI + SQLAlchemy + PostgreSQL + Celery + Redis
- **Frontend:** Next.js 15 + Tailwind CSS + Recharts

## Features

- **Auth & RBAC:** Admin, Manager, BD Executive, Software Engineer roles
- **User onboarding:** Admin-provisioned accounts, BD self-registration with approval, email invite links
- **Leads:** Full CRUD, JD invite tracking, engineer/BD assignment, Phase → Type → Status hierarchy, history
- **Monthly Targets:** Engineer quotas by tech stack with progress tracking
- **Profiles:** Candidate registry with LinkedIn verification and GitHub tracking
- **Issues:** Engineers and BDs log issues; managers triage and resolve
- **Reports:** Dashboard KPIs, weekly/monthly reports with charts, SMTP email delivery
- **Admin:** User management, status config, audit log
- **LLM Agents:** Stub interfaces for lead enrichment and status suggestions

## Quick Start (one command)

```bash
cp .env.example .env
docker compose up -d postgres
./scripts/start.sh
```

Then open **http://localhost:3000** and log in with `admin@leadpro.com` / `admin123`.

> **Note:** Postgres runs on port **5433** (not 5432) to avoid conflicts with a local PostgreSQL install.

## Manual Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.12+ (for local backend dev)

### Setup

```bash
cp .env.example .env
    docker compose up -d postgres redis
    # Postgres exposed on localhost:5433 (avoids conflict with local PostgreSQL on 5432)
```

### Backend (local)

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install .
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Ensure Postgres is running via Docker on port **5433** before starting the backend.

### Frontend (local)

```bash
cd frontend
yarn install
yarn dev
```

### Full Docker stack

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@leadpro.com | admin123 |
| Manager | manager@leadpro.com | manager123 |
| BD | bd@leadpro.com | bd123456 |
| Engineer | engineer@leadpro.com | engineer123 |

## Project Structure

```
lead-management-engine/
├── backend/          # FastAPI Python backend
├── frontend/         # Next.js frontend
├── docker-compose.yml
└── .env.example
```


cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
cd frontend && yarn dev

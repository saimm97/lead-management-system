# LeadPro Architecture

A multi-role lead and recruitment pipeline. A Next.js app calls a FastAPI backend over JSON, Postgres holds the data, and Celery with Redis runs scheduled reports and the daily AI job ingest.

**Stack:** Next.js 15, TypeScript, Tailwind, Recharts, FastAPI, SQLAlchemy (async), Postgres 16 + pgvector, Celery, Redis 7.

Diagrams are Mermaid and render on GitHub, GitLab and most Markdown viewers. A PDF copy with the diagrams pre-rendered is in [`architecture.pdf`](architecture.pdf).

Contents: [System](#1-system-context) · [Backend layers](#2-backend-layers) · [Modules](#3-domain-modules) · [Frontend](#4-frontend) · [Data model](#5-data-model) · [Request flow](#6-request-flow) · [AI pipeline](#7-ai-pipeline) · [Roles](#8-roles-and-permissions) · [Deployment](#9-deployment) · [Suggestions](#10-suggestions)

## 1. System context

Four kinds of users reach one web app. The browser only calls the FastAPI API. Email, calendar, LLM and job-feed access are made by the backend.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Arial, Helvetica, sans-serif','fontSize':'14px','primaryColor':'#EAF1FB','primaryBorderColor':'#2F5D9E','primaryTextColor':'#0F1F33','secondaryColor':'#F3F5F8','tertiaryColor':'#F7F9FC','lineColor':'#5B6B7F','textColor':'#0F1F33','clusterBkg':'#F6F8FB','clusterBorder':'#C3CDDA','edgeLabelBackground':'#FFFFFF','actorBkg':'#EAF1FB','actorBorder':'#2F5D9E','actorTextColor':'#0F1F33','actorLineColor':'#9AA8BA','signalColor':'#3B4A5E','signalTextColor':'#0F1F33','labelBoxBkgColor':'#EAF1FB','labelBoxBorderColor':'#2F5D9E','noteBkgColor':'#F3F5F8','noteBorderColor':'#9AA8BA','activationBkgColor':'#DCE7F7','sequenceNumberColor':'#FFFFFF','attributeBackgroundColorOdd':'#F6F8FB','attributeBackgroundColorEven':'#FFFFFF'},'flowchart':{'curve':'basis','padding':12}}}%%
flowchart LR
subgraph USERS["Users"]
  A["Admin"]
  M["Manager<br/>(BD or Engineering)"]
  B["BD Executive"]
  E["Software Engineer"]
end
subgraph FE["Frontend :3000"]
  N["Next.js App Router<br/>React, Tailwind, Recharts"]
end
subgraph BE["Backend :8000"]
  API["FastAPI<br/>REST under /api, JWT"]
  W["Celery worker + beat"]
end
subgraph DATA["Data stores"]
  PG[("PostgreSQL 16<br/>pgvector extension")]
  R[("Redis 7<br/>broker + result backend")]
end
subgraph EXT["External services"]
  SMTP["SMTP server"]
  GC["Google Calendar<br/>OAuth"]
  LLM["OpenAI-compatible LLM<br/>chat + embeddings"]
  JOBS["Job sources<br/>JOB_FEED_URL + Greenhouse boards"]
end
A & M & B & E -->|"HTTPS"| N
N -->|"fetch + Bearer JWT"| API
API -->|"async SQLAlchemy"| PG
API -->|"enqueue"| R
R -->|"tasks"| W
W -->|"sync SQLAlchemy"| PG
W -->|"weekly + monthly report email"| SMTP
W -->|"daily ingest"| JOBS
API -->|"invite, confirm, reset links"| SMTP
API -->|"create interview events"| GC
API -->|"CV analysis, embeddings"| LLM
classDef layer fill:#DCE7F7,stroke:#2F5D9E,stroke-width:1.5px,color:#0F1F33
classDef aux fill:#FFFFFF,stroke:#8794A5,color:#2B394B
classDef store fill:#E1F2EF,stroke:#1B7F73,stroke-width:1.5px,color:#0F1F33
classDef ext fill:#F1F3F6,stroke:#8794A5,stroke-dasharray:4 3,color:#2B394B
classDef actor fill:#1F3A5F,stroke:#1F3A5F,color:#FFFFFF
classDef warn fill:#FDECEA,stroke:#B3261E,stroke-dasharray:4 3,color:#7A1B15
class A,M,B,E actor
class N,API,W layer
class PG,R store
class SMTP,GC,LLM,JOBS ext
```

## 2. Backend layers

Guards sit in front of the routes. Shared logic lives in services, but several routes also query the ORM directly.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Arial, Helvetica, sans-serif','fontSize':'14px','primaryColor':'#EAF1FB','primaryBorderColor':'#2F5D9E','primaryTextColor':'#0F1F33','secondaryColor':'#F3F5F8','tertiaryColor':'#F7F9FC','lineColor':'#5B6B7F','textColor':'#0F1F33','clusterBkg':'#F6F8FB','clusterBorder':'#C3CDDA','edgeLabelBackground':'#FFFFFF','actorBkg':'#EAF1FB','actorBorder':'#2F5D9E','actorTextColor':'#0F1F33','actorLineColor':'#9AA8BA','signalColor':'#3B4A5E','signalTextColor':'#0F1F33','labelBoxBkgColor':'#EAF1FB','labelBoxBorderColor':'#2F5D9E','noteBkgColor':'#F3F5F8','noteBorderColor':'#9AA8BA','activationBkgColor':'#DCE7F7','sequenceNumberColor':'#FFFFFF','attributeBackgroundColorOdd':'#F6F8FB','attributeBackgroundColorEven':'#FFFFFF'},'flowchart':{'curve':'basis','padding':12}}}%%
flowchart TB
REQ["HTTP request"] --> MAIN["main.py<br/>CORS, 13 routers under /api<br/>startup: CREATE EXTENSION vector, create_all,<br/>ALTER ... IF NOT EXISTS, seed_database"]
MAIN --> ROUTES["api/routes: 12 modules<br/>auth, users, leads, profiles + targets, issues, reports<br/>teams, calendar, cv, admin, agents, ai_pipeline"]
ROUTES -->|"Depends"| DEPS["api/deps.py<br/>get_current_user: access-token JWT,<br/>user active, approval = approved<br/>require_roles(...)"]
ROUTES --> SCH["schemas/<br/>Pydantic request + response"]
ROUTES --> SVC["services<br/>users, tenant, rbac, audit, bulk_update, import_excel<br/>email, google_calendar, cv_ats, ai_pipeline"]
ROUTES -->|"inline queries, e.g. leads.py"| ORM
SVC --> ORM["models/<br/>SQLAlchemy ORM, 19 tables"]
ORM --> DB[("PostgreSQL")]
CORE["core<br/>config (.env), database (async engine),<br/>security (hash + JWT), enums"] -.->|"used by every layer"| SVC
AG["agents/base.py<br/>enrichment + status stubs"] --> ROUTES
TASKS["tasks/<br/>celery_app, reports"] -->|"sync engine"| DB
TASKS -->|"ingest_daily"| SVC
classDef layer fill:#DCE7F7,stroke:#2F5D9E,stroke-width:1.5px,color:#0F1F33
classDef aux fill:#FFFFFF,stroke:#8794A5,color:#2B394B
classDef store fill:#E1F2EF,stroke:#1B7F73,stroke-width:1.5px,color:#0F1F33
classDef ext fill:#F1F3F6,stroke:#8794A5,stroke-dasharray:4 3,color:#2B394B
classDef actor fill:#1F3A5F,stroke:#1F3A5F,color:#FFFFFF
classDef warn fill:#FDECEA,stroke:#B3261E,stroke-dasharray:4 3,color:#7A1B15
class ROUTES,SVC,ORM layer
class REQ,MAIN,DEPS,SCH,CORE,AG,TASKS aux
class DB store
```

## 3. Domain modules

Each feature is a slice: a route file, a schema file and usually a model, with shared logic in services.

| Module | Files | What it does |
|---|---|---|
| Auth and onboarding | `routes/auth.py`, `routes/users.py` | Login, refresh, self-register with email confirm or admin approval, invites, forgot and reset password |
| Leads | `routes/leads.py`, `models/lead.py` | CRUD, multi-field search, status change with history, CSV export, dropdown options, status config |
| AI Pipeline | `routes/ai_pipeline.py`, `services/ai_pipeline.py`, `pipeline/` | Daily job ingest from feeds and company boards (Greenhouse, Lever, Ashby), US-remote eligibility, closing of vanished jobs, filtering and ranking, tech share, engineer suggestions, accept a job as a lead |
| Profiles and targets | `routes/profiles.py`, `models/profile.py` | Candidate registry and monthly engineer quotas |
| Issues | `routes/issues.py`, `models/issue.py` | Log, triage, comment, bulk update |
| Reports | `routes/reports.py`, `tasks/reports.py` | Dashboard, weekly, monthly, per-BD daily, engineer funnel, scheduled email |
| Teams and import | `routes/teams.py`, `services/import_excel.py` | Engineering and BD team lists, Excel import and templates |
| Calendar | `routes/calendar.py`, `services/google_calendar.py` | Google OAuth connect, interview invites tied to a lead |
| CV Optimizer and agents | `routes/cv.py`, `services/cv_ats.py`, `routes/agents.py` | ATS analysis through the LLM. The two agents are stubs |
| Admin and audit | `routes/admin.py`, `services/audit.py` | Status config, audit log, Excel import and template |

## 4. Frontend

Pages in the signed-in `(app)` group share one shell. Every page reaches the backend through `lib/api.ts`.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Arial, Helvetica, sans-serif','fontSize':'14px','primaryColor':'#EAF1FB','primaryBorderColor':'#2F5D9E','primaryTextColor':'#0F1F33','secondaryColor':'#F3F5F8','tertiaryColor':'#F7F9FC','lineColor':'#5B6B7F','textColor':'#0F1F33','clusterBkg':'#F6F8FB','clusterBorder':'#C3CDDA','edgeLabelBackground':'#FFFFFF','actorBkg':'#EAF1FB','actorBorder':'#2F5D9E','actorTextColor':'#0F1F33','actorLineColor':'#9AA8BA','signalColor':'#3B4A5E','signalTextColor':'#0F1F33','labelBoxBkgColor':'#EAF1FB','labelBoxBorderColor':'#2F5D9E','noteBkgColor':'#F3F5F8','noteBorderColor':'#9AA8BA','activationBkgColor':'#DCE7F7','sequenceNumberColor':'#FFFFFF','attributeBackgroundColorOdd':'#F6F8FB','attributeBackgroundColorEven':'#FFFFFF'},'flowchart':{'curve':'basis','padding':12}}}%%
flowchart TB
PUBLIC["Public routes<br/>/ landing, login, register, register/bd<br/>confirm-email/[token], forgot-password<br/>reset-password/[token], invite/[token]"]
SHELL["(app)/layout.tsx<br/>sidebar, topbar, auth gate"]
PAGES["Pages<br/>dashboard, leads (+ new, [id]), ai-pipeline (+ [id])<br/>issues (+ new), profiles (+ [id]), monthly-targets<br/>reports, calendar, cv, teams (bd, engineering)<br/>profile, admin (users, import, status-config, audit, settings)"]
COMP["components<br/>ui/index.tsx design system<br/>tables: Sortable, Leads, Issues, Profiles, AdminUsers, Targets<br/>FilterPanel, BulkActionBar, BulkUpdateModal<br/>SearchableSelect, CreatableSelect, LeadStatusEditor<br/>Charts, MultiChart, KpiCard, DailyReport, EngineerReport<br/>JobTechMatch, landing/"]
HOOKS["hooks + lib<br/>useBulkSelect, useTableView<br/>tableUtils, csv, format, engineer, types.ts"]
API["lib/api.ts<br/>fetch wrapper, Bearer header<br/>401: clear tokens, redirect to /login<br/>JSON, upload and download helpers"]
BACK["FastAPI /api/*"]
SHELL --> PAGES
PAGES --> COMP
PAGES --> HOOKS
PAGES --> API
PUBLIC --> API
API -->|"NEXT_PUBLIC_API_URL"| BACK
classDef layer fill:#DCE7F7,stroke:#2F5D9E,stroke-width:1.5px,color:#0F1F33
classDef aux fill:#FFFFFF,stroke:#8794A5,color:#2B394B
classDef store fill:#E1F2EF,stroke:#1B7F73,stroke-width:1.5px,color:#0F1F33
classDef ext fill:#F1F3F6,stroke:#8794A5,stroke-dasharray:4 3,color:#2B394B
classDef actor fill:#1F3A5F,stroke:#1F3A5F,color:#FFFFFF
classDef warn fill:#FDECEA,stroke:#B3261E,stroke-dasharray:4 3,color:#7A1B15
class SHELL,PAGES,COMP,HOOKS,API layer
class PUBLIC aux
class BACK ext
```

## 5. Data model

Relationships follow the foreign keys in `backend/app/models`, 19 tables in all. Where one table points at `users` several times, the line lists each column.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Arial, Helvetica, sans-serif','fontSize':'14px','primaryColor':'#EAF1FB','primaryBorderColor':'#2F5D9E','primaryTextColor':'#0F1F33','secondaryColor':'#F3F5F8','tertiaryColor':'#F7F9FC','lineColor':'#5B6B7F','textColor':'#0F1F33','clusterBkg':'#F6F8FB','clusterBorder':'#C3CDDA','edgeLabelBackground':'#FFFFFF','actorBkg':'#EAF1FB','actorBorder':'#2F5D9E','actorTextColor':'#0F1F33','actorLineColor':'#9AA8BA','signalColor':'#3B4A5E','signalTextColor':'#0F1F33','labelBoxBkgColor':'#EAF1FB','labelBoxBorderColor':'#2F5D9E','noteBkgColor':'#F3F5F8','noteBorderColor':'#9AA8BA','activationBkgColor':'#DCE7F7','sequenceNumberColor':'#FFFFFF','attributeBackgroundColorOdd':'#F6F8FB','attributeBackgroundColorEven':'#FFFFFF'},'flowchart':{'curve':'basis','padding':12}}}%%
erDiagram
TENANT |o--o{ USER : "tenant_id"
TENANT |o--o{ LEAD : "tenant_id"
TENANT |o--o{ PROFILE : "tenant_id"
USER |o--o{ USER : "manager_id"
USER |o--o{ LEAD : "bd, assigned_engineer, cluster_head, assigned_by_bd"
USER |o--o{ PROFILE : "assigned_engineer, verified_by"
PROFILE |o--o{ LEAD : "profile_id"
LEAD ||--o{ LEAD_STATUS_HISTORY : "lead_id"
USER ||--o{ LEAD_STATUS_HISTORY : "changed_by"
LEAD |o--o{ AI_PIPELINE_JOB : "lead_id"
PIPELINE_BOARD |o--o{ AI_PIPELINE_JOB : "board_id"
LEAD |o--o{ CALENDAR_INVITE : "related_lead_id"
USER ||--o{ CALENDAR_INVITE : "organizer, attendee"
USER ||--o{ MONTHLY_TARGET : "engineer, created_by"
LEAD |o--o{ ISSUE : "related_lead_id"
PROFILE |o--o{ ISSUE : "related_profile_id"
USER ||--o{ ISSUE : "reported_by, assigned_manager, related_engineer"
ISSUE ||--o{ ISSUE_COMMENT : "issue_id"
USER ||--o{ ISSUE_COMMENT : "author_id"
```

Account and operations tables hang off `users` only. The two lookup tables have no foreign keys.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Arial, Helvetica, sans-serif','fontSize':'14px','primaryColor':'#EAF1FB','primaryBorderColor':'#2F5D9E','primaryTextColor':'#0F1F33','secondaryColor':'#F3F5F8','tertiaryColor':'#F7F9FC','lineColor':'#5B6B7F','textColor':'#0F1F33','clusterBkg':'#F6F8FB','clusterBorder':'#C3CDDA','edgeLabelBackground':'#FFFFFF','actorBkg':'#EAF1FB','actorBorder':'#2F5D9E','actorTextColor':'#0F1F33','actorLineColor':'#9AA8BA','signalColor':'#3B4A5E','signalTextColor':'#0F1F33','labelBoxBkgColor':'#EAF1FB','labelBoxBorderColor':'#2F5D9E','noteBkgColor':'#F3F5F8','noteBorderColor':'#9AA8BA','activationBkgColor':'#DCE7F7','sequenceNumberColor':'#FFFFFF','attributeBackgroundColorOdd':'#F6F8FB','attributeBackgroundColorEven':'#FFFFFF'},'flowchart':{'curve':'basis','padding':12}}}%%
erDiagram
USER ||--o{ USER_INVITATION : "invited_by, manager"
USER |o--o{ AUDIT_LOG : "user_id"
USER ||--o{ AUTH_TOKEN : "user_id"
USER ||--o{ PASSWORD_RESET_REQUEST : "user_id, resolved_by"
USER ||--o| GOOGLE_CREDENTIAL : "user_id, unique"
USER |o--o{ REPORT_SNAPSHOT : "generated_for_manager"
LEAD_STATUS_CONFIG
LEAD_DROPDOWN_OPTION
```

A lead stores its phase, type, status and source as plain values, so nothing in the database enforces that they match `LEAD_STATUS_CONFIG` or `LEAD_DROPDOWN_OPTION`.

## 6. Request flow

Changing a lead's status, as the code does it today. The role check is inline in the route and no audit entry is written.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Arial, Helvetica, sans-serif','fontSize':'14px','primaryColor':'#EAF1FB','primaryBorderColor':'#2F5D9E','primaryTextColor':'#0F1F33','secondaryColor':'#F3F5F8','tertiaryColor':'#F7F9FC','lineColor':'#5B6B7F','textColor':'#0F1F33','clusterBkg':'#F6F8FB','clusterBorder':'#C3CDDA','edgeLabelBackground':'#FFFFFF','actorBkg':'#EAF1FB','actorBorder':'#2F5D9E','actorTextColor':'#0F1F33','actorLineColor':'#9AA8BA','signalColor':'#3B4A5E','signalTextColor':'#0F1F33','labelBoxBkgColor':'#EAF1FB','labelBoxBorderColor':'#2F5D9E','noteBkgColor':'#F3F5F8','noteBorderColor':'#9AA8BA','activationBkgColor':'#DCE7F7','sequenceNumberColor':'#FFFFFF','attributeBackgroundColorOdd':'#F6F8FB','attributeBackgroundColorEven':'#FFFFFF'},'flowchart':{'curve':'basis','padding':12}}}%%
sequenceDiagram
autonumber
participant U as Manager (browser)
participant P as LeadStatusEditor
participant A as lib/api.ts
participant R as routes/leads.py
participant D as deps.get_current_user
participant DB as PostgreSQL
U->>P: choose phase, type, status, note
P->>A: PATCH /leads/{id}/status
A->>R: request with Bearer access token
R->>D: Depends(get_current_user)
D->>DB: decode JWT, load user by sub
D-->>R: user, or 401 / 403 pending approval
R->>DB: select Lead
DB-->>R: lead, or 404
R->>R: inline check: role is admin or manager, else 403
R->>DB: insert LeadStatusHistory (old and new values)
R->>DB: update Lead phase, type, status, interview fields
R->>DB: commit
R-->>A: LeadResponse JSON
A-->>P: updated lead
P-->>U: refreshed status and history
```

A 401 anywhere makes `lib/api.ts` clear the stored tokens and send the browser to `/login`. The route does not check the new values against `lead_status_config`.

## 7. AI pipeline

A daily job feeds `ai_pipeline_jobs` from the feed URL and from company boards on Greenhouse, Lever and Ashby. Board jobs are kept only if the title is technical, the posting is at most 60 days old, and the role is remote and open to US candidates (US, US or Canada, worldwide, or a European posting that names the US). A job missing from two complete fetches of its board is closed; a failed or partial fetch never closes anything. People browse and rank the jobs, and accepting one creates a lead.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Arial, Helvetica, sans-serif','fontSize':'14px','primaryColor':'#EAF1FB','primaryBorderColor':'#2F5D9E','primaryTextColor':'#0F1F33','secondaryColor':'#F3F5F8','tertiaryColor':'#F7F9FC','lineColor':'#5B6B7F','textColor':'#0F1F33','clusterBkg':'#F6F8FB','clusterBorder':'#C3CDDA','edgeLabelBackground':'#FFFFFF','actorBkg':'#EAF1FB','actorBorder':'#2F5D9E','actorTextColor':'#0F1F33','actorLineColor':'#9AA8BA','signalColor':'#3B4A5E','signalTextColor':'#0F1F33','labelBoxBkgColor':'#EAF1FB','labelBoxBorderColor':'#2F5D9E','noteBkgColor':'#F3F5F8','noteBorderColor':'#9AA8BA','activationBkgColor':'#DCE7F7','sequenceNumberColor':'#FFFFFF','attributeBackgroundColorOdd':'#F6F8FB','attributeBackgroundColorEven':'#FFFFFF'},'flowchart':{'curve':'basis','padding':12}}}%%
flowchart TB
BEAT["Celery beat<br/>daily 06:00 UTC"] --> ING["ingest_daily<br/>run_daily_ingest"]
f1["JOB_FEED_URL<br/>(skipped when empty)"] --> FETCH
f2["Greenhouse boards<br/>GREENHOUSE_BOARDS list"] --> FETCH
PROBE["python -m app.pipeline.probe<br/>company names from leads,<br/>public endpoints only"] --> BOARDS[("pipeline_boards")]
ING --> FETCH["fetch_feed (httpx)"]
ING --> BF["ingest_boards<br/>Greenhouse, Lever, Ashby adapters"]
BOARDS --> BF
FETCH --> CLEAN["parse_feed, clean_job,<br/>technical-role filter,<br/>drop URLs already stored"]
BF --> ELIG["accept_job<br/>technical title, 60-day age cap,<br/>US-remote eligibility"]
CLEAN --> EMB{"embeddings enabled?<br/>LLM_EMBEDDING_MODEL + key"}
ELIG --> EMB
EMB -->|"yes"| VEC["embed_texts<br/>LLM_BASE_URL /embeddings"]
EMB -->|"no"| STORE
VEC --> STORE[("ai_pipeline_jobs")]
BF -->|"complete fetch only"| CLOSE["jobs missing twice<br/>get closed_at and drop out of lists"]
CLOSE --> STORE
STORE --> LIST["GET /ai-pipeline<br/>filters, hybrid rank:<br/>keyword overlap + cosine"]
LIST --> UI["ai-pipeline pages<br/>JobTechMatch"]
UI -->|"accept"| ACC["accept_job"]
ACC --> LEAD[("leads")]
ACC -.->|"stores lead_id"| STORE
classDef layer fill:#DCE7F7,stroke:#2F5D9E,stroke-width:1.5px,color:#0F1F33
classDef aux fill:#FFFFFF,stroke:#8794A5,color:#2B394B
classDef store fill:#E1F2EF,stroke:#1B7F73,stroke-width:1.5px,color:#0F1F33
classDef ext fill:#F1F3F6,stroke:#8794A5,stroke-dasharray:4 3,color:#2B394B
classDef actor fill:#1F3A5F,stroke:#1F3A5F,color:#FFFFFF
classDef warn fill:#FDECEA,stroke:#B3261E,stroke-dasharray:4 3,color:#7A1B15
class ING,FETCH,CLEAN,VEC,LIST,UI,ACC,BF,ELIG,CLOSE layer
class BEAT,PROBE aux
class f1,f2 ext
class STORE,LEAD,BOARDS store
```

Seed the board list once with `python -m app.pipeline.probe`. Without an embedding model the jobs are still stored and the page sorts by newest. The ai-pipeline routes allow Admin, Manager and BD.

## 8. Roles and permissions

Taken from `services/rbac.py`, the lead status route, and the role guards on the agents and ai-pipeline routes. A user must also be active and approved before any role applies.

| Capability | Admin | Manager | BD | Engineer |
|---|:-:|:-:|:-:|:-:|
| Manage users | Yes | Yes | No | No |
| Manage monthly targets | Yes | Yes | No | No |
| Manage profiles | Yes | Yes | No | No |
| View all leads | Yes | Yes | No | No |
| Create leads | Yes | Yes | Yes | No |
| Change lead status | Yes | Yes | No | No |
| Triage issues | Yes | Yes | No | No |
| Log issues | Yes | Yes | Yes | Yes |
| AI pipeline (browse, accept) | Yes | Yes | Yes | No |
| Agent: enrich lead | Yes | Yes | Yes | No |
| Agent: suggest status | Yes | Yes | No | Yes |

Managers have a type, `bd_manager` or `engineering_manager`. Accounts are `pending`, `approved` or `rejected`, and only approved accounts get past the guard. Admin routes, reports and calendar were not checked line by line, so they are left out of the table.

## 9. Deployment

Local development runs everything in Docker Compose. The production blueprint covers the API only: Render for the backend, Neon for Postgres, Vercel for the frontend.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Arial, Helvetica, sans-serif','fontSize':'14px','primaryColor':'#EAF1FB','primaryBorderColor':'#2F5D9E','primaryTextColor':'#0F1F33','secondaryColor':'#F3F5F8','tertiaryColor':'#F7F9FC','lineColor':'#5B6B7F','textColor':'#0F1F33','clusterBkg':'#F6F8FB','clusterBorder':'#C3CDDA','edgeLabelBackground':'#FFFFFF','actorBkg':'#EAF1FB','actorBorder':'#2F5D9E','actorTextColor':'#0F1F33','actorLineColor':'#9AA8BA','signalColor':'#3B4A5E','signalTextColor':'#0F1F33','labelBoxBkgColor':'#EAF1FB','labelBoxBorderColor':'#2F5D9E','noteBkgColor':'#F3F5F8','noteBorderColor':'#9AA8BA','activationBkgColor':'#DCE7F7','sequenceNumberColor':'#FFFFFF','attributeBackgroundColorOdd':'#F6F8FB','attributeBackgroundColorEven':'#FFFFFF'},'flowchart':{'curve':'basis','padding':12}}}%%
flowchart LR
subgraph LOCAL["Local: docker compose"]
  direction TB
  lf["frontend :3000<br/>yarn dev"] --> lb["backend :8000<br/>uvicorn --reload"]
  lb --> lp[("postgres :5433<br/>pgvector/pgvector:pg16")]
  lb --> lr[("redis :6379")]
  lc["celery worker --beat"] --> lr
  lc --> lp
end
subgraph PROD["Production (render.yaml)"]
  direction TB
  pv["Vercel<br/>Next.js frontend"] -->|"CORS: FRONTEND_URL,<br/>CORS_ORIGINS, *.vercel.app regex"| pr["Render free web service<br/>leadpro-backend<br/>health check /api/health"]
  pr --> pn[("Neon Postgres<br/>DATABASE_URL")]
  pr -.->|"optional"| px["SMTP, Google Calendar, LLM"]
  pw["Not deployed:<br/>Redis, Celery worker + beat"]
end
classDef layer fill:#DCE7F7,stroke:#2F5D9E,stroke-width:1.5px,color:#0F1F33
classDef aux fill:#FFFFFF,stroke:#8794A5,color:#2B394B
classDef store fill:#E1F2EF,stroke:#1B7F73,stroke-width:1.5px,color:#0F1F33
classDef ext fill:#F1F3F6,stroke:#8794A5,stroke-dasharray:4 3,color:#2B394B
classDef actor fill:#1F3A5F,stroke:#1F3A5F,color:#FFFFFF
classDef warn fill:#FDECEA,stroke:#B3261E,stroke-dasharray:4 3,color:#7A1B15
class lf,lb,lc,pv,pr layer
class lp,lr,pn store
class px ext
class pw warn
```

The backend `Dockerfile` is written to run on Render, Hugging Face Spaces, Koyeb, Fly.io or Railway and reads `$PORT`. The weekly report, monthly report and daily AI ingest all depend on Celery beat, so none of them run in production as the blueprint stands.

## 10. Suggestions

Ordered by risk. Each one comes from something seen in the code or config.

**High**

1. **Remove default secrets from production paths.** `jwt_secret` defaults to `change-me` and the seeded admin password to `admin123`. Demo accounts are in the README and on the login page, and `seed_database()` runs at every startup. Fail startup when the JWT secret is still the default, and gate the demo seed behind an environment flag.
2. **Fix token storage and the missing refresh flow.** Tokens sit in `localStorage`, which any script injection can read. The refresh token is stored but nothing in `lib/api.ts` uses it, so users are logged out after the 30 minute access token expires. Use httpOnly cookies, or add a silent refresh on 401.
3. **Replace startup DDL with Alembic.** `create_all` plus a list of `ALTER ... IF NOT EXISTS` statements runs on every boot. It cannot change a column or roll back, and two instances starting together race each other. `CREATE EXTENSION vector` is not wrapped, so a database without pgvector stops the whole API from starting. Run migrations as a release step.
4. **Give production a scheduler.** Add a Render background worker and a Redis instance, or call the report and ingest functions from Render cron jobs. Without that the weekly report, monthly report and AI ingest never run.

**Medium**

5. **Enforce status values and write audit entries.** Validate phase, type and status against `lead_status_config` in the status route, or add foreign keys. Call `log_audit` there too, since history rows and the audit log are separate today.
6. **Centralise authorization and tenant scoping.** Role checks are split between `require_roles`, inline checks and `rbac` helpers. `tenant_id` is nullable on users, leads and profiles. Move the rules into one policy module and confirm that every list query filters by tenant (not checked in this review).
7. **Thin the routes and split the big service.** `reports.py` is 623 lines, `leads.py` 565 and `services/ai_pipeline.py` 968. Move queries into services or repositories, and split the pipeline into fetch, clean, rank and accept modules.
8. **Add login protection and a real health check.** Rate-limit login, forgot-password and register. Make `/api/health` check the database (and Redis when present) as a readiness probe, and keep a plain liveness route.

**Low**

9. **Generate the API types.** Use the FastAPI OpenAPI schema to generate `types.ts` and a typed client, so the frontend and backend cannot drift.
10. **Cache the heavy report endpoints.** Redis is already running. Cache dashboard and engineer-funnel responses for a short time, and add pagination limits to the long resource reports.
11. **Repository hygiene.** The backend folder holds `venv`, `build`, `celerybeat-schedule` and an egg-info folder, and the root has `.venv` and `node_modules`. Make sure all of them are git-ignored.
12. **Features worth adding.** In-app and email notifications for assignments and status changes; a lead activity timeline that merges history, issues and calendar invites; duplicate-lead detection; an engineer to job match score on the AI pipeline using the embeddings already stored; and wiring the two agent stubs to the LLM.

# Lead Management Engine — Project Structure

A full-stack lead/recruitment pipeline app: **FastAPI + SQLAlchemy (async, Postgres)** backend and a **Next.js (App Router) + TypeScript + Tailwind** frontend. Roles: Admin, Manager (BD / Engineering), BD, Engineer.

```
lead-management-engine/
├── docker-compose.yml          # Local stack: Postgres, Redis, backend, frontend
├── README.md                   # Setup & run instructions
├── .env / .env.example         # Config: DB, JWT, SMTP, LLM (CV), Google Calendar
├── scripts/
│   ├── dev.sh                  # Dev convenience launcher
│   └── start.sh                # Start/boot script
│
├── backend/
│   ├── pyproject.toml          # Python deps (fastapi, sqlalchemy, google libs, pypdf…)
│   └── app/
│       ├── main.py             # FastAPI app: startup migrations, router wiring, CORS
│       ├── seed.py             # Base seed: admin/managers, status config, dropdowns, demo data
│       ├── seed_dummy.py       # Dummy data: 84 engineers, 60 BDs, 25k leads (python -m app.seed_dummy)
│       ├── seed_engineers.py   # Embedded engineer names + team leads (from the uploaded Excel)
│       │
│       ├── core/
│       │   ├── config.py       # Settings from .env (DB, JWT, SMTP, LLM_*, Google_*)
│       │   ├── database.py     # Async engine, session factory, Base, get_db dependency
│       │   ├── security.py     # Password hashing + JWT create/decode
│       │   └── enums.py        # Roles, ManagerType, ApprovalStatus, Issue/Report enums
│       │
│       ├── models/             # SQLAlchemy ORM tables
│       │   ├── user.py         # User, UserInvitation, AuditLog (+ team_lead_name, approval_comment)
│       │   ├── lead.py         # Lead, LeadStatusConfig, LeadDropdownOption, LeadStatusHistory
│       │   ├── profile.py      # Candidate Profile + MonthlyTarget
│       │   ├── issue.py        # Issue, IssueComment, ReportSnapshot (+ related_engineer_id)
│       │   ├── calendar.py     # GoogleCredential (OAuth tokens), CalendarInvite log
│       │   ├── auth_token.py   # AuthToken (email-confirm / reset), PasswordResetRequest
│       │   └── tenant.py       # Tenant (multi-tenant root)
│       │
│       ├── schemas/            # Pydantic request/response models
│       │   ├── user.py         # Auth, register, approval, reset, user CRUD schemas
│       │   ├── lead.py         # Lead create/update/status/response, dropdown/status-config
│       │   ├── profile.py      # Profile + monthly-target schemas
│       │   ├── issue.py        # Issue create/update/response + comments
│       │   ├── calendar.py     # Calendar status / invite schemas
│       │   ├── report.py       # Dashboard/weekly/monthly report schemas
│       │   └── bulk.py         # Bulk-update request/result
│       │
│       ├── api/
│       │   ├── deps.py         # get_current_user, require_roles (auth guards)
│       │   └── routes/
│       │       ├── auth.py         # Login, refresh, register (email/approval), confirm-email, forgot/reset password
│       │       ├── users.py        # User CRUD, engineers list, approvals, password-reset-requests, invites
│       │       ├── leads.py        # Lead CRUD, list/filter/multi-field search, status, history, CSV export, dropdowns
│       │       ├── profiles.py     # Profiles + monthly targets endpoints (+ multi-field search)
│       │       ├── issues.py       # Issue CRUD, comments, list (enum-safe filters), bulk update
│       │       ├── reports.py      # Dashboard, weekly, monthly, resource-leads, daily (per-BD), engineers (funnel + detail)
│       │       ├── teams.py        # Engineering/BD team listing + Excel import
│       │       ├── calendar.py     # Google Calendar OAuth connect + send interview invites
│       │       ├── cv.py           # CV/ATS: upload CV file + JD text → LLM analysis
│       │       ├── admin.py        # Status-config, audit log, Excel import/template
│       │       └── agents.py       # Lightweight lead-enrichment / status-suggestion agents
│       │
│       ├── services/           # Business logic (kept out of routes)
│       │   ├── users.py        # User lookups & display-name helpers
│       │   ├── tenant.py       # Tenant helpers + manager-type checks
│       │   ├── rbac.py         # Role/permission helpers
│       │   ├── audit.py        # log_audit() writer
│       │   ├── bulk_update.py  # Shared bulk-update for leads/issues/users
│       │   ├── import_excel.py # Parse Excel → leads/profiles/users; build templates
│       │   ├── email.py        # Best-effort SMTP sender + link-email template
│       │   ├── google_calendar.py # Google OAuth flow + create calendar events (lazy imports)
│       │   └── cv_ats.py       # File text extraction + OpenAI-compatible LLM call (Gemini/Ollama/OpenRouter/GLM)
│       │
│       ├── agents/base.py      # Base agent + enrichment/status/assignment stubs
│       └── tasks/
│           ├── celery_app.py   # Celery app config (Redis broker)
│           └── reports.py      # Scheduled report email task (smtplib)
│
└── frontend/
    ├── package.json / tsconfig / tailwind.config   # Build config
    ├── app/                    # Next.js App Router (routes = folders)
    │   ├── layout.tsx          # Root HTML layout
    │   ├── login/page.tsx      # Login + "forgot password" link + demo accounts
    │   ├── register/page.tsx   # Self-register (email-confirm or admin-approval)
    │   ├── register/bd/page.tsx# Legacy BD-only registration
    │   ├── confirm-email/[token]/page.tsx  # Email confirmation → auto-login
    │   ├── forgot-password/page.tsx        # Request password reset
    │   ├── reset-password/[token]/page.tsx # Set a new password via emailed link
    │   ├── invite/[token]/page.tsx         # Accept an admin invite
    │   └── (app)/              # Authenticated area (shares sidebar layout)
    │       ├── layout.tsx      # App shell: sidebar + topbar + auth gate
    │       ├── dashboard/page.tsx        # KPIs + pipeline charts
    │       ├── leads/page.tsx            # Leads table: multi-field + per-column search, filters, bulk, export, pagination
    │       ├── leads/new/page.tsx        # Create lead (searchable engineer, creatable source/phase/type)
    │       ├── leads/[id]/page.tsx       # Lead detail: status editor (mgr only), issues, JD toggle
    │       ├── issues/page.tsx           # Issues list + filters + detail panel
    │       ├── issues/new/page.tsx       # Log issue (regarding-engineer dropdown)
    │       ├── profiles/page.tsx         # Candidate profiles list + search
    │       ├── profiles/[id]/page.tsx    # Profile detail
    │       ├── monthly-targets/page.tsx  # Engineer lead quotas
    │       ├── reports/page.tsx          # Reports: BD Reports vs Engineers Report groups
    │       ├── calendar/page.tsx         # Connect Google + send interview invites
    │       ├── cv/page.tsx               # CV Optimizer: paste JD + upload CV → ATS analysis
    │       ├── teams/…                   # Engineering / BD team pages
    │       ├── profile/page.tsx          # Own account settings / change password
    │       └── admin/…                   # users, import, status-config, audit, settings
    │
    ├── components/             # Reusable UI
    │   ├── ui/index.tsx        # Design system: Button, Card, Input, Select, Modal, Badge, Tabs, Spinner, cn…
    │   ├── Sidebar.tsx / TopBar.tsx / PageHeader.tsx   # App chrome
    │   ├── SortableTable.tsx / LeadsTable.tsx / IssuesTable.tsx / ProfilesTable.tsx / AdminUsersTable.tsx / MonthlyTargetsTable.tsx  # Tables
    │   ├── FilterPanel.tsx / BulkActionBar.tsx / BulkUpdateModal.tsx   # Filtering & bulk edit
    │   ├── SearchableSelect.tsx      # Type-to-filter combobox (engineer pickers)
    │   ├── CreatableSelect.tsx       # Dropdown that can add new options (source/phase/type)
    │   ├── LeadStatusEditor.tsx / LeadIssueReporter.tsx   # Lead status change + issue reporting
    │   ├── Charts.tsx / ChartsLazy.tsx / MultiChart.tsx / KpiCard.tsx   # Recharts widgets + type switcher
    │   ├── DailyReport.tsx           # Per-BD daily report (leads, platforms, engineer)
    │   ├── EngineerReport.tsx        # Engineer funnel + clickable per-tech detail modal
    │   ├── ResourceLeadsReport.tsx   # Per-resource (BD/engineer) lead names + team lead
    │   └── TeamsView.tsx             # Team member tables + search + import
    │
    ├── hooks/
    │   ├── useBulkSelect.ts    # Row selection state for bulk actions
    │   └── useTableView.ts     # Column order / sort persistence
    │
    └── lib/                    # Client utilities
        ├── api.ts             # fetch wrapper (auth headers, 401 handling), file upload/download
        ├── types.ts          # Shared TypeScript interfaces (Lead, User, Issue, Profile…)
        ├── csv.ts            # Client-side CSV export helper
        ├── tableUtils.ts     # Sorting/column helpers + COL_MIN widths
        ├── engineer.ts       # Engineer display-label helper
        └── format.tsx        # Date/number formatting (ClientDate)
```

## Request flow (how a feature is wired end-to-end)

```
UI page (app/(app)/…)  →  lib/api.ts fetch  →  FastAPI route (api/routes/…)
   → require_roles guard (api/deps.py)  →  service (services/…) / ORM model (models/…)
   → Pydantic schema (schemas/…) validates in & out  →  JSON back to the page
```

- **Auth:** JWT issued in `routes/auth.py`, verified by `api/deps.py` on every request.
- **DB migrations:** `main.py` runs `create_all` + `ALTER … IF NOT EXISTS` on startup (no Alembic).
- **LLM (CV):** `services/cv_ats.py` calls any OpenAI-compatible endpoint set via `LLM_BASE_URL`/`LLM_MODEL`/`LLM_API_KEY`.
```

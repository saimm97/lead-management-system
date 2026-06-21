from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from app.api.routes import admin, agents, auth, issues, leads, reports, teams, users
from app.api.routes.profiles import profiles_router, targets_router
from app.core.database import Base, engine
from app.models import tenant  # noqa: F401
from app.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS devsinc_id VARCHAR(50)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_type VARCHAR(50)"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS cluster_head_id INTEGER REFERENCES users(id)"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS interview_number VARCHAR(50)"))
        await conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS interview_round VARCHAR(100)"))
        await conn.execute(text("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)"))
    await seed_database()
    yield


app = FastAPI(title="LeadPro API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(profiles_router, prefix="/api")
app.include_router(targets_router, prefix="/api")
app.include_router(issues.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(teams.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(agents.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}

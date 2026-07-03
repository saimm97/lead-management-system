# Deploying LeadPro (free stack)

**Frontend → Vercel · Database → Neon · Backend → Render** (all have a real free tier).

---

## 1. Database — Neon (free Postgres)

1. Create an account at neon.tech → **New Project**.
2. Copy the **pooled** connection string (looks like `postgres://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require`).
   - Paste it as-is — the backend auto-converts it to the async `asyncpg` driver and handles `sslmode`.

## 2. Backend — Render (free web service)

**Option A — Blueprint (one click):** push this repo, then Render → **New → Blueprint** → select the repo. It reads [`render.yaml`](./render.yaml). Fill the `sync: false` env vars when prompted.

**Option B — Manual:** Render → **New → Web Service** → connect repo:
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/api/health`
- Instance type: **Free**

**Environment variables (Render dashboard):**
| Key | Value |
|-----|-------|
| `DATABASE_URL` | your Neon pooled URL |
| `JWT_SECRET` | any long random string |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first admin login |
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `CORS_ORIGINS` | `https://your-app.vercel.app` |
| `CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` (optional, for previews) |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | optional (CV Optimizer) |

On first boot the app auto-creates tables and seeds the admin user. Note: the free service **sleeps after ~15 min idle** (first request then takes ~50s).

## 3. Frontend — Vercel

1. Vercel → **New Project** → import the repo.
2. **Root Directory: `frontend`** (important — it's a monorepo).
3. Environment variable: `NEXT_PUBLIC_API_URL = https://your-service.onrender.com`
4. Deploy. Add your Vercel domain to the backend's `CORS_ORIGINS` and redeploy the backend.

---

## Alternative backends (also free) — use the Docker image

[`backend/Dockerfile`](./backend/Dockerfile) builds a portable image.

- **Hugging Face Spaces** → New Space → **Docker** SDK → push repo. Set the Space port to `8000` (add `app_port: 8000` to the Space README metadata, or set `PORT=7860`). 2 CPU / 16 GB free; sleeps after 48h idle.
- **Koyeb** → New Service → Docker/GitHub → free tier (1 service, scale-to-zero).
- **Fly.io** → `fly launch` in `backend/` (uses the Dockerfile).

All of them read `$PORT` and the same env vars listed above.

## Seed dummy data (optional)

After the DB is reachable, run once from the backend:
```
python -m app.seed_dummy      # 84 engineers, 60 BDs, 25,000 leads (password: leadpro)
```
On Render you can run this from the service **Shell** tab.

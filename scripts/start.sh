#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Starting Postgres (port 5433)..."
docker compose up -d postgres
sleep 2

echo "==> Setting up backend..."
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q .
fi

# Pick backend port: prefer 8000, fall back to 8001
BACKEND_PORT=8000
if lsof -i :8000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "    Port 8000 busy, using 8001"
  BACKEND_PORT=8001
fi

# Kill previous LeadPro backend on same port
pkill -f "uvicorn app.main:app.*--port $BACKEND_PORT" 2>/dev/null || true
sleep 1

echo "==> Starting backend on http://localhost:$BACKEND_PORT ..."
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!

echo "==> Setting up frontend..."
cd "$ROOT/frontend"
yarn install --silent 2>/dev/null || yarn install

export NEXT_PUBLIC_API_URL="http://localhost:$BACKEND_PORT"
echo "==> Starting frontend on http://localhost:3000 (API: $NEXT_PUBLIC_API_URL) ..."
yarn dev &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "  LeadPro is running!"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:$BACKEND_PORT"
echo "  API Docs:  http://localhost:$BACKEND_PORT/docs"
echo ""
echo "  Login: admin@leadpro.com / admin123"
echo "============================================"
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait

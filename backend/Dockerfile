# LeadPro backend container — works on Hugging Face Spaces (Docker), Koyeb, Fly.io, Railway, Render.
# Build context = the backend/ folder.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install deps first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Most platforms inject $PORT (Render/Koyeb/Fly). HF Spaces expects 7860 — set PORT=7860
# in the Space settings (or add `app_port: 8000` to the Space README metadata).
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

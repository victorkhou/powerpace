# Coach sidecar image. Deployable to any container host (Railway, Render, Fly,
# Cloud Run). The Next.js app reaches it over HTTPS via COACH_SERVICE_URL.
#
# Trust model reminder: this container holds SUPABASE_SERVICE_ROLE_KEY (bypasses
# RLS), so it MUST require COACH_SHARED_SECRET in production. main.py refuses to
# start without one unless COACH_ENV=development, which we deliberately do not
# set here.
FROM python:3.12-slim

# Faster, quieter installs; no .pyc clutter; unbuffered logs so platform log
# tailing shows output immediately.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install deps first so layer caching survives app-code edits.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code only — .dockerignore keeps .env, tests, and caches out of the image.
COPY app/ ./app/

# Run as a non-root user; nothing here needs write access to the filesystem.
RUN useradd --create-home --shell /usr/sbin/nologin coach \
    && chown -R coach:coach /app
USER coach

# Hosts inject the port to listen on (Railway/Render/Cloud Run all set $PORT).
# Bind 0.0.0.0 — inside a container, 127.0.0.1 is unreachable from the outside.
ENV PORT=8000
EXPOSE 8000

# Shell form so ${PORT} expands at runtime rather than being passed literally.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}

# Backend image. Build context is this directory (backend/), so set the service
# root directory to `backend` on the host - the repository root holds the Vite
# frontend, which this image must not pull in.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first, so a code change does not reinstall them. The lock file is
# used rather than the range file, so a deployed build matches what was tested.
COPY requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt

# db/ is required at runtime: the startup bootstrap reads schema.sql and
# seed.sql from it. examples/ and templates/ back the example and template
# endpoints. uploads/ and tests/ are deliberately left out.
COPY app ./app
COPY db ./db
COPY engines ./engines
COPY parsers ./parsers
COPY examples ./examples
COPY templates ./templates

# Run unprivileged. Nothing in the image is written to at runtime.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# PORT is supplied by the host; 8000 is the local default. Shell form so the
# variable is expanded. One worker: the process is I/O bound and the host scales
# by replica, and a single worker keeps the startup bootstrap simple.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]

"""Same-origin Vercel function, using the existing FastAPI contracts."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
# Serverless requests must not apply schema/seed migrations on cold starts.
# A separately provisioned database may still be configured explicitly.
os.environ.setdefault("DB_BOOTSTRAP", "off")

from app.main import app  # noqa: E402, F401

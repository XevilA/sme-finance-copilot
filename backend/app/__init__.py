"""SME SWARM backend calculation services.

Loads backend/.env before any submodule reads os.getenv, so DATABASE_URL,
DB_POOL and CORS_ORIGINS can live in a file instead of being exported by hand
in every shell. Real environment variables always win over the file.
"""

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

"""Run the complete backend suite against a disposable local PostgreSQL DB.

This runner deliberately overrides DATABASE_URL with a loopback-only test DSN,
disables application bootstrap (the container loads schema and synthetic seeds),
and tears down the temporary database after pytest exits. It never reads the
database URL from backend/.env and cannot target a remote database.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
COMPOSE_FILE = ROOT / "backend" / "docker-compose.test.yml"
DATABASE_URL = "postgresql+asyncpg://postgres@127.0.0.1:55432/sme_swarm_test"
COMPOSE = ["docker", "compose", "-p", "sme-finance-pytest", "-f", str(COMPOSE_FILE)]


def run(command: list[str], *, env: dict[str, str] | None = None, check: bool = True) -> int:
    result = subprocess.run(command, cwd=ROOT, env=env, check=False)
    if check and result.returncode:
        raise subprocess.CalledProcessError(result.returncode, command)
    return result.returncode


def main() -> int:
    if shutil.which("docker") is None:
        print("Docker CLI was not found. Install Docker Desktop/Engine and retry.", file=sys.stderr)
        return 2

    env = os.environ.copy()
    # These explicit values take precedence over backend/.env. The runner only
    # connects to the isolated database published on the local loopback port.
    env.update(
        {
            "DATABASE_URL": DATABASE_URL,
            "DB_BOOTSTRAP": "off",
            "DB_POOL": "null",
            "OPENAI_API_KEY": "",
            "OPENAI_MODEL": "",
            "AUTH_DEV_HEADER": "false",
        }
    )

    start_attempted = False
    test_result = 2
    try:
        start_attempted = True
        run([*COMPOSE, "up", "-d", "--wait"])
        test_result = run(
            [sys.executable, "-m", "pytest", "-c", "backend/pytest.ini", "-q", *sys.argv[1:]],
            env=env,
            check=False,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"Could not start the disposable PostgreSQL test service: {exc}", file=sys.stderr)
        return getattr(exc, "returncode", 2) or 2
    finally:
        if start_attempted:
            cleanup_result = run([*COMPOSE, "down", "--remove-orphans"], check=False)
            if cleanup_result:
                print("Warning: Docker Compose could not remove the temporary test container.", file=sys.stderr)

    return test_result


if __name__ == "__main__":
    raise SystemExit(main())

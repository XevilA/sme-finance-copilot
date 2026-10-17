"""Isolated HTTP auth acceptance with ephemeral secret and synthetic actors.

Does not change backend/.env, the demo server, existing credentials or RBAC
enforcement. Starts its own short-lived local server, then removes its own users.
"""

import argparse
import asyncio
import os
import secrets
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx
from sqlalchemy import delete, select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.db import session_scope
from app.models import RevokedToken, User
from app.security import hash_password


def db(operation):
    async def run():
        async with session_scope() as session:
            return await operation(session)
    return asyncio.run(run())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8016)
    args = parser.parse_args()
    ids = [uuid.uuid4(), uuid.uuid4()]
    password = secrets.token_urlsafe(32)
    emails = [f"synthetic-auth-{identifier.hex}@example.test" for identifier in ids]
    async def create(session):
        for identifier, email, role in zip(ids, emails, ["analyst", "admin"]):
            session.add(User(id=identifier, email=email, full_name="Synthetic HTTP auth fixture",
                             role=role, password_hash=hash_password(password), active=True))
    db(create)
    server = None
    try:
        async def read_actor(session):
            assert (await session.get(User, ids[0])).password_hash is not None
        db(read_actor)
        env = {**os.environ, "AUTH_SECRET": secrets.token_urlsafe(48), "RBAC_ENFORCED": "false",
               "AUTH_DEV_HEADER": "false", "DB_BOOTSTRAP": "off"}
        # This is a dedicated verification server. Normal demo startup remains
        # backend/run.cmd with backend/.env; no persistent auth config is changed.
        server = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--app-dir", str(ROOT),
            "--host", "127.0.0.1", "--port", str(args.port)], env=env, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        with httpx.Client(base_url=f"http://127.0.0.1:{args.port}", timeout=10) as client:
            for attempt in range(100):
                if server.poll() is not None:
                    raise RuntimeError("Isolated auth server exited during startup")
                try:
                    health = client.get("/health")
                    if health.status_code == 200:
                        break
                except httpx.ConnectError:
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Isolated auth server did not become ready")
            assert health.json()["auth"]["enforced"] is False
            assert health.json()["auth"]["secretConfigured"] is True
            def login(email):
                response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
                response.raise_for_status()
                return {"Authorization": "Bearer " + response.json()["data"]["accessToken"], "Origin": "http://localhost:5173"}
            first, second, third, admin = login(emails[0]), login(emails[0]), login(emails[0]), login(emails[1])
            preflight = client.options("/api/v1/auth/logout", headers={"Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
            assert preflight.status_code == 200
            assert preflight.headers["access-control-allow-origin"] == "http://localhost:5173"
            # /me explicitly reports anonymous while demo enforcement is off.
            assert client.get("/api/v1/auth/me", headers=first).json()["data"]["authenticated"] is False
            assert client.post("/api/v1/auth/revoke", headers=first, json={"email": emails[1]}).status_code == 403
            assert client.post("/api/v1/auth/logout", headers=first).status_code == 200
            assert client.post("/api/v1/auth/logout", headers=first).status_code == 401
            async def read_logout(session):
                rows = (await session.scalars(select(RevokedToken).where(RevokedToken.user_id == ids[0]))).all()
                assert len(rows) == 1 and rows[0].reason == "logout"
            db(read_logout)
            assert client.post("/api/v1/auth/revoke-all", headers=second).status_code == 200
            assert client.post("/api/v1/auth/logout", headers=third).status_code == 401
            async def read_cutoff(session):
                assert (await session.get(User, ids[0])).tokens_valid_from is not None
            db(read_cutoff)
            assert client.post("/api/v1/auth/revoke", headers=admin, json={"email": emails[0]}).status_code == 200
            db(read_cutoff)
            assert client.post("/api/v1/auth/logout").status_code == 401
            print("HTTP auth + DB read-back passed: synthetic login, Authorization CORS, logout/repeat 401, revoke-all, admin/analyst 403. Demo enforcement unchanged=false.")
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
        async def cleanup(session):
            await session.execute(delete(User).where(User.id.in_(ids)))
        db(cleanup)


if __name__ == "__main__":
    main()

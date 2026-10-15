"""Sets the password for an existing user.

Passwords are set here rather than seeded, so no credential is ever committed
to the repository.

    python backend/scripts/set_password.py owner@baansuan.test
    python backend/scripts/set_password.py owner@baansuan.test --generate

The password is read from a prompt that does not echo, or generated and printed
once. It is never taken from a command-line argument, because that would land
in the shell history and the process list.
"""

import argparse
import asyncio
import getpass
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.db import DB_ENABLED, session_scope  # noqa: E402
from app.models import User  # noqa: E402
from app.security import hash_password  # noqa: E402

MIN_LENGTH = 8


async def set_password(email: str, password: str) -> bool:
    async with session_scope() as session:
        if session is None:
            return False
        user = await session.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None:
            return False
        user.password_hash = hash_password(password)
        return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Set a user password")
    parser.add_argument("email")
    parser.add_argument(
        "--generate", action="store_true",
        help="generate a strong password and print it once instead of prompting",
    )
    args = parser.parse_args()

    if not DB_ENABLED:
        print("DATABASE_URL is not set, so there is no user table to update.", file=sys.stderr)
        return 2

    if args.generate:
        password = secrets.token_urlsafe(18)
    else:
        password = getpass.getpass("New password: ")
        if password != getpass.getpass("Repeat password: "):
            print("Passwords do not match.", file=sys.stderr)
            return 2

    if len(password) < MIN_LENGTH:
        print(f"Password must be at least {MIN_LENGTH} characters.", file=sys.stderr)
        return 2

    if not asyncio.run(set_password(args.email, password)):
        print(f"No user with email {args.email}.", file=sys.stderr)
        return 1

    print(f"Password set for {args.email}.")
    if args.generate:
        # Printed once, on purpose: there is no way to read it back later.
        print(f"Generated password: {password}")
        print("Store it in your password manager now; it is not recoverable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

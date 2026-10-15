"""Password hashing and signed access tokens.

This replaces the `X-User-Email` header, which carried no proof of anything,
with a token the server signed and can verify.

Two deliberate choices, both to keep the attack surface small rather than to be
clever:

**Not JWT.** The token is `base64url(payload).base64url(mac)` with one fixed
algorithm and no header. There is no `alg` field taken from the input, so the
algorithm-confusion class of JWT bug cannot exist here. This is HMAC-SHA256
composed in the simplest way, the way Django's signer and itsdangerous do it -
not a new primitive.

**scrypt, from the standard library.** Memory-hard, so it resists the GPU
attack that makes a plain hash useless for passwords, and it needs no extra
dependency. bcrypt or argon2 would be equally fine but would add one.

The signing secret is never defaulted. Without AUTH_SECRET no token can be
issued or accepted, because a known default secret is the same as no signature
at all.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

# scrypt parameters. 128 * n * r bytes per hash, so n=2**14 with r=8 is 16 MiB
# and a few tens of milliseconds: slow for an attacker, unnoticeable on a login,
# and small enough that a burst of logins will not exhaust a 512 MiB container.
# OpenSSL caps scrypt memory at 32 MiB unless told otherwise, so maxmem is set
# explicitly rather than left to a platform default.
SCRYPT_N = 2 ** 14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32
SCRYPT_MAXMEM = 64 * 1024 * 1024
SALT_BYTES = 16

MIN_SECRET_LENGTH = 32
DEFAULT_TTL_SECONDS = 12 * 60 * 60

TOKEN_VERSION = "v1"


class AuthConfigError(RuntimeError):
    """Raised when authentication is asked for but cannot be done safely."""


def auth_secret() -> str:
    """The signing secret, or a refusal. Never falls back to a default."""
    secret = os.getenv("AUTH_SECRET", "").strip()
    if not secret:
        raise AuthConfigError("AUTH_SECRET is not set, so tokens cannot be signed or verified")
    if len(secret) < MIN_SECRET_LENGTH:
        raise AuthConfigError(
            f"AUTH_SECRET must be at least {MIN_SECRET_LENGTH} characters; a guessable secret is no signature"
        )
    return secret


def secret_configured() -> bool:
    try:
        auth_secret()
    except AuthConfigError:
        return False
    return True


def token_ttl_seconds() -> int:
    raw = os.getenv("AUTH_TOKEN_TTL_SECONDS", "").strip()
    if not raw.isdigit():
        return DEFAULT_TTL_SECONDS
    # Clamp: a token that lives for months is a credential nobody can revoke.
    return max(60, min(int(raw), 7 * 24 * 60 * 60))


# --- passwords ---------------------------------------------------------------

def hash_password(password: str) -> str:
    """Returns `scrypt$n$r$p$salt$hash`, all base64url, salt generated per call."""
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    salt = secrets.token_bytes(SALT_BYTES)
    derived = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P,
        dklen=SCRYPT_DKLEN, maxmem=SCRYPT_MAXMEM,
    )
    return "$".join([
        "scrypt", str(SCRYPT_N), str(SCRYPT_R), str(SCRYPT_P),
        _b64(salt), _b64(derived),
    ])


def verify_password(password: str, stored: str | None) -> bool:
    """Constant-time check. A user with no password set can never authenticate."""
    if not password or not stored:
        return False
    try:
        scheme, n, r, p, salt_b64, hash_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        # Parameters come from the stored record, so a hash written with older
        # settings still verifies. Bounded first: a crafted record must not be
        # able to ask for an unbounded allocation.
        n, r, p = int(n), int(r), int(p)
        if 128 * n * r * p > SCRYPT_MAXMEM:
            return False
        derived = hashlib.scrypt(
            password.encode("utf-8"), salt=_unb64(salt_b64),
            n=n, r=r, p=p, dklen=len(_unb64(hash_b64)), maxmem=SCRYPT_MAXMEM,
        )
    except (ValueError, TypeError, MemoryError):
        return False
    return hmac.compare_digest(derived, _unb64(hash_b64))


# --- tokens ------------------------------------------------------------------

def issue_token(
    *,
    user_id: str,
    email: str,
    role: str,
    sme_id: str | None = None,
    investor_id: str | None = None,
    ttl_seconds: int | None = None,
) -> tuple[str, int]:
    """Returns (token, expires_at). Raises AuthConfigError without a secret."""
    secret = auth_secret()
    now = int(time.time())
    expires = now + (ttl_seconds or token_ttl_seconds())
    payload = {
        "v": TOKEN_VERSION,
        "sub": user_id,
        "email": email,
        "role": role,
        "sme_id": sme_id,
        "investor_id": investor_id,
        "iat": now,
        "exp": expires,
    }
    body = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    return f"{body}.{_b64(_mac(secret, body))}", expires


class TokenError(Exception):
    """Token missing, malformed, wrongly signed or expired. No detail leaks."""


def read_token(token: str) -> dict:
    """Verifies the signature before parsing anything out of the payload."""
    secret = auth_secret()
    if not token or token.count(".") != 1:
        raise TokenError("malformed")

    body, signature = token.split(".")
    expected = _mac(secret, body)
    try:
        provided = _unb64(signature)
    except (ValueError, TypeError):
        raise TokenError("malformed") from None
    # Compared before the payload is decoded, so unverified bytes are never parsed.
    if not hmac.compare_digest(expected, provided):
        raise TokenError("bad signature")

    try:
        payload = json.loads(_unb64(body))
    except (ValueError, TypeError):
        raise TokenError("malformed") from None
    if not isinstance(payload, dict) or payload.get("v") != TOKEN_VERSION:
        raise TokenError("unsupported version")
    if not payload.get("sub") or not payload.get("role"):
        raise TokenError("incomplete")

    expires = payload.get("exp")
    if not isinstance(expires, int) or expires <= int(time.time()):
        raise TokenError("expired")
    return payload


# --- helpers -----------------------------------------------------------------

def _mac(secret: str, body: str) -> bytes:
    return hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)

"""Short-lived bearer tokens for direct browser -> sidecar calls.

Counterpart to src/lib/coach-token.ts — the two MUST stay in sync.

Why: AWS Amplify's SSR Lambda kills requests at ~30s while a multi-tool coach
turn can take ~50s, so proxying every turn through the web app is not viable.
The browser calls this service directly instead. It cannot be given
COACH_SHARED_SECRET (that would let any holder impersonate any user_id against a
service that bypasses RLS), so the web app mints a token bound to ONE user id
with a few minutes of validity, signed with the shared secret. A leaked token
exposes only that user's own data, and only briefly.

Format: base64url(payload) + "." + base64url(hmac_sha256(payload))
Payload: "<user_id>:<expires_at_unix_seconds>"
"""
import base64
import hashlib
import hmac
import time


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _sign(payload: str, secret: str) -> str:
    mac = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()
    return _b64url_encode(mac)


def verify_coach_token(token: str, secret: str, now: float | None = None) -> str | None:
    """Return the token's user_id, or None if malformed / tampered / expired."""
    if not token or not secret:
        return None
    parts = token.split(".")
    if len(parts) != 2:
        return None
    payload_b64, sig = parts

    try:
        payload = _b64url_decode(payload_b64).decode()
    except Exception:
        return None

    # Constant-time comparison; hmac.compare_digest handles length mismatch.
    if not hmac.compare_digest(sig, _sign(payload, secret)):
        return None

    sep = payload.rfind(":")
    if sep <= 0:
        return None
    user_id = payload[:sep]
    try:
        exp = int(payload[sep + 1:])
    except ValueError:
        return None

    current = time.time() if now is None else now
    if not user_id or exp <= current:
        return None
    return user_id


def mint_coach_token(user_id: str, secret: str, ttl_seconds: int = 300,
                     now: float | None = None) -> str:
    """Mint a token. Used by tests; production minting happens in the web app."""
    current = time.time() if now is None else now
    payload = f"{user_id}:{int(current) + ttl_seconds}"
    return f"{_b64url_encode(payload.encode())}.{_sign(payload, secret)}"

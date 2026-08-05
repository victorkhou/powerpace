"""Tests for the browser bearer-token scheme.

These are security tests: the token is what lets a browser call a service that
holds the Supabase service-role key. A forged or expired token must never
validate, and the user_id must come from the signed payload only.
"""
import time

from app.tokens import mint_coach_token, verify_coach_token

SECRET = "test-secret-value"
USER = "bbddb3a9-bb65-4f74-a60e-e485f12b1874"


def test_roundtrip_returns_user_id():
    t = mint_coach_token(USER, SECRET)
    assert verify_coach_token(t, SECRET) == USER


def test_rejects_wrong_secret():
    t = mint_coach_token(USER, SECRET)
    assert verify_coach_token(t, "different-secret") is None


def test_rejects_expired_token():
    # Minted 10 minutes ago with a 5 minute TTL.
    past = time.time() - 600
    t = mint_coach_token(USER, SECRET, ttl_seconds=300, now=past)
    assert verify_coach_token(t, SECRET) is None


def test_accepts_token_still_within_ttl():
    t = mint_coach_token(USER, SECRET, ttl_seconds=300, now=time.time() - 60)
    assert verify_coach_token(t, SECRET) == USER


def test_rejects_tampered_payload():
    # Swap the payload for a different user while keeping the original signature.
    t = mint_coach_token(USER, SECRET)
    _payload, sig = t.split(".")
    forged_payload = mint_coach_token("attacker-user-id", SECRET).split(".")[0]
    assert verify_coach_token(f"{forged_payload}.{sig}", SECRET) is None


def test_rejects_malformed_tokens():
    for bad in ["", "nodot", "a.b.c", ".", "abc.", ".abc", "!!!.???"]:
        assert verify_coach_token(bad, SECRET) is None, bad


def test_rejects_when_secret_missing():
    t = mint_coach_token(USER, SECRET)
    assert verify_coach_token(t, "") is None


def test_user_id_containing_colons_survives_roundtrip():
    # Payload is "<user>:<exp>" and we split on the LAST colon, so a user id
    # with colons must still parse correctly.
    weird = "tenant:abc:123"
    t = mint_coach_token(weird, SECRET)
    assert verify_coach_token(t, SECRET) == weird

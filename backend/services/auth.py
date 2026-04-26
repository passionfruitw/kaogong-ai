"""Simple environment-based authentication."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Dict


AUTH_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", str(7 * 24 * 60 * 60)))


def _get_secret() -> str:
    return os.getenv("AUTH_SECRET") or os.getenv("DEEPSEEK_API_KEY") or "change-me"


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def parse_auth_users() -> Dict[str, str]:
    raw = os.getenv("AUTH_USERS", "")
    users: Dict[str, str] = {}

    for item in raw.replace("\n", ",").replace(";", ",").split(","):
        if not item.strip() or ":" not in item:
            continue
        username, password = item.split(":", 1)
        username = username.strip()
        password = password.strip()
        if username and password:
            users[username] = password

    return users


def authenticate(username: str, password: str) -> bool:
    expected = parse_auth_users().get(username)
    if not expected:
        return False
    return secrets.compare_digest(expected, password)


def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": int(time.time()) + AUTH_TOKEN_TTL_SECONDS,
    }
    payload_text = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
    payload_part = _b64encode(payload_text.encode("utf-8"))
    signature = hmac.new(
        _get_secret().encode("utf-8"),
        payload_part.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return f"{payload_part}.{_b64encode(signature)}"


def verify_token(token: str) -> str:
    try:
        payload_part, signature_part = token.split(".", 1)
        expected_signature = hmac.new(
            _get_secret().encode("utf-8"),
            payload_part.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        actual_signature = _b64decode(signature_part)
        if not hmac.compare_digest(expected_signature, actual_signature):
            return ""

        payload = json.loads(_b64decode(payload_part).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return ""
        return str(payload.get("sub", ""))
    except Exception:
        return ""

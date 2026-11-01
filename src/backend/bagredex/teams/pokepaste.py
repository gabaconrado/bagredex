"""Narrow, bounded retrieval of public PokéPaste team text."""

from __future__ import annotations

import math
import re
import time
from collections.abc import Callable
from email.message import Message
from http.client import HTTPException, HTTPResponse
from typing import IO, Any, cast
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.contrib.sessions.backends.base import SessionBase
from django.contrib.sessions.models import Session
from django.db import transaction

POKEPASTE_SCHEMA = "pokepaste-import-v1"
POKEPASTE_MAX_BYTES = 32_000
POKEPASTE_TIMEOUT_SECONDS = 3.0
POKEPASTE_ATTEMPT_LIMIT = 5
POKEPASTE_ATTEMPT_WINDOW_SECONDS = 60

_CANONICAL_URL = re.compile(r"https://pokepast\.es/([0-9a-f]{16})\Z")
_SESSION_ATTEMPTS_KEY = "pokepaste_fetch_attempts"


class PokePasteFetchError(Exception):
    """A stable, non-sensitive failure suitable for the local JSON boundary."""

    def __init__(self, code: str, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


class _NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(
        self,
        req: Request,
        fp: IO[bytes],
        code: int,
        msg: str,
        headers: Message,
        newurl: str,
    ) -> None:
        return None


_OPENER = build_opener(_NoRedirectHandler())


def parse_pokepaste_url(value: object) -> str:
    """Return the paste ID only when the complete value is canonical."""
    if not isinstance(value, str):
        raise PokePasteFetchError("invalid-url", "Enter one canonical PokéPaste URL.", 400)
    match = _CANONICAL_URL.fullmatch(value)
    if match is None:
        raise PokePasteFetchError("invalid-url", "Enter one canonical PokéPaste URL.", 400)
    return match.group(1)


def _open_request(request: Request, timeout: float) -> HTTPResponse:
    return _OPENER.open(request, timeout=timeout)  # type: ignore[no-any-return]


def fetch_pokepaste(
    url: object,
    *,
    open_request: Callable[[Request, float], Any] = _open_request,
) -> str:
    """Fetch one validated raw paste through a fixed, bounded HTTPS request."""
    paste_id = parse_pokepaste_url(url)
    request = Request(
        f"https://pokepast.es/{paste_id}/raw",
        headers={
            "Accept": "text/plain",
            "Accept-Encoding": "identity",
            "User-Agent": "Bagredex/1 PokepasteImporter",
        },
        method="GET",
    )
    try:
        with open_request(request, POKEPASTE_TIMEOUT_SECONDS) as response:
            status = response.status
            if status != 200:
                raise _status_error(status)
            content_type = response.headers.get("Content-Type", "")
            media_type = content_type.partition(";")[0].strip().lower()
            if media_type != "text/plain":
                raise PokePasteFetchError(
                    "invalid-content",
                    "PokéPaste returned content that cannot be imported.",
                    502,
                )
            body = cast(bytes, response.read(POKEPASTE_MAX_BYTES + 1))
    except PokePasteFetchError:
        raise
    except HTTPError as error:
        mapped = _status_error(error.code)
        error.close()
        raise mapped from None
    except TimeoutError:
        raise PokePasteFetchError(
            "timeout", "PokéPaste did not respond in time. Try again.", 504
        ) from None
    except URLError as error:
        if isinstance(error.reason, TimeoutError):
            raise PokePasteFetchError(
                "timeout", "PokéPaste did not respond in time. Try again.", 504
            ) from None
        raise PokePasteFetchError(
            "upstream-unavailable", "PokéPaste is unavailable. Try again later.", 502
        ) from None
    except OSError:
        raise PokePasteFetchError(
            "upstream-unavailable", "PokéPaste is unavailable. Try again later.", 502
        ) from None
    except HTTPException:
        raise PokePasteFetchError(
            "upstream-unavailable", "PokéPaste is unavailable. Try again later.", 502
        ) from None

    if len(body) > POKEPASTE_MAX_BYTES:
        raise PokePasteFetchError(
            "response-too-large", "The PokéPaste team text is too large to import.", 502
        )
    try:
        return body.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        raise PokePasteFetchError(
            "invalid-content", "PokéPaste returned content that cannot be imported.", 502
        ) from None


def _status_error(status: int) -> PokePasteFetchError:
    if status == 404:
        return PokePasteFetchError("not-found", "The PokéPaste team was not found.", 404)
    return PokePasteFetchError(
        "upstream-unavailable", "PokéPaste is unavailable. Try again later.", 502
    )


def reserve_fetch_attempt(session: SessionBase, *, now: float | None = None) -> int | None:
    """Atomically reserve one database-session attempt or return seconds to retry."""
    session_key = session.session_key
    if session_key is None:
        raise RuntimeError("An authenticated session is required before reserving an attempt.")
    _before_attempt_lock()
    with transaction.atomic():
        stored_session = Session.objects.select_for_update().get(session_key=session_key)
        _attempt_lock_acquired()
        current = time.time() if now is None else now
        session_data = stored_session.get_decoded()
        attempts, retry_after = _updated_attempts(
            session_data.get(_SESSION_ATTEMPTS_KEY, []), current
        )
        if retry_after is not None:
            return retry_after
        session_data[_SESSION_ATTEMPTS_KEY] = attempts
        stored_session.session_data = session.encode(session_data)
        stored_session.save(update_fields=["session_data"])

    # All later endpoint work is read-only. Keep middleware from saving the stale snapshot that
    # this request loaded before another worker acquired the row lock.
    session[_SESSION_ATTEMPTS_KEY] = attempts
    session.modified = False
    return None


def _before_attempt_lock() -> None:
    """Provide a deterministic concurrency-test seam before acquiring the session row."""


def _attempt_lock_acquired() -> None:
    """Provide a deterministic concurrency-test seam after acquiring the session row."""


def _updated_attempts(stored: object, current: float) -> tuple[list[float], int | None]:
    cutoff = current - POKEPASTE_ATTEMPT_WINDOW_SECONDS
    attempts = (
        [
            float(value)
            for value in stored
            if isinstance(value, (int, float))
            and not isinstance(value, bool)
            and cutoff < float(value)
        ]
        if isinstance(stored, list)
        else []
    )
    attempts.sort()
    if len(attempts) >= POKEPASTE_ATTEMPT_LIMIT:
        return (
            attempts,
            max(
                1,
                min(
                    POKEPASTE_ATTEMPT_WINDOW_SECONDS,
                    math.ceil(attempts[0] + POKEPASTE_ATTEMPT_WINDOW_SECONDS - current),
                ),
            ),
        )
    attempts.append(current)
    return attempts, None

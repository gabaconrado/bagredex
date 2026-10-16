"""Narrow global template context owned by Bagredex."""

from django.conf import settings
from django.http import HttpRequest


def bagredex_metadata(request: HttpRequest) -> dict[str, str]:
    """Expose the configured public version label to server-rendered templates."""
    del request
    return {"bagredex_version_label": settings.BAGREDEX_VERSION_LABEL}

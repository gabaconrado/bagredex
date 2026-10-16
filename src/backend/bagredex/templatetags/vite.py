"""Resolve hashed Vite entry points through the generated manifest."""

import json
from pathlib import Path
from typing import Any

from django import template
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.templatetags.static import static
from django.utils.html import format_html_join
from django.utils.safestring import SafeString

register = template.Library()


def _manifest() -> dict[str, Any]:
    manifest_path = Path(settings.VITE_MANIFEST_PATH)
    try:
        value = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ImproperlyConfigured(f"Vite manifest is unavailable: {manifest_path}") from error
    if not isinstance(value, dict):
        raise ImproperlyConfigured(f"Vite manifest must be an object: {manifest_path}")
    return value


def _entry(entry: str) -> dict[str, Any]:
    record = _manifest().get(entry)
    if not isinstance(record, dict):
        raise ImproperlyConfigured(f"Vite manifest entry is unavailable: {entry}")
    return record


def _asset_url(entry: str, output: object) -> str:
    if not isinstance(output, str):
        raise ImproperlyConfigured(f"Vite manifest asset is invalid: {entry}")
    if output.startswith("/") or ".." in Path(output).parts:
        raise ImproperlyConfigured(f"Vite manifest entry has an unsafe path: {entry}")
    return static(f"web/dist/{output}")


@register.simple_tag
def vite_asset(entry: str) -> str:
    """Return the static URL for one Vite JavaScript manifest entry."""
    return _asset_url(entry, _entry(entry).get("file"))


@register.simple_tag
def vite_styles(entry: str) -> SafeString:
    """Return stylesheet links for every CSS asset attached to a Vite entry."""
    styles = _entry(entry).get("css")
    if styles is None:
        return SafeString("")
    if not isinstance(styles, list):
        raise ImproperlyConfigured(f"Vite manifest CSS is unavailable: {entry}")
    urls = [_asset_url(entry, output) for output in styles]
    return format_html_join("", '<link rel="stylesheet" href="{}">', ((url,) for url in urls))

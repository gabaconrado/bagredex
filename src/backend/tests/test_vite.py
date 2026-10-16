"""Tests for Vite manifest template integration."""

import json
from pathlib import Path

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.template import Context, Template
from django.test import override_settings


def test_vite_asset_resolves_hashed_entry(tmp_path: Path) -> None:
    manifest = tmp_path / "static" / "web" / "dist" / ".vite" / "manifest.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(
        json.dumps(
            {
                "src/pokedex.tsx": {
                    "file": "assets/pokedex-abc123.js",
                    "css": ["assets/pokedex-abc123.css", "assets/shared-def456.css"],
                }
            }
        ),
        encoding="utf-8",
    )
    with override_settings(VITE_MANIFEST_PATH=manifest):
        rendered = Template("{% load vite %}{% vite_asset 'src/pokedex.tsx' %}").render(Context())
    assert rendered == "/static/web/dist/assets/pokedex-abc123.js"
    with override_settings(VITE_MANIFEST_PATH=manifest):
        styles = Template("{% load vite %}{% vite_styles 'src/pokedex.tsx' %}").render(Context())
    assert styles == (
        '<link rel="stylesheet" href="/static/web/dist/assets/pokedex-abc123.css">'
        '<link rel="stylesheet" href="/static/web/dist/assets/shared-def456.css">'
    )


def test_vite_asset_fails_clearly_for_missing_entry(tmp_path: Path) -> None:
    manifest = tmp_path / "static" / "web" / "dist" / ".vite" / "manifest.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text("{}", encoding="utf-8")
    with (
        override_settings(VITE_MANIFEST_PATH=manifest),
        pytest.raises(ImproperlyConfigured, match="manifest entry is unavailable"),
    ):
        Template("{% load vite %}{% vite_asset 'src/pokedex.tsx' %}").render(Context())


def test_vite_styles_rejects_unsafe_css_path(tmp_path: Path) -> None:
    manifest = tmp_path / "static" / "web" / "dist" / ".vite" / "manifest.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(
        json.dumps({"src/pokedex.tsx": {"file": "entry.js", "css": ["../secret.css"]}}),
        encoding="utf-8",
    )
    with (
        override_settings(VITE_MANIFEST_PATH=manifest),
        pytest.raises(ImproperlyConfigured, match="unsafe path"),
    ):
        Template("{% load vite %}{% vite_styles 'src/pokedex.tsx' %}").render(Context())


def test_vite_asset_does_not_require_public_output_on_application_filesystem(
    tmp_path: Path,
) -> None:
    manifest = tmp_path / "static" / "web" / "dist" / ".vite" / "manifest.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(
        json.dumps({"src/pokedex.tsx": {"file": "assets/missing.js", "css": []}}),
        encoding="utf-8",
    )
    with override_settings(VITE_MANIFEST_PATH=manifest):
        rendered = Template("{% load vite %}{% vite_asset 'src/pokedex.tsx' %}").render(Context())
    assert rendered == "/static/web/dist/assets/missing.js"


@pytest.mark.parametrize(
    ("record", "tag", "message"),
    (
        ({"file": "../unsafe.js", "css": ["asset.css"]}, "vite_asset", "unsafe path"),
        ({"file": 42, "css": ["asset.css"]}, "vite_asset", "asset is invalid"),
        ({"file": "asset.js", "css": "asset.css"}, "vite_styles", "CSS is unavailable"),
        ({"file": "asset.js", "css": [42]}, "vite_styles", "asset is invalid"),
    ),
)
def test_vite_tags_reject_malformed_assets(
    tmp_path: Path, record: object, tag: str, message: str
) -> None:
    manifest = tmp_path / "static" / "web" / "dist" / ".vite" / "manifest.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(json.dumps({"src/pokedex.tsx": record}), encoding="utf-8")
    with (
        override_settings(VITE_MANIFEST_PATH=manifest),
        pytest.raises(ImproperlyConfigured, match=message),
    ):
        Template(f"{{% load vite %}}{{% {tag} 'src/pokedex.tsx' %}}").render(Context())


@pytest.mark.parametrize("record", ({"file": "entry.js"}, {"file": "entry.js", "css": []}))
def test_vite_styles_allows_absent_or_empty_css(tmp_path: Path, record: object) -> None:
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"src/pokedex.tsx": record}), encoding="utf-8")
    with override_settings(VITE_MANIFEST_PATH=manifest):
        rendered = Template("{% load vite %}{% vite_styles 'src/pokedex.tsx' %}").render(Context())
    assert rendered == ""

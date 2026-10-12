"""Tests for the database-free project shape and production settings."""

import json
import os
import subprocess
import sys
from collections.abc import Mapping
from pathlib import Path

import pytest
from django.conf import settings

from bagredex.settings import base

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PRODUCTION_ENVIRONMENT = {
    "DJANGO_SECRET_KEY": "settings-test-only-9Qv7Lw2Ks8Fh4Zx6Bn3Cp5Rt1Ym0",
    "BAGREDEX_DOMAIN": "vgc.example.test",
    "BAGREDEX_IMAGE_VERSION": "0.1.0",
}


def production_process(
    script: str, environment: Mapping[str, str]
) -> subprocess.CompletedProcess[str]:
    """Import production settings in an isolated interpreter."""
    process_environment = os.environ.copy()
    for name in (*PRODUCTION_ENVIRONMENT, "DJANGO_SECURE_HSTS_SECONDS"):
        process_environment.pop(name, None)
    process_environment.update(environment)
    return subprocess.run(
        [sys.executable, "-c", script],
        cwd=BACKEND_ROOT,
        env=process_environment,
        check=False,
        capture_output=True,
        text=True,
    )


@pytest.mark.parametrize(
    ("missing_name", "environment"),
    [
        ("DJANGO_SECRET_KEY", {}),
        (
            "BAGREDEX_DOMAIN",
            {"DJANGO_SECRET_KEY": PRODUCTION_ENVIRONMENT["DJANGO_SECRET_KEY"]},
        ),
        (
            "BAGREDEX_IMAGE_VERSION",
            {
                "DJANGO_SECRET_KEY": PRODUCTION_ENVIRONMENT["DJANGO_SECRET_KEY"],
                "BAGREDEX_DOMAIN": PRODUCTION_ENVIRONMENT["BAGREDEX_DOMAIN"],
            },
        ),
    ],
)
def test_production_requires_core_environment(
    missing_name: str, environment: Mapping[str, str]
) -> None:
    process = production_process("from bagredex.settings import production", environment)

    assert process.returncode != 0
    assert f"The {missing_name} environment variable is required." in process.stderr


def test_production_security_settings() -> None:
    script = """
import json
from bagredex.settings import production
print(json.dumps({
    "allowed_hosts": production.ALLOWED_HOSTS,
    "csrf_origins": production.CSRF_TRUSTED_ORIGINS,
    "csrf_secure": production.CSRF_COOKIE_SECURE,
    "hsts_include_subdomains": production.SECURE_HSTS_INCLUDE_SUBDOMAINS,
    "hsts_preload": production.SECURE_HSTS_PRELOAD,
    "hsts_seconds": production.SECURE_HSTS_SECONDS,
    "proxy_header": production.SECURE_PROXY_SSL_HEADER,
    "session_secure": production.SESSION_COOKIE_SECURE,
    "ssl_redirect": production.SECURE_SSL_REDIRECT,
}))
"""
    process = production_process(script, PRODUCTION_ENVIRONMENT)

    assert process.returncode == 0, process.stderr
    assert json.loads(process.stdout) == {
        "allowed_hosts": ["vgc.example.test"],
        "csrf_origins": ["https://vgc.example.test"],
        "csrf_secure": True,
        "hsts_include_subdomains": False,
        "hsts_preload": False,
        "hsts_seconds": 300,
        "proxy_header": ["HTTP_X_FORWARDED_PROTO", "https"],
        "session_secure": True,
        "ssl_redirect": True,
    }


def test_production_accepts_a_lowercase_fqdn() -> None:
    script = """
import json
from bagredex.settings import production
print(json.dumps({
    "allowed_hosts": production.ALLOWED_HOSTS,
    "csrf_origins": production.CSRF_TRUSTED_ORIGINS,
    "domain": production.DOMAIN,
}))
"""
    process = production_process(script, PRODUCTION_ENVIRONMENT)

    assert process.returncode == 0, process.stderr
    assert json.loads(process.stdout) == {
        "allowed_hosts": ["vgc.example.test"],
        "csrf_origins": ["https://vgc.example.test"],
        "domain": "vgc.example.test",
    }


@pytest.mark.parametrize(
    "domain",
    [
        "*",
        ".example.test",
        "example.test.",
        "https://example.test",
        "example.test:443",
        "example.test/path",
        " example.test",
        "example.test ",
        "example\ttest",
        "example.test\nattacker.test",
        "example.test,attacker.test",
        "example..test",
        "-example.test",
        "example-.test",
        "example_test",
        "192.0.2.1",
        "VGC.Example.TEST",
        "localhost",
        "example.1test",
        "münchen.example",
    ],
)
def test_production_rejects_malformed_domain(domain: str) -> None:
    environment = {**PRODUCTION_ENVIRONMENT, "BAGREDEX_DOMAIN": domain}

    process = production_process("from bagredex.settings import production", environment)

    assert process.returncode != 0
    assert "must contain exactly one lowercase ASCII FQDN" in process.stderr


def test_production_trusts_forwarded_https_only() -> None:
    script = """
import json
import os
os.environ["DJANGO_SETTINGS_MODULE"] = "bagredex.settings.production"
import django
django.setup()
from django.test import Client
client = Client(HTTP_HOST="vgc.example.test")
print(json.dumps({
    "http": client.get("/health/live").status_code,
    "https": client.get("/health/live", HTTP_X_FORWARDED_PROTO="https").status_code,
}))
"""
    process = production_process(script, PRODUCTION_ENVIRONMENT)

    assert process.returncode == 0, process.stderr
    assert json.loads(process.stdout) == {"http": 301, "https": 200}


def test_production_rejects_a_request_for_an_unconfigured_host() -> None:
    script = """
import os
os.environ["DJANGO_SETTINGS_MODULE"] = "bagredex.settings.production"
import django
django.setup()
from django.test import Client
response = Client(HTTP_HOST="attacker.example").get(
    "/health/live", HTTP_X_FORWARDED_PROTO="https"
)
print(response.status_code)
"""
    process = production_process(script, PRODUCTION_ENVIRONMENT)

    assert process.returncode == 0, process.stderr
    assert process.stdout == "400\n"


@pytest.mark.parametrize(
    "image_version",
    [" ", "0.1", "01.2.3", "1.02.3", "1.2.03", "v1.2.3", "1.2.3-rc.1", "latest"],
)
def test_production_rejects_invalid_image_version(image_version: str) -> None:
    environment = {**PRODUCTION_ENVIRONMENT, "BAGREDEX_IMAGE_VERSION": image_version}

    process = production_process("from bagredex.settings import production", environment)

    assert process.returncode != 0
    if image_version.strip():
        assert "must be a stable semantic version in MAJOR.MINOR.PATCH format" in process.stderr
        assert image_version not in process.stderr
    else:
        assert "The BAGREDEX_IMAGE_VERSION environment variable is required." in process.stderr


@pytest.mark.parametrize("hsts_seconds", ["not-a-number", "-1"])
def test_production_rejects_invalid_hsts_seconds(hsts_seconds: str) -> None:
    environment = {**PRODUCTION_ENVIRONMENT, "DJANGO_SECURE_HSTS_SECONDS": hsts_seconds}

    process = production_process("from bagredex.settings import production", environment)

    assert process.returncode != 0
    assert "must be a non-negative integer" in process.stderr
    assert hsts_seconds not in process.stderr


def test_project_has_no_database_configuration_or_backed_apps() -> None:
    script = """
import json
import os
os.environ["DJANGO_SETTINGS_MODULE"] = "bagredex.settings.local"
from django.conf import settings
has_explicit_default = "default" in settings.DATABASES
from django.db import connections
dummy_settings = connections["default"].settings_dict
print(json.dumps({
    "has_explicit_default": has_explicit_default,
    "implicit_engine": dummy_settings["ENGINE"],
    "implicit_name": dummy_settings["NAME"],
}))
"""
    process = production_process(
        script,
        environment={},
    )

    assert process.returncode == 0, process.stderr
    assert json.loads(process.stdout) == {
        "has_explicit_default": False,
        "implicit_engine": "django.db.backends.dummy",
        "implicit_name": "",
    }
    assert settings.INSTALLED_APPS == ["django.contrib.staticfiles"]
    assert not {
        "django.contrib.admin",
        "django.contrib.auth",
        "django.contrib.contenttypes",
        "django.contrib.messages",
        "django.contrib.sessions",
    }.intersection(settings.INSTALLED_APPS)
    assert not any("SessionMiddleware" in middleware for middleware in settings.MIDDLEWARE)
    assert not list(BACKEND_ROOT.rglob("db.sqlite3"))


def test_web_asset_paths_follow_the_cross_scope_contract() -> None:
    assert base.TEMPLATES[0]["DIRS"] == [base.REPOSITORY_ROOT / "src" / "web" / "templates"]
    assert base.STATICFILES_DIRS == [base.REPOSITORY_ROOT / "src" / "web" / "static"]

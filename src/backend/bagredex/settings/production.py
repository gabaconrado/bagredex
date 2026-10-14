"""Security-focused production settings."""

import ipaddress
import os
import re

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

_STABLE_VERSION_PATTERN = re.compile(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)")
_DNS_LABEL_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")


def required_environment(name: str) -> str:
    """Return a non-empty required setting or fail during settings initialization."""
    value = os.getenv(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"The {name} environment variable is required.")
    return value


def dns_hostname_environment(name: str) -> str:
    """Return one lowercase ASCII FQDN or fail without exposing its value."""
    raw_value = os.getenv(name, "")
    if not raw_value.strip():
        raise ImproperlyConfigured(f"The {name} environment variable is required.")

    normalized_value = raw_value.lower()
    labels = normalized_value.split(".")
    try:
        ipaddress.ip_address(normalized_value)
    except ValueError:
        is_ip_address = False
    else:
        is_ip_address = True
    if (
        raw_value != raw_value.strip()
        or raw_value != normalized_value
        or not normalized_value.isascii()
        or len(normalized_value) > 253
        or is_ip_address
        or len(labels) < 2
        or not labels[-1]
        or not labels[-1][0].isalpha()
        or any(_DNS_LABEL_PATTERN.fullmatch(label) is None for label in labels)
    ):
        raise ImproperlyConfigured(
            f"The {name} environment variable must contain exactly one lowercase ASCII FQDN."
        )
    return raw_value


def nonnegative_integer_environment(name: str, default: int) -> int:
    """Return a non-negative integer setting without echoing its supplied value."""
    value = os.getenv(name, str(default)).strip()
    try:
        parsed_value = int(value)
    except ValueError:
        raise ImproperlyConfigured(
            f"The {name} environment variable must be a non-negative integer."
        ) from None
    if parsed_value < 0:
        raise ImproperlyConfigured(
            f"The {name} environment variable must be a non-negative integer."
        )
    return parsed_value


DEBUG = False
SECRET_KEY = required_environment("DJANGO_SECRET_KEY")

DOMAIN = dns_hostname_environment("BAGREDEX_DOMAIN")
ALLOWED_HOSTS = [DOMAIN]
CSRF_TRUSTED_ORIGINS = [f"https://{DOMAIN}"]

_image_version = required_environment("BAGREDEX_IMAGE_VERSION")
if _STABLE_VERSION_PATTERN.fullmatch(_image_version) is None:
    raise ImproperlyConfigured(
        "The BAGREDEX_IMAGE_VERSION environment variable must be a stable semantic version "
        "in MAJOR.MINOR.PATCH format."
    )
BAGREDEX_VERSION_LABEL = f"v{_image_version}"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": required_environment("BAGREDEX_DATABASE_NAME"),
        "USER": required_environment("BAGREDEX_DATABASE_USER"),
        "PASSWORD": required_environment("BAGREDEX_DATABASE_PASSWORD"),
        "HOST": required_environment("BAGREDEX_DATABASE_HOST"),
        "PORT": required_environment("BAGREDEX_DATABASE_PORT"),
    }
}

SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = nonnegative_integer_environment("DJANGO_SECURE_HSTS_SECONDS", 300)
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# The staged HSTS policy deliberately excludes subdomains and browser preload until certificate
# renewal has proven reliable.
SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]

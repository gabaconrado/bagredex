"""Settings shared by local and production environments."""

import os
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = BACKEND_ROOT.parents[1]
WEB_ROOT = REPOSITORY_ROOT / "src" / "web"

SECRET_KEY = "insecure-local-development-key"
DEBUG = False
ALLOWED_HOSTS: list[str] = []
BAGREDEX_VERSION_LABEL = "dev"

INSTALLED_APPS = ["django.contrib.staticfiles"]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "bagredex.urls"

TEMPLATES: list[dict[str, Any]] = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [WEB_ROOT / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": ["django.template.context_processors.request"],
        },
    }
]

WSGI_APPLICATION = "bagredex.wsgi.application"

# Persistence is intentionally absent from the first deployable slice. Django must not silently
# create a temporary SQLite database that later features could accidentally depend upon.
DATABASES: dict[str, dict[str, object]] = {}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = Path(os.getenv("DJANGO_STATIC_ROOT", BACKEND_ROOT / "staticfiles"))
STATICFILES_DIRS = [WEB_ROOT / "static"]

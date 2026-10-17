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
BAGREDEX_VERSION_LABEL = "development"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "bagredex.accounts",
    "bagredex.pokemon_data",
    "bagredex.teams",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.auth.middleware.LoginRequiredMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "bagredex.urls"

TEMPLATES: list[dict[str, Any]] = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [WEB_ROOT / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "libraries": {"vite": "bagredex.templatetags.vite"},
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "bagredex.context_processors.bagredex_metadata",
            ],
        },
    }
]

WSGI_APPLICATION = "bagredex.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("BAGREDEX_DATABASE_NAME", "bagredex"),
        "USER": os.getenv("BAGREDEX_DATABASE_USER", "bagredex"),
        "PASSWORD": os.getenv("BAGREDEX_DATABASE_PASSWORD", "bagredex-development"),
        "HOST": os.getenv("BAGREDEX_DATABASE_HOST", "localhost"),
        "PORT": os.getenv("BAGREDEX_DATABASE_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "accounts.User"
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "home"
LOGOUT_REDIRECT_URL = "login"

SESSION_COOKIE_AGE = 1_209_600
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATIC_URL = "/static/"
STATIC_ROOT = Path(os.getenv("DJANGO_STATIC_ROOT", BACKEND_ROOT / "staticfiles"))
STATICFILES_DIRS = [WEB_ROOT / "static"]

POKEMON_DATA_RELEASES_ROOT = REPOSITORY_ROOT / "src" / "data" / "releases"
VITE_MANIFEST_PATH = Path(
    os.getenv(
        "BAGREDEX_VITE_MANIFEST_PATH",
        WEB_ROOT / "static" / "web" / "dist" / ".vite" / "manifest.json",
    )
)

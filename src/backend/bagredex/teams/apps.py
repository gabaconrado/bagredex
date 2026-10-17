"""Team application configuration."""

from django.apps import AppConfig


class TeamsConfig(AppConfig):
    """Configure private user-authored teams."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "bagredex.teams"

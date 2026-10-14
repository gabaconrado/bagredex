"""Application configuration for Bagredex accounts."""

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """Configure the project-owned user application."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "bagredex.accounts"
    verbose_name = "Accounts"

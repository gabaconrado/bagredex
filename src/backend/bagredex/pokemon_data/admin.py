"""Read-only inspection for canonical Pokémon data versions."""

from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from .models import ActiveDataVersion, DataActivation, DataVersion


class ReadOnlyAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Prevent imported or audit data from being changed through admin."""

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False


@admin.register(DataVersion)
class DataVersionAdmin(ReadOnlyAdmin):
    list_display = ("id", "status", "loaded_at")


@admin.register(DataActivation)
class DataActivationAdmin(ReadOnlyAdmin):
    list_display = ("previous_version", "new_version", "activated_at")


@admin.register(ActiveDataVersion)
class ActiveDataVersionAdmin(ReadOnlyAdmin):
    list_display = ("singleton_key", "version")

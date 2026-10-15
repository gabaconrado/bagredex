"""Django application configuration for canonical Pokémon data."""

from django.apps import AppConfig


class PokemonDataConfig(AppConfig):
    """Configure the isolated Pokémon data application."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "bagredex.pokemon_data"

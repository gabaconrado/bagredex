"""Atomically change the global active Pokémon data pointer."""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from ...services import PokemonDataServiceError, activate_pokemon_data


class Command(BaseCommand):
    """Activate a loaded version or bootstrap only an empty pointer."""

    help = "Atomically activate a loaded Pokémon data version."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("version")
        parser.add_argument(
            "--if-none",
            action="store_true",
            help="Activate only when no version is currently active (deployment bootstrap only).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            result = activate_pokemon_data(options["version"], if_none=options["if_none"])
        except PokemonDataServiceError as error:
            raise CommandError(str(error)) from error
        old = result.previous_identifier or "none"
        if result.skipped_if_none:
            self.stdout.write(
                f"active version is {old}; --if-none left it unchanged "
                f"(requested {result.new_identifier})"
            )
        elif result.changed:
            self.stdout.write(f"active version changed: {old} -> {result.new_identifier}")
        else:
            self.stdout.write(f"active version already {result.new_identifier}; no changes")

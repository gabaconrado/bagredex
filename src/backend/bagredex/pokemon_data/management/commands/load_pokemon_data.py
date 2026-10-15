"""Load one verified portable bundle into the canonical database."""

import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from ...services import PokemonDataServiceError, load_pokemon_data


class Command(BaseCommand):
    """Validate and atomically load an immutable data version."""

    help = "Validate and atomically load a Pokémon data bundle."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("bundle", type=Path)

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            result = load_pokemon_data(options["bundle"])
        except PokemonDataServiceError as error:
            raise CommandError(str(error)) from error
        action = "loaded" if result.created else "already loaded; no changes"
        self.stdout.write(f"{result.version.pk}: {action}")
        files = result.version.semantic_diff["files"]
        summary = {
            name: {
                "added": counts["added"],
                "removed": counts["removed"],
                "changed": counts["changed"],
            }
            for name, counts in files.items()
        }
        self.stdout.write(f"semantic diff: {json.dumps(summary, sort_keys=True)}")

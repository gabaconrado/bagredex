"""Expose the data-owned bundle builder through Django."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser


class Command(BaseCommand):
    """Thin adapter over the importer owned by src/data."""

    help = "Build a deterministic Pokémon data bundle from pinned local snapshots."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--showdown", required=True, type=Path)
        parser.add_argument("--sprites", required=True, type=Path)
        parser.add_argument("--pokeapi", required=True, type=Path)
        parser.add_argument(
            "--releases", type=Path, default=settings.REPOSITORY_ROOT / "src" / "data" / "releases"
        )

    def handle(self, *args: Any, **options: Any) -> None:
        command = [
            sys.executable,
            "-m",
            "src.data.importer",
            "build",
            "--showdown",
            str(options["showdown"]),
            "--sprites",
            str(options["sprites"]),
            "--pokeapi",
            str(options["pokeapi"]),
            "--releases",
            str(options["releases"]),
        ]
        result = subprocess.run(
            command,
            cwd=settings.REPOSITORY_ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode:
            detail = result.stderr.strip() or result.stdout.strip()
            raise CommandError(detail or "Pokémon data builder failed")
        self.stdout.write(result.stdout.rstrip())

"""Observable behavior tests for the canonical Pokémon data foundation."""

from __future__ import annotations

import hashlib
import io
import json
import shutil
import struct
import subprocess
from base64 import b64decode
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from typing import Any, cast

import pytest
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError, close_old_connections, connection, transaction
from django.test import Client
from django.test.utils import CaptureQueriesContext

from bagredex.accounts.models import User
from bagredex.pokemon_data import services as pokemon_data_services
from bagredex.pokemon_data.bundles import (
    EXPECTED_PINNED_COUNTS,
    EXPECTED_SOURCE_COUNTS,
    MULTI_GROUP_COUNTS,
    MULTI_PINNED_COUNTS,
    BundleReadError,
    canonical_bytes,
    read_bundle,
)
from bagredex.pokemon_data.management.commands import build_pokemon_data
from bagredex.pokemon_data.models import (
    ActiveDataVersion,
    DataActivation,
    DataVersion,
    MechanicsProfile,
    PokemonForm,
    PokemonProfile,
    PokemonProfileType,
    Regulation,
    RegulationMembership,
    Sprite,
    Type,
)
from bagredex.pokemon_data.services import (
    activate_pokemon_data,
    load_pokemon_data,
    semantic_diff,
)
from bagredex.pokemon_data.stats import level_50_stat


@pytest.mark.parametrize(
    ("base", "sp", "hp", "nature", "expected"),
    [
        (80, 0, True, "neutral", 155),
        (80, 32, True, "increasing", 187),
        (89, 0, False, "hindering", 98),
        (89, 0, False, "neutral", 109),
        (89, 32, False, "increasing", 155),
    ],
)
def test_level_50_stat_uses_exact_integer_arithmetic(
    base: int, sp: int, hp: bool, nature: Any, expected: int
) -> None:
    assert level_50_stat(base=base, sp=sp, hp=hp, nature=nature) == expected


@pytest.mark.parametrize("sp", [-1, 33])
def test_level_50_stat_rejects_out_of_range_sp(sp: int) -> None:
    with pytest.raises(ValueError, match="SP must be between 0 and 32"):
        level_50_stat(base=100, sp=sp, hp=False)


def test_semantic_diff_reports_stable_record_keys() -> None:
    before = {"forms.json": {"alpha": "same", "removed": "old", "changed": "old"}}
    after = {"forms.json": {"alpha": "same", "added": "new", "changed": "new"}}

    result = semantic_diff(before, after)

    assert result["files"]["forms.json"] == {
        "added": 1,
        "removed": 1,
        "changed": 1,
        "added_keys": ["added"],
        "removed_keys": ["removed"],
        "changed_keys": ["changed"],
    }


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(canonical_bytes(value))


def _hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


_VALID_STATIC_WEBP = b64decode(
    "UklGRrQEAABXRUJQVlA4WAoAAAAQAAAAfwEAfwEAQUxQSKcCAAARDzCIERFCciTJcSSh7cKTIlAUikaKBlEgAp7dPTTOBVRl5tbeV0T/HTmSFDbFMbDCXibmDel/9KO+DiOr3Eezyj5aojpGq8qrMYLaLCeNYjlrNMukWy1d/OoM1Wxzsmi2dHL1ZD1RVWnRu2eWhUgYpVd3KNoubnz1ZT1BLXGpu2+OZvctkpRKk/oKDEXqpMmriEyvBBbq0bXEpQ7EGssrNPiUSpNaMGc6ddLk3TEzuRJaGMkrOLhaYKk4CupMplSa1IaaFKlzmrQoLkSK6xHyJDvf+M07qne+VMGdeVPXJQGv0zWyc7cNpb6tAv65ayp5VGn+tgrNP0ZbNBU41mNQo2hAzA4y2Hcgxjv0T8w9RSODPXYB6RRfCyjFrkQWUlbnVVIaY/qxMPZbauvOl1LpDp9S7Q6TUus2p7LYdpV7l2YFY3vGhlnG6zVeuMK5i/PQ+KKQut2NjSeZT280nmLXMkrx5q4b1hYiqf2WTMbmcwyl35KnUh+qzsk2HplEDds4fkPS/8/o/8fi/69G/i7ov1P676D8O6v/juvvCdHuIcb2jA1HvEetBv09UH/P1N9j496Th/HjoTIy5dX2SimD06gLOHVPQzZVgEfFXiry6lH3IaiW3figcKWwWtxCZOWXQJYCakVzNjZC819T5blta7xxjKtp3saKUu5+j2zqZivNXUx4G+7EXIzM6O2GBDtGq7cLjPck3lPi2is4JlxFZVxBnXEb6hRHQiXCgVkjuWNmRoOPibjxZ8YG1xKXSkm8cI1lRyycO9T2WCqYUvFBOXMS1nZxqZW1Q7XEC+doGpQ6ceNzNBuUUvFBSbQdaLu41MxrQC3xwhxPcVPH24C2ixufBA4/pYKiblXp5LPG5s6WTk4BYRciYZSWqO5G6FSqFYr/0I8EAFZQOCDmAQAA0CwAnQEqgAGAAT/9/v9/v7+7siQ0eFvwP4lpbuFtrg10CX/9P/5v8IBbao/ANOIdScndEOpOTuiHUnJ3RDqTk7oh1Jyd0Q6k5O6IdScndEOpOTuiHUnJ3RDqTk7ohaLLqc+tjVho6k5O6IcxAujUkv6nm5vdiHUnIwgZ6cQ6kg2JLT3Yh1I57qTk7obgIxBasNHMQu8ndEOpIJet7sQtES8kUDp5k8/UkLaTRJ3YhbCb9G9LMlmANF1Zh1JyK2gXOD7SbvwrMLTO6IdP5AtNCYY5fA4l6o0Sd2IWwm/QloO7VLjWmsXN7sQtEXK5D+4+eypyXk3EvJyd0OL53XdrxA3z/OJS092IXXYEjqTk7Y404h1JydtEgn1S09C4iWpae7EOpINhTr+FEVWUqZ9Hmp3YhaMTBYLBUhm17sQ6k5O6IdQPQl4Dp8ExYaa3uxDqTk7nlBNudEB6pae7EOpI5x2j7d0Q6k5O6Ic1+gmK8AD+p+AAAAB302N+Cl8yaRDbK1lfsbxK2JgC7WfGgfjkILFzGGzUINZd//k3Qlqn7cPLPI+okaYXNnL8eZbpMQDe33E8crFkqRVO8cwHHPC0ny3jX0r89anEkxDKQXIbjpLyEBrCOQJZ7sM3jhICcdhYQAAAAAAA"
)


def _static_webp(
    *, flags: int = 0x10, width: int = 384, height: int = 384, alpha_chunk: bool = True
) -> bytes:
    content = bytearray(_VALID_STATIC_WEBP)
    content[20] = flags
    content[24:27] = (width - 1).to_bytes(3, "little")
    content[27:30] = (height - 1).to_bytes(3, "little")
    if not alpha_chunk:
        alpha_length = struct.unpack("<I", content[34:38])[0]
        alpha_end = 38 + alpha_length + alpha_length % 2
        del content[30:alpha_end]
        content[4:8] = (len(content) - 8).to_bytes(4, "little")
    return bytes(content)


def _bundle(tmp_path: Path) -> Path:
    stage = tmp_path / "stage"
    stage.mkdir()
    forms = [
        {
            "id": "examplemon",
            "name": "Examplemon",
            "national_dex_number": 1,
            "base_form_id": "examplemon",
            "form_label": "",
            "is_mega": False,
            "sprite_id": "examplemon",
        },
        {
            "id": "examplemonmega",
            "name": "Examplemon-Mega",
            "national_dex_number": 1,
            "base_form_id": "examplemon",
            "form_label": "Mega",
            "is_mega": True,
            "sprite_id": "examplemon-mega",
        },
    ]
    regulations = [
        {
            "id": regulation_id,
            "name": f"[Gen 9 Champions] VGC 2026 Reg M-{regulation_id[-1].upper()}",
            "showdown_format_id": f"gen9championsvgc2026regm{regulation_id[-1]}",
            "mod": "championsregmb" if regulation_id == "m-b" else "champions",
            "ruleset": ["Flat Rules", "VGC Timer", "Open Team Sheets"],
            "mechanics_profile_id": "champions-level-50-v1",
        }
        for regulation_id in ("m-b", "m-c")
    ]
    profiles = []
    ability_profiles = []
    move_profiles = []
    learnsets = []
    for regulation_id in ("m-b", "m-c"):
        ability_profiles.append(
            {
                "regulation_id": regulation_id,
                "id": "exampleability",
                "name": "Example Ability",
                "short_description": "Short.",
                "description": "Long.",
            }
        )
        move_profiles.append(
            {
                "regulation_id": regulation_id,
                "id": "examplemove",
                "name": "Example Move",
                "type": "Normal",
                "category": "Physical",
                "base_power": 40,
                "accuracy": 100,
                "pp": 20,
                "priority": 0,
                "target": "normal",
                "short_description": "Short.",
                "description": "Long.",
            }
        )
        for form in forms:
            profiles.append(
                {
                    "regulation_id": regulation_id,
                    "form_id": form["id"],
                    "stats": {"hp": 1, "atk": 1, "def": 1, "spa": 1, "spd": 1, "spe": 1},
                    "bst": 6,
                    "types": ["Normal"],
                    "abilities": [{"slot": "0", "ability_id": "exampleability"}],
                }
            )
            learnsets.append(
                {
                    "regulation_id": regulation_id,
                    "form_id": form["id"],
                    "move_id": "examplemove",
                    "form_resolution": "base-to-mega" if form["is_mega"] else "direct",
                    "source_form_id": "examplemon",
                    "source_mod": "championsregmb" if regulation_id == "m-b" else "champions",
                    "source_kind": "direct",
                }
            )
    records: dict[str, object] = {
        "mechanics_profiles.json": [
            {
                "id": "champions-level-50-v1",
                "level": 50,
                "sp_minimum": 0,
                "sp_maximum": 32,
                "hp_formula": "base + sp + 75",
                "other_formula": "truncate((base + sp + 20) * nature_percent / 100)",
                "nature_percentages": {"hindering": 90, "neutral": 100, "increasing": 110},
            }
        ],
        "regulations.json": regulations,
        "forms.json": forms,
        "types.json": [{"id": "normal", "name": "Normal"}],
        "abilities.json": [{"id": "exampleability", "name": "Example Ability"}],
        "moves.json": [{"id": "examplemove", "name": "Example Move"}],
        "move_flags.json": [{"id": "protect"}],
        "regulation_memberships.json": [
            {"regulation_id": "m-b", "form_id": "examplemon"},
            {"regulation_id": "m-c", "form_id": "examplemon"},
        ],
        "profiles.json": profiles,
        "ability_profiles.json": ability_profiles,
        "move_profiles.json": move_profiles,
        "move_flag_relations.json": [
            {"regulation_id": regulation_id, "move_id": "examplemove", "flag_id": "protect"}
            for regulation_id in ("m-b", "m-c")
        ],
        "mega_relations.json": [{"base_form_id": "examplemon", "mega_form_id": "examplemonmega"}],
        "learnsets.json": learnsets,
    }
    sprites = []
    cwebp_args = [
        "cwebp",
        "input.png",
        "-resize",
        "384",
        "384",
        "-q",
        "82",
        "-alpha_q",
        "100",
        "-m",
        "6",
        "-pass",
        "10",
        "-sharp_yuv",
        "-metadata",
        "none",
        "-o",
        "output.webp",
    ]
    for pokemon_id, form in enumerate(forms, start=1):
        for variant in ("normal", "shiny"):
            relative = f"sprites/{variant}/{form['id']}.webp"
            sprite = stage / relative
            sprite.parent.mkdir(parents=True, exist_ok=True)
            sprite.write_bytes(_static_webp())
            sprites.append(
                {
                    "form_id": form["id"],
                    "variant": variant,
                    "path": relative,
                    "source_path": (
                        "sprites/pokemon/other/home/"
                        f"{'shiny/' if variant == 'shiny' else ''}{pokemon_id}.png"
                    ),
                    "source_sha256": "0" * 64,
                    "pokeapi_pokemon_id": pokemon_id,
                    "pokeapi_identifier": form["id"],
                    "mapping_rule": "normalized-identifier",
                    "source_width": 512,
                    "source_height": 512,
                    "source_bit_depth": 8,
                    "source_color_type": 6,
                    "source_interlace": 0,
                    "cwebp_version": "1.3.2",
                    "cwebp_args": cwebp_args,
                    "sha256": _hash(sprite),
                    "width": 384,
                    "height": 384,
                    "has_alpha": True,
                    "is_animated": False,
                    "has_metadata": False,
                }
            )
    records["sprite_mappings.json"] = [
        {
            "form_id": form["id"],
            "pokeapi_pokemon_id": pokemon_id,
            "pokeapi_identifier": form["id"],
            "mapping_rule": "normalized-identifier",
        }
        for pokemon_id, form in enumerate(forms, start=1)
    ]
    records["sprites.json"] = sprites
    for name, value in records.items():
        _write_json(stage / name, value)
    revision = "3a766f2cfb5e51c1e428cfe87d0dba91a8f01640"
    source_counts = {
        "pokedex": 1,
        "base_moves": 1,
        "base_abilities": 1,
        "base_learnsets": 1,
        "champions_format_entries": 1,
        "championsregmb_format_entries": 1,
    }
    showdown_notice = """The MIT License (MIT)

Copyright (c) 2011-2026 Guangcong Luo and other contributors http://pokemonshowdown.com/

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
"""
    (stage / "POKEMON-SHOWDOWN-LICENSE.txt").write_text(showdown_notice, encoding="utf-8")
    sprite_provenance = {
        "revision": "ba403973fdf9d0ac59175813861e6a1f8ed5020c",
        "clean_tree": True,
        "family": "sprites/pokemon/other/home",
        "mapping_rule_version": "pokeapi-csv-v1",
        "mapping_revision": "81d20919845b6a445969b9265aab5cec6b04cece",
        "mapping_sha256": _hash(stage / "sprite_mappings.json"),
        "cwebp_version": "1.3.2",
        "cwebp_args": cwebp_args,
        "license": "license-not-supplied",
        "mapping_exceptions": {},
    }
    _write_json(
        stage / "provenance.json",
        {
            "showdown": {
                "revision": revision,
                "commit_date": "2026-10-13",
                "clean_tree": True,
                "source_counts": source_counts,
                "notice_path": "POKEMON-SHOWDOWN-LICENSE.txt",
                "notice_sha256": _hash(stage / "POKEMON-SHOWDOWN-LICENSE.txt"),
            },
            "sprites": sprite_provenance,
            "pokeapi_mapping": {
                "revision": "81d20919845b6a445969b9265aab5cec6b04cece",
                "clean_tree": True,
            },
            "overlays": [],
        },
    )
    counts = {
        "forms": 2,
        "types": 1,
        "memberships": 2,
        "profiles": 4,
        "abilities": 1,
        "ability_profiles": 2,
        "moves": 1,
        "move_profiles": 2,
        "move_flags": 1,
        "move_flag_relations": 2,
        "learnsets": 4,
        "mega_relations": 1,
        "sprites": 4,
        "sprite_mappings": 2,
        "sprites_by_variant": {"normal": 2, "shiny": 2},
        "sprite_mapping_rules": {"normalized-identifier": 4},
        "legal_forms_by_regulation": {"m-b": 1, "m-c": 1},
        "learnsets_by_regulation": {"m-b": 2, "m-c": 2},
        "learnsets_by_form_resolution": {"base-to-mega": 2, "direct": 2},
        "learnsets_by_source_mod": {"champions": 2, "championsregmb": 2},
        "learnsets_by_source_kind": {"direct": 4},
        "move_flag_usage": {"protect": 2},
    }
    _write_json(
        stage / "validation.json",
        {
            "status": "valid",
            "errors": [],
            "warnings": [],
            "overlays": [],
            "source_counts": source_counts,
            "counts": counts,
            "ignored_source_categories": {},
            "coverage": {},
        },
    )
    files = [
        {
            "path": path.relative_to(stage).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": _hash(path),
        }
        for path in sorted(path for path in stage.rglob("*") if path.is_file())
    ]
    bundle_hash = hashlib.sha256(canonical_bytes(files)).hexdigest()
    identifier = f"showdown-{revision[:8]}-s1-i1-{bundle_hash[:12]}"
    destination = tmp_path / identifier
    stage.rename(destination)
    _write_json(
        destination / "manifest.json",
        {
            "bundle_id": identifier,
            "bundle_hash": bundle_hash,
            "bundle_schema_version": "1",
            "importer_version": "1",
            "source_shape_version": "showdown-champions-1",
            "showdown": {
                "revision": revision,
                "commit_date": "2026-10-13",
                "clean_tree": True,
            },
            "pokeapi_sprites": {
                "revision": "ba403973fdf9d0ac59175813861e6a1f8ed5020c",
                "clean_tree": True,
            },
            "pokeapi_mapping": {
                "revision": "81d20919845b6a445969b9265aab5cec6b04cece",
                "clean_tree": True,
            },
            "formats": regulations,
            "mechanics_profile_id": "champions-level-50-v1",
            "sprite_provenance": sprite_provenance,
            "validation_status": "valid",
            "validation_sha256": _hash(destination / "validation.json"),
            "overlays": [],
            "counts": counts,
            "files": files,
        },
    )
    return destination


def _rewrite_bundle(
    directory: Path, filename: str, mutate: Any, *, asset_path: str | None = None
) -> Path:
    if asset_path is None:
        path = directory / filename
        value = json.loads(path.read_text(encoding="utf-8"))
        mutate(value)
        _write_json(path, value)
    else:
        mutate(directory / asset_path)
    manifest_path = directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    files = [
        {
            "path": path.relative_to(directory).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": _hash(path),
        }
        for path in sorted(
            path for path in directory.rglob("*") if path.is_file() and path.name != "manifest.json"
        )
    ]
    bundle_hash = hashlib.sha256(canonical_bytes(files)).hexdigest()
    identifier = f"showdown-3a766f2c-s1-i1-{bundle_hash[:12]}"
    manifest["files"] = files
    manifest["bundle_hash"] = bundle_hash
    manifest["bundle_id"] = identifier
    manifest["validation_sha256"] = _hash(directory / "validation.json")
    destination = directory.with_name(identifier)
    directory.rename(destination)
    _write_json(destination / "manifest.json", manifest)
    return destination


def _rewrite_multi_release(source: Path, tmp_path: Path, filename: str, mutate: Any) -> Path:
    """Copy and consistently re-identify the committed schema-2 release after mutation."""
    directory = tmp_path / source.name
    shutil.copytree(source, directory)
    path = directory / filename
    value = json.loads(path.read_text(encoding="utf-8"))
    mutate(value)
    _write_json(path, value)
    manifest_path = directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    files = [
        {
            "path": asset.relative_to(directory).as_posix(),
            "bytes": asset.stat().st_size,
            "sha256": _hash(asset),
        }
        for asset in sorted(
            asset
            for asset in directory.rglob("*")
            if asset.is_file() and asset.name != "manifest.json"
        )
    ]
    bundle_hash = hashlib.sha256(canonical_bytes(files)).hexdigest()
    identifier = f"showdown-multi-s2-i3-{bundle_hash[:12]}"
    manifest["files"] = files
    manifest["bundle_hash"] = bundle_hash
    manifest["bundle_id"] = identifier
    manifest["validation_sha256"] = _hash(directory / "validation.json")
    destination = directory.with_name(identifier)
    directory.rename(destination)
    _write_json(destination / "manifest.json", manifest)
    return destination


@pytest.fixture
def synthetic_loader(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        pokemon_data_services,
        "read_bundle",
        lambda directory: read_bundle(directory, require_pinned=False),
    )


def test_bundle_reader_keeps_legality_distinct_from_toggle_profiles(tmp_path: Path) -> None:
    bundle = read_bundle(_bundle(tmp_path), require_pinned=False)

    assert len(bundle.records["profiles.json"]) == 4
    assert len(bundle.records["regulation_memberships.json"]) == 2
    assert "m-b:examplemonmega" in bundle.semantic_inventory["profiles.json"]
    assert "m-b:examplemonmega" not in bundle.semantic_inventory["regulation_memberships.json"]


def test_production_bundle_reader_rejects_non_allowlisted_bundle(tmp_path: Path) -> None:
    with pytest.raises(BundleReadError, match="not an allowlisted pinned release"):
        read_bundle(_bundle(tmp_path))


def test_bundle_reader_rejects_a_modified_declared_file(tmp_path: Path) -> None:
    directory = _bundle(tmp_path)
    (directory / "forms.json").write_text("[]\n", encoding="utf-8")

    with pytest.raises(BundleReadError, match="does not match manifest"):
        read_bundle(directory, require_pinned=False)


def test_bundle_reader_rejects_old_or_unknown_sprite_fields(tmp_path: Path) -> None:
    directory = _rewrite_bundle(
        _bundle(tmp_path),
        "sprites.json",
        lambda records: records[0].__setitem__("selected_frame", 2),
    )

    with pytest.raises(BundleReadError, match="unexpected record shape"):
        read_bundle(directory, require_pinned=False)


def test_bundle_reader_inspects_webp_bytes(tmp_path: Path) -> None:
    directory = _bundle(tmp_path)
    sprites = json.loads((directory / "sprites.json").read_text(encoding="utf-8"))
    sprite_path = sprites[0]["path"]

    def corrupt(path: Path) -> None:
        path.write_bytes(b"not a WebP")
        sprites[0]["sha256"] = _hash(path)
        _write_json(directory / "sprites.json", sprites)

    directory = _rewrite_bundle(directory, "", corrupt, asset_path=sprite_path)

    with pytest.raises(BundleReadError, match="invalid WebP RIFF header"):
        read_bundle(directory, require_pinned=False)


@pytest.mark.parametrize(
    ("replacement", "expected"),
    [
        (_static_webp(flags=0x12), "is_animated.*True"),
        (_static_webp(flags=0x18), "has_metadata.*True"),
        (_static_webp(width=383), "dimensions 383"),
        (_static_webp(flags=0, alpha_chunk=False), "has_alpha.*False"),
    ],
)
def test_bundle_reader_rejects_wrong_static_webp_properties(
    tmp_path: Path, replacement: bytes, expected: str
) -> None:
    directory = _bundle(tmp_path)
    sprites = json.loads((directory / "sprites.json").read_text(encoding="utf-8"))
    sprite_path = sprites[0]["path"]

    def replace(path: Path) -> None:
        path.write_bytes(replacement)
        sprites[0]["sha256"] = _hash(path)
        _write_json(directory / "sprites.json", sprites)

    directory = _rewrite_bundle(directory, "", replace, asset_path=sprite_path)

    with pytest.raises(BundleReadError, match=expected):
        read_bundle(directory, require_pinned=False)


def test_bundle_reader_rejects_extended_webp_without_image_payload(tmp_path: Path) -> None:
    directory = _bundle(tmp_path)
    sprites = json.loads((directory / "sprites.json").read_text(encoding="utf-8"))
    sprite_path = sprites[0]["path"]
    header = bytes([0x10, 0, 0, 0]) + (383).to_bytes(3, "little") * 2
    chunks = b"VP8X" + struct.pack("<I", len(header)) + header + b"ALPH" + struct.pack("<I", 0)
    malformed = b"RIFF" + struct.pack("<I", len(chunks) + 4) + b"WEBP" + chunks

    def replace(path: Path) -> None:
        path.write_bytes(malformed)
        sprites[0]["sha256"] = _hash(path)
        _write_json(directory / "sprites.json", sprites)

    directory = _rewrite_bundle(directory, "", replace, asset_path=sprite_path)

    with pytest.raises(BundleReadError, match="exactly one WebP image payload"):
        read_bundle(directory, require_pinned=False)


def test_bundle_reader_rejects_legacy_learnset_provenance(tmp_path: Path) -> None:
    def use_legacy_field(records: list[dict[str, Any]]) -> None:
        record = records[0]
        record["provenance"] = record.pop("form_resolution")

    directory = _rewrite_bundle(_bundle(tmp_path), "learnsets.json", use_legacy_field)

    with pytest.raises(BundleReadError, match="unexpected record shape"):
        read_bundle(directory, require_pinned=False)


def test_bundle_reader_rejects_counts_that_do_not_match_records(tmp_path: Path) -> None:
    directory = _rewrite_bundle(
        _bundle(tmp_path),
        "validation.json",
        lambda validation: validation["counts"].__setitem__("forms", 999),
    )

    with pytest.raises(BundleReadError, match="counts do not match"):
        read_bundle(directory, require_pinned=False)


def test_bundle_reader_rejects_unpinned_sprite_source(tmp_path: Path) -> None:
    directory = _bundle(tmp_path)
    manifest_path = directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["pokeapi_sprites"]["revision"] = "0" * 40
    _write_json(manifest_path, manifest)

    with pytest.raises(BundleReadError, match="unexpected pokeapi_sprites source"):
        read_bundle(directory, require_pinned=False)


def test_bundle_reader_rejects_missing_nested_fields_with_context(tmp_path: Path) -> None:
    directory = _rewrite_bundle(
        _bundle(tmp_path),
        "profiles.json",
        lambda profiles: profiles[0]["stats"].pop("spe"),
    )

    with pytest.raises(BundleReadError, match=r"profiles.json\[0\]:stats"):
        read_bundle(directory, require_pinned=False)


def test_committed_release_has_pinned_real_counts() -> None:
    releases = settings.REPOSITORY_ROOT / "src" / "data" / "releases"
    expected_bundle = releases / "showdown-3a766f2c-s1-i2-4bedbf1eb44d"
    if not expected_bundle.is_dir():
        pytest.skip("the data owner has not published the reviewed release yet")

    bundle = read_bundle(expected_bundle)

    for name, expected in EXPECTED_PINNED_COUNTS.items():
        assert bundle.manifest["counts"][name] == expected
    assert bundle.manifest["counts"]["legal_forms_by_regulation"] == {
        "m-b": 314,
        "m-c": 349,
    }
    memberships = json.loads(
        (expected_bundle / "regulation_memberships.json").read_text(encoding="utf-8")
    )
    member_keys = {
        (membership["regulation_id"], membership["form_id"]) for membership in memberships
    }
    assert not member_keys.intersection(
        {
            (regulation_id, form_id)
            for regulation_id in ("m-b", "m-c")
            for form_id in ("magearnamega", "magearnaoriginalmega")
        }
    )
    assert bundle.provenance["showdown"]["source_counts"] == EXPECTED_SOURCE_COUNTS


def test_current_and_preceding_committed_releases_remain_readable_for_rollback() -> None:
    releases = settings.REPOSITORY_ROOT / "src" / "data" / "releases"
    multi = releases / "showdown-multi-s2-i3-fc85b358deaa"
    current = releases / "showdown-3a766f2c-s1-i2-4bedbf1eb44d"
    preceding = releases / "showdown-3a766f2c-s1-i1-923ba416555c"
    if not multi.is_dir() or not current.is_dir() or not preceding.is_dir():
        pytest.skip("all three reviewed releases are required")

    multi_bundle = read_bundle(multi)
    assert multi_bundle.identifier == multi.name
    for name, expected in MULTI_PINNED_COUNTS.items():
        assert multi_bundle.manifest["counts"][name] == expected
    for name, grouped_expected in MULTI_GROUP_COUNTS.items():
        assert multi_bundle.manifest["counts"][name] == grouped_expected
    assert [item["id"] for item in multi_bundle.records["regulations.json"]] == [
        "m-a",
        "m-b",
        "m-c",
    ]
    assert multi_bundle.manifest["showdown_sources"] == [
        {
            "clean_tree": True,
            "commit_date": "2026-04-10",
            "regulations": ["m-a"],
            "revision": "b555f4d8ce7250e72939fe0c12cc5b303741d203",
        },
        {
            "clean_tree": True,
            "commit_date": "2026-10-13",
            "regulations": ["m-b", "m-c"],
            "revision": "3a766f2cfb5e51c1e428cfe87d0dba91a8f01640",
        },
    ]
    assert {
        entry["source_mod"]
        for entry in multi_bundle.records["learnsets.json"]
        if entry["regulation_id"] == "m-a"
    } <= {"base", "champions"}
    assert read_bundle(current).identifier == current.name
    assert read_bundle(preceding).identifier == preceding.name


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("importer_version", "2", "unsupported importer version"),
        ("source_shape_version", "showdown-champions-1", "unsupported source shape version"),
    ],
)
def test_multi_release_rejects_mismatched_contract_versions(
    settings: Any,
    tmp_path: Path,
    field: str,
    value: str,
    message: str,
) -> None:
    source = settings.REPOSITORY_ROOT / "src/data/releases/showdown-multi-s2-i3-fc85b358deaa"
    directory = _rewrite_multi_release(
        source, tmp_path, "manifest.json", lambda manifest: manifest.__setitem__(field, value)
    )

    with pytest.raises(BundleReadError, match=message):
        read_bundle(directory, require_pinned=False)


def test_multi_release_rejects_reordered_showdown_sources(settings: Any, tmp_path: Path) -> None:
    source = settings.REPOSITORY_ROOT / "src/data/releases/showdown-multi-s2-i3-fc85b358deaa"
    directory = _rewrite_multi_release(
        source,
        tmp_path,
        "manifest.json",
        lambda manifest: manifest["showdown_sources"].reverse(),
    )

    with pytest.raises(BundleReadError, match="unexpected Showdown sources"):
        read_bundle(directory, require_pinned=False)


@pytest.mark.parametrize("malformed", [False, True])
def test_multi_release_rejects_tampered_or_malformed_source_provenance(
    settings: Any, tmp_path: Path, malformed: bool
) -> None:
    source = settings.REPOSITORY_ROOT / "src/data/releases/showdown-multi-s2-i3-fc85b358deaa"

    def mutate(provenance: dict[str, Any]) -> None:
        historical = provenance["showdown_sources"][0]
        if malformed:
            historical.pop("revision")
        else:
            historical["regulations"] = ["m-b"]

    directory = _rewrite_multi_release(source, tmp_path, "provenance.json", mutate)

    message = r"showdown_sources\[0\]" if malformed else "unexpected Showdown source"
    with pytest.raises(BundleReadError, match=message):
        read_bundle(directory, require_pinned=False)


def test_arbitrary_valid_i1_bundle_is_not_an_allowlisted_runtime_bundle(tmp_path: Path) -> None:
    release = _bundle(tmp_path)
    assert read_bundle(release, require_pinned=False).identifier == release.name

    with pytest.raises(BundleReadError, match="not an allowlisted pinned release"):
        read_bundle(release)


@pytest.mark.django_db(transaction=True)
def test_committed_releases_load_and_support_audited_rollback_and_reactivation(
    settings: Any,
) -> None:
    releases = settings.REPOSITORY_ROOT / "src" / "data" / "releases"
    multi_path = releases / "showdown-multi-s2-i3-fc85b358deaa"
    current_path = releases / "showdown-3a766f2c-s1-i2-4bedbf1eb44d"
    preceding_path = releases / "showdown-3a766f2c-s1-i1-923ba416555c"
    if not multi_path.is_dir() or not current_path.is_dir() or not preceding_path.is_dir():
        pytest.skip("all three reviewed releases are required")
    settings.POKEMON_DATA_RELEASES_ROOT = releases

    multi = load_pokemon_data(multi_path).version
    repeated_multi = load_pokemon_data(multi_path)
    current = load_pokemon_data(current_path).version
    preceding = load_pokemon_data(preceding_path).version
    activate_pokemon_data(multi.pk)
    assert Regulation.objects.filter(version=multi, canonical_id="m-a").exists()
    ma_charizard = PokemonProfile.objects.get(
        regulation__version=multi,
        regulation__canonical_id="m-a",
        form__canonical_id="charizard",
    )
    assert (
        ma_charizard.hp,
        ma_charizard.attack,
        ma_charizard.defense,
        ma_charizard.special_attack,
        ma_charizard.special_defense,
        ma_charizard.speed,
        ma_charizard.bst,
    ) == (78, 84, 78, 109, 85, 100, 534)
    assert repeated_multi.created is False
    assert repeated_multi.version.pk == multi.pk
    user = User.objects.create_user(username="ma-reader", password="test-password")
    client = Client()
    client.force_login(user)
    rollback_current = activate_pokemon_data(current.pk)
    assert not Regulation.objects.filter(version=current, canonical_id="m-a").exists()
    unavailable_ma = client.get("/?regulation=m-a")
    assert unavailable_ma.status_code == 503
    assert unavailable_ma.context.get("regulation_selector") is None
    assert "data-regulation-selector" not in unavailable_ma.content.decode()
    available_mb = client.get("/?regulation=m-b")
    assert available_mb.status_code == 200
    assert available_mb.context["pokedex_bootstrap"]["regulation"]["id"] == "m-b"
    assert available_mb.context["regulation_selector"]["selected_id"] == "m-b"
    assert [choice["id"] for choice in available_mb.context["regulation_selector"]["choices"]] == [
        "m-c",
        "m-b",
    ]
    rollback = activate_pokemon_data(preceding.pk)
    reactivation = activate_pokemon_data(multi.pk)

    assert rollback_current.previous_identifier == multi.pk
    assert rollback_current.new_identifier == current.pk
    assert rollback.previous_identifier == current.pk
    assert rollback.new_identifier == preceding.pk
    assert reactivation.previous_identifier == preceding.pk
    assert reactivation.new_identifier == multi.pk
    assert ActiveDataVersion.objects.get().version_id == multi.pk
    assert DataActivation.objects.count() == 4
    assert RegulationMembership.objects.filter(profile__version=multi).count() == 935
    assert RegulationMembership.objects.filter(profile__version=current).count() == 663
    assert RegulationMembership.objects.filter(profile__version=preceding).count() == 667

    index_url = f"/pokedex/data/m-a/index/?version={multi.pk}"
    assert Client().get(index_url).status_code == 302
    with CaptureQueriesContext(connection) as queries:
        index_response = client.get(index_url)
    assert index_response.status_code == 200
    assert len(queries) <= 8
    assert index_response.json()["regulation"]["id"] == "m-a"
    assert (
        client.get(index_url, HTTP_IF_NONE_MATCH=index_response.headers["ETag"]).status_code == 304
    )

    details_url = f"/pokedex/data/m-a/details/?version={multi.pk}"
    details_response = client.get(details_url)
    assert details_response.status_code == 200
    assert details_response.json()["regulation_id"] == "m-a"

    form_url = f"/pokedex/data/m-a/pokemon/charizard/details/?version={multi.pk}"
    form_response = client.get(form_url)
    assert form_response.status_code == 200
    assert form_response.json()["form"]["id"] == "charizard"

    sprite_url = f"/pokedex/sprites/{multi.pk}/charizard/normal.webp"
    sprite_response = client.get(sprite_url)
    assert sprite_response.status_code == 200
    assert sprite_response.headers["Content-Type"] == "image/webp"
    sprite_response.close()

    stale = client.get(f"/pokedex/data/m-a/index/?version={current.pk}")
    assert stale.status_code == 409
    assert stale.json()["active_version"] == multi.pk
    assert client.post(index_url).status_code == 405


def test_build_command_preserves_paths_and_delegates_to_data_importer(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    observed: dict[str, object] = {}

    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        observed["command"] = command
        observed["kwargs"] = kwargs
        return subprocess.CompletedProcess(command, 0, stdout="built bundle\n", stderr="")

    monkeypatch.setattr(
        "bagredex.pokemon_data.management.commands.build_pokemon_data.subprocess.run", fake_run
    )
    showdown = tmp_path / "showdown with spaces"
    sprites = tmp_path / "sprites with spaces"
    pokeapi = tmp_path / "pokeapi with spaces"
    releases = tmp_path / "releases with spaces"

    build_pokemon_data.Command().handle(
        showdown=showdown, sprites=sprites, pokeapi=pokeapi, releases=releases
    )

    command = observed["command"]
    assert isinstance(command, list)
    assert command[1:] == [
        "-m",
        "src.data.importer",
        "build",
        "--showdown",
        str(showdown),
        "--sprites",
        str(sprites),
        "--pokeapi",
        str(pokeapi),
        "--releases",
        str(releases),
    ]
    assert observed["kwargs"] == {
        "cwd": settings.REPOSITORY_ROOT,
        "check": False,
        "capture_output": True,
        "text": True,
    }


def test_load_command_surfaces_bundle_validation_errors(tmp_path: Path) -> None:
    with pytest.raises(CommandError, match="bundle path does not exist"):
        call_command("load_pokemon_data", tmp_path / "missing bundle")


def _create_loaded_version(identifier: str, hash_character: str = "a") -> DataVersion:
    version = DataVersion.objects.create(
        id=identifier,
        bundle_hash=hash_character * 64,
        bundle_schema_version="1",
        importer_version="1",
        source_shape_version="showdown-champions-1",
        provenance={},
        validation_summary={"status": "valid"},
        semantic_inventory={},
        semantic_diff={},
        manifest={},
    )
    DataVersion.objects.filter(pk=version.pk).update(status=DataVersion.Status.LOADED)
    version.status = DataVersion.Status.LOADED
    return version


@pytest.mark.django_db(transaction=True)
def test_load_is_atomic_idempotent_and_does_not_infer_membership(
    tmp_path: Path, synthetic_loader: None
) -> None:
    directory = _bundle(tmp_path)

    first = load_pokemon_data(directory)
    second = load_pokemon_data(directory)

    assert first.created is True
    assert second.created is False
    assert second.version.pk == first.version.pk
    assert DataVersion.objects.count() == 1
    assert PokemonProfile.objects.count() == 4
    assert RegulationMembership.objects.count() == 2


@pytest.mark.django_db(transaction=True)
def test_activation_is_audited_and_if_none_never_replaces_active_data() -> None:
    first = _create_loaded_version("first", "a")
    _create_loaded_version("second", "b")

    initial = activate_pokemon_data("first")
    skipped = activate_pokemon_data("second", if_none=True)
    repeated = activate_pokemon_data("first")

    assert initial.changed is True
    assert skipped.skipped_if_none is True
    assert skipped.previous_identifier == first.pk
    assert repeated.changed is False
    audit = cast(
        Any,
        DataActivation.objects.values_list("previous_version_id", "new_version_id").get(),
    )
    assert audit == (None, "first")


@pytest.mark.django_db(transaction=True)
def test_loaded_versions_are_database_immutable() -> None:
    version = _create_loaded_version("immutable")

    with pytest.raises(DatabaseError, match="immutable"), transaction.atomic():
        DataVersion.objects.filter(pk=version.pk).update(bundle_hash="b" * 64)


@pytest.mark.django_db(transaction=True)
def test_loaded_child_rows_reject_insert_update_and_delete(
    tmp_path: Path, synthetic_loader: None
) -> None:
    version = load_pokemon_data(_bundle(tmp_path)).version
    existing = Type.objects.filter(version=version).first()
    existing_sprite = Sprite.objects.filter(version=version).first()
    assert existing is not None
    assert existing_sprite is not None

    with pytest.raises(DatabaseError, match="immutable"), transaction.atomic():
        Type.objects.create(version=version, canonical_id="new-type", name="New Type")
    with pytest.raises(DatabaseError, match="immutable"), transaction.atomic():
        Type.objects.filter(pk=existing.pk).update(name="Changed")
    with pytest.raises(DatabaseError, match="immutable"), transaction.atomic():
        existing_sprite.delete()


@pytest.mark.django_db(transaction=True)
def test_loading_rows_cannot_be_reparented_into_a_loaded_version(
    tmp_path: Path, synthetic_loader: None
) -> None:
    loaded_version = load_pokemon_data(_bundle(tmp_path)).version
    loaded_profile = PokemonProfile.objects.filter(version=loaded_version).first()
    assert loaded_profile is not None
    loading_version = DataVersion.objects.create(
        id="loading-owner",
        bundle_hash="c" * 64,
        bundle_schema_version="1",
        importer_version="1",
        source_shape_version="showdown-champions-1",
        provenance={},
        validation_summary={"status": "valid"},
        semantic_inventory={},
        semantic_diff={},
        manifest={},
    )
    mechanics = MechanicsProfile.objects.create(
        version=loading_version,
        canonical_id="mechanics",
        level=50,
        sp_minimum=0,
        sp_maximum=32,
        hp_formula="base + sp + 75",
        other_formula="truncate",
        nature_percentages={"neutral": 100},
    )
    regulation = Regulation.objects.create(
        version=loading_version,
        canonical_id="m-c",
        name="M-C",
        showdown_format_id="format",
        mod="champions",
        ruleset=[],
        mechanics_profile=mechanics,
    )
    form = PokemonForm(
        version=loading_version,
        canonical_id="loading-form",
        name="Loading Form",
        national_dex_number=1,
        form_label="",
        is_mega=False,
        sprite_id="loading-form",
    )
    form.base_form_id = form.pk
    form.save()
    profile = PokemonProfile.objects.create(
        version=loading_version,
        regulation=regulation,
        form=form,
        hp=1,
        attack=1,
        defense=1,
        special_attack=1,
        special_defense=1,
        speed=1,
        bst=6,
    )
    loading_type = Type.objects.create(
        version=loading_version, canonical_id="loading-type", name="Loading Type"
    )
    profile_type = PokemonProfileType.objects.create(profile=profile, type=loading_type, position=0)

    with pytest.raises(DatabaseError, match="reparented into sealed"), transaction.atomic():
        Type.objects.filter(pk=loading_type.pk).update(version=loaded_version)
    with pytest.raises(DatabaseError, match="reparented into sealed"), transaction.atomic():
        PokemonProfileType.objects.filter(pk=profile_type.pk).update(profile=loaded_profile)


@pytest.mark.django_db(transaction=True)
def test_activation_rejects_loading_version_until_it_is_sealed() -> None:
    with pytest.raises(DatabaseError, match="begin in loading state"), transaction.atomic():
        DataVersion.objects.create(
            id="invalidly-ready",
            bundle_hash="b" * 64,
            bundle_schema_version="1",
            importer_version="1",
            source_shape_version="showdown-champions-1",
            provenance={},
            validation_summary={},
            semantic_inventory={},
            semantic_diff={},
            manifest={},
            status=DataVersion.Status.LOADED,
        )

    version = DataVersion.objects.create(
        id="not-ready",
        bundle_hash="a" * 64,
        bundle_schema_version="1",
        importer_version="1",
        source_shape_version="showdown-champions-1",
        provenance={},
        validation_summary={"status": "valid"},
        semantic_inventory={},
        semantic_diff={},
        manifest={},
    )

    with pytest.raises(pokemon_data_services.PokemonDataServiceError, match="does not exist"):
        activate_pokemon_data(version.pk)
    assert ActiveDataVersion.objects.get().version_id is None
    assert DataActivation.objects.count() == 0

    DataVersion.objects.filter(pk=version.pk).update(status=DataVersion.Status.LOADED)
    assert activate_pokemon_data(version.pk).changed is True


@pytest.mark.django_db(transaction=True)
def test_database_guard_rejects_cross_version_relationships() -> None:
    common = {
        "bundle_schema_version": "1",
        "importer_version": "1",
        "source_shape_version": "showdown-champions-1",
        "provenance": {},
        "validation_summary": {"status": "valid"},
        "semantic_inventory": {},
        "semantic_diff": {},
        "manifest": {},
    }
    first = DataVersion.objects.create(id="first-version", bundle_hash="a" * 64, **common)
    second = DataVersion.objects.create(id="second-version", bundle_hash="b" * 64, **common)
    mechanics = MechanicsProfile.objects.create(
        version=second,
        canonical_id="champions-level-50-v1",
        level=50,
        sp_minimum=0,
        sp_maximum=32,
        hp_formula="base + sp + 75",
        other_formula="truncate",
        nature_percentages={"neutral": 100},
    )

    with pytest.raises(DatabaseError, match="same version"), transaction.atomic():
        Regulation.objects.create(
            version=first,
            canonical_id="m-c",
            name="M-C",
            showdown_format_id="format",
            mod="champions",
            ruleset=[],
            mechanics_profile=mechanics,
        )


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("failing_model", [PokemonProfile, Sprite])
def test_load_rolls_back_after_mid_or_end_failure(
    failing_model: Any,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    synthetic_loader: None,
) -> None:
    directory = _bundle(tmp_path)

    def fail(*args: object, **kwargs: object) -> None:
        raise RuntimeError("injected load failure")

    monkeypatch.setattr(failing_model.objects, "bulk_create", fail)

    with pytest.raises(RuntimeError, match="injected load failure"):
        load_pokemon_data(directory)

    assert DataVersion.objects.count() == 0


@pytest.mark.django_db(transaction=True)
def test_activation_supports_audited_rollback() -> None:
    _create_loaded_version("old", "a")
    _create_loaded_version("new", "b")

    activate_pokemon_data("old")
    activate_pokemon_data("new")
    rollback = activate_pokemon_data("old")

    assert rollback.previous_identifier == "new"
    assert rollback.new_identifier == "old"
    assert DataActivation.objects.count() == 3


@pytest.mark.django_db(transaction=True)
def test_load_and_activate_commands_report_observable_results(
    tmp_path: Path, synthetic_loader: None
) -> None:
    directory = _bundle(tmp_path)
    load_output = io.StringIO()
    activate_output = io.StringIO()

    call_command("load_pokemon_data", directory, stdout=load_output)
    identifier = DataVersion.objects.get().pk
    call_command("activate_pokemon_data", identifier, stdout=activate_output)

    assert f"{identifier}: loaded" in load_output.getvalue()
    assert f"none -> {identifier}" in activate_output.getvalue()


def _thread_call(function: Any, *args: object, **kwargs: object) -> Any:
    close_old_connections()
    try:
        return function(*args, **kwargs)
    finally:
        close_old_connections()


@pytest.mark.django_db(transaction=True)
def test_concurrent_if_none_has_one_winner(monkeypatch: pytest.MonkeyPatch) -> None:
    _create_loaded_version("candidate-a", "a")
    _create_loaded_version("candidate-b", "b")
    barrier = Barrier(2)
    monkeypatch.setattr(pokemon_data_services, "_before_pointer_lock", lambda _: barrier.wait())

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda identifier: _thread_call(activate_pokemon_data, identifier, if_none=True),
                ("candidate-a", "candidate-b"),
            )
        )

    assert sum(result.changed for result in results) == 1
    assert sum(result.skipped_if_none for result in results) == 1
    audit = DataActivation.objects.get()
    winner = next(result.new_identifier for result in results if result.changed)
    assert (audit.previous_version_id, audit.new_version_id) == (None, winner)
    assert ActiveDataVersion.objects.get().version_id == winner


@pytest.mark.django_db(transaction=True)
def test_concurrent_explicit_activations_serialize_without_lost_audits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for identifier, character in (("base", "a"), ("candidate-a", "b"), ("candidate-b", "c")):
        _create_loaded_version(identifier, character)
    activate_pokemon_data("base")
    barrier = Barrier(2)
    monkeypatch.setattr(pokemon_data_services, "_before_pointer_lock", lambda _: barrier.wait())

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda identifier: _thread_call(activate_pokemon_data, identifier),
                ("candidate-a", "candidate-b"),
            )
        )

    assert all(result.changed for result in results)
    audits = cast(
        list[tuple[str | None, str]],
        list(
            DataActivation.objects.order_by("id").values_list(
                "previous_version_id", "new_version_id"
            )
        ),
    )
    assert audits[0] == (None, "base")
    assert audits[1][0] == "base"
    assert audits[2][0] == audits[1][1]
    assert ActiveDataVersion.objects.get().version_id == audits[2][1]


@pytest.mark.django_db(transaction=True)
def test_concurrent_load_is_idempotent(
    tmp_path: Path, synthetic_loader: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    directory = _bundle(tmp_path)
    barrier = Barrier(2)
    monkeypatch.setattr(pokemon_data_services, "_before_pointer_lock", lambda _: barrier.wait())

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda _: _thread_call(load_pokemon_data, directory),
                range(2),
            )
        )

    assert sorted(result.created for result in results) == [False, True]
    assert DataVersion.objects.count() == 1

"""Build, validate, and compare portable Pokémon data bundles."""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import tarfile
import zlib
from collections import Counter
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "3"
IMPORTER_VERSION = "4"
LEGACY_IMPORTER_VERSION = "1"
SOURCE_SHAPE_VERSION = "showdown-champions-multi-revision-3"
EXPECTED_REVISION = "3a766f2cfb5e51c1e428cfe87d0dba91a8f01640"
EXPECTED_COMMIT_DATE = "2026-10-13"
HISTORICAL_REVISION = "b555f4d8ce7250e72939fe0c12cc5b303741d203"
HISTORICAL_COMMIT_DATE = "2026-04-10"
RETAINED_RELEASES = {
    "showdown-3a766f2c-s1-i1-923ba416555c":
        "923ba416555ca33c4b5d17f84d246661d6ef61a6170959aac807454a1978ead2",
    "showdown-3a766f2c-s1-i2-4bedbf1eb44d":
        "4bedbf1eb44d797b319aa5f750698463fb5cca6a63de6ff725d5c0bb0bc115a9",
}
EXPECTED_SPRITES_REVISION = "ba403973fdf9d0ac59175813861e6a1f8ed5020c"
EXPECTED_POKEAPI_REVISION = "81d20919845b6a445969b9265aab5cec6b04cece"
SHOWDOWN_NOTICE_PATH = "POKEMON-SHOWDOWN-LICENSE.txt"
SHOWDOWN_NOTICE_SHA256 = "b2002a9fd52ba8db3783a05fbdebfb09c34fd09513b90f6b390a2c0dfbc93ed0"
WEBP_TOOL_VERSION = "1.3.2"
SPRITE_MAPPING_VERSION = "pokeapi-csv-v1"
SPRITE_MAPPING_SHA256 = "2fd464a37c34f7c543ebd153f39ca6c47f3d6788617b932db6f75f640a537602"
LEGACY_SPRITE_MAPPING_SHA256 = "4d77de037da77591d41b778850b4ec2ec2d9940dacc7fdbea5a8c4b03b7e15d4"
SPRITE_EXCEPTIONS = {
    "aegislash": "aegislash-shield",
    "basculegion": "basculegion-male",
    "basculegionf": "basculegion-female",
    "gourgeist": "gourgeist-average",
    "indeedee": "indeedee-male",
    "indeedeef": "indeedee-female",
    "lycanroc": "lycanroc-midday",
    "maushold": "maushold-family-of-four",
    "meowstic": "meowstic-male",
    "meowsticfmega": "meowstic-female-mega",
    "meowsticmmega": "meowstic-male-mega",
    "mimikyu": "mimikyu-disguised",
    "morpeko": "morpeko-full-belly",
    "palafin": "palafin-zero",
    "pyroar": "pyroar-male",
    "squawkabilly": "squawkabilly-green-plumage",
    "squawkabillyblue": "squawkabilly-blue-plumage",
    "squawkabillywhite": "squawkabilly-white-plumage",
    "squawkabillyyellow": "squawkabilly-yellow-plumage",
    "taurospaldeaaqua": "tauros-paldea-aqua-breed",
    "taurospaldeablaze": "tauros-paldea-blaze-breed",
    "taurospaldeacombat": "tauros-paldea-combat-breed",
    "toxtricity": "toxtricity-amped",
}
CWEBP_ARGUMENTS = (
    "cwebp", "input.png", "-resize", "384", "384", "-q", "82",
    "-alpha_q", "100", "-m", "6", "-pass", "10", "-sharp_yuv", "-metadata",
    "none", "-o", "output.webp",
)
MECHANICS_PROFILE = {
    "id": "champions-level-50-v1",
    "level": 50,
    "sp_minimum": 0,
    "sp_maximum": 32,
    "sp_total_max": 66,
    "hp_formula": "base + sp + 75",
    "other_formula": "truncate((base + sp + 20) * nature_percent / 100)",
    "nature_percentages": {"hindering": 90, "neutral": 100, "increasing": 110},
}
DATA_FILES = (
    "mechanics_profiles.json",
    "regulations.json",
    "forms.json",
    "types.json",
    "abilities.json",
    "moves.json",
    "items.json",
    "item_profiles.json",
    "natures.json",
    "move_flags.json",
    "regulation_memberships.json",
    "profiles.json",
    "ability_profiles.json",
    "move_profiles.json",
    "move_flag_relations.json",
    "mega_relations.json",
    "mega_item_relations.json",
    "learnsets.json",
    "sprite_mappings.json",
    "sprites.json",
)
LEGACY_DATA_FILES = tuple(
    name for name in DATA_FILES
    if name not in {"items.json", "item_profiles.json", "natures.json", "mega_item_relations.json"}
)
FILE_KEYS = {
    "mechanics_profiles.json": ("id",),
    "regulations.json": ("id",),
    "forms.json": ("id",),
    "types.json": ("id",),
    "abilities.json": ("id",),
    "moves.json": ("id",),
    "items.json": ("id",),
    "item_profiles.json": ("regulation_id", "id"),
    "natures.json": ("id",),
    "move_flags.json": ("id",),
    "regulation_memberships.json": ("regulation_id", "form_id"),
    "profiles.json": ("regulation_id", "form_id"),
    "ability_profiles.json": ("regulation_id", "id"),
    "move_profiles.json": ("regulation_id", "id"),
    "move_flag_relations.json": ("regulation_id", "move_id", "flag_id"),
    "mega_relations.json": ("mega_form_id",),
    "mega_item_relations.json": ("regulation_id", "item_id", "base_form_id"),
    "learnsets.json": ("regulation_id", "form_id", "move_id"),
    "sprite_mappings.json": ("form_id",),
    "sprites.json": ("form_id", "variant"),
}
ALLOWED_MOVE_FLAGS = frozenset(
    {
        "allyanim", "bypasssub", "bite", "bullet", "cantusetwice", "charge", "contact",
        "dance", "defrost", "distance", "failcopycat", "failencore", "failinstruct",
        "failmefirst", "failmimic", "futuremove", "gravity", "heal", "metronome",
        "minimize", "mirror", "mustpressure", "noassist", "nonsky", "noparentalbond",
        "nosketch", "nosleeptalk", "pledgecombo",
        "powder", "protect", "pulse", "punch", "recharge", "reflectable", "slicing",
        "snatch", "sound", "wind",
    }
)
EXPECTED_PINNED_COUNTS = {
    "forms": 350, "types": 18, "memberships": 663, "profiles": 700,
    "abilities": 216, "ability_profiles": 432, "moves": 510, "move_profiles": 1020,
    "move_flags": 37, "move_flag_relations": 3928, "learnsets": 43429,
    "mega_relations": 82, "sprites": 700, "sprite_mappings": 350,
}
LEGACY_PINNED_COUNTS = {
    "forms": 353, "types": 18, "memberships": 667, "profiles": 706,
    "abilities": 217, "ability_profiles": 434, "moves": 510, "move_profiles": 1020,
    "move_flags": 37, "move_flag_relations": 3928, "learnsets": 43891,
    "mega_relations": 84, "sprites": 706, "sprite_mappings": 353,
}
MULTI_PINNED_COUNTS = {
    "forms": 350, "types": 18, "memberships": 935, "profiles": 1050,
    "abilities": 216, "ability_profiles": 645, "moves": 511, "move_profiles": 1513,
    "move_flags": 37, "move_flag_relations": 5833, "learnsets": 64935,
    "mega_relations": 82, "sprites": 700, "sprite_mappings": 350,
}
TEAM_PINNED_COUNTS = {
    **MULTI_PINNED_COUNTS,
    "items": 166,
    "item_profiles": 431,
    "natures": 21,
    "mega_item_relations": 214,
}


class BundleError(RuntimeError):
    """Raised when an input or portable bundle violates its contract."""


def _canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def _write_json(path: Path, value: Any) -> None:
    path.write_bytes(_canonical_bytes(value))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _run(command: list[str], cwd: Path | None = None) -> str:
    result = subprocess.run(command, cwd=cwd, check=False, capture_output=True, text=True)
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip()
        raise BundleError(f"{' '.join(command)} failed: {detail}")
    return result.stdout.strip()


def _verify_repository(repository: Path, revision: str, label: str) -> None:
    if not (repository / ".git").exists():
        raise BundleError(f"{repository}: expected a local Git checkout for {label}")
    actual_revision = _run(["git", "rev-parse", "HEAD"], repository)
    if actual_revision != revision:
        raise BundleError(f"{repository}: expected {label} revision {revision}, found {actual_revision}")
    dirty = _run(["git", "status", "--porcelain", "--untracked-files=no"], repository)
    if dirty:
        raise BundleError(f"{repository}: {label} tracked working tree is not clean")


def _verify_showdown(showdown: Path) -> None:
    if not (showdown / ".git").exists():
        raise BundleError(f"{showdown}: expected a local Git checkout")
    _verify_repository(showdown, EXPECTED_REVISION, "Pokémon Showdown")
    required = (
        "config/formats.ts", "data/pokedex.ts", "data/moves.ts", "data/abilities.ts",
        "data/items.ts", "data/natures.ts", "data/learnsets.ts", "data/text/moves.ts", "data/text/abilities.ts",
        "data/mods/champions/formats-data.ts",
        "data/mods/champions/moves.ts", "data/mods/champions/abilities.ts",
        "data/mods/champions/learnsets.ts", "data/mods/championsregmb/formats-data.ts",
        "data/mods/champions/items.ts", "data/mods/championsregmb/moves.ts",
        "data/mods/championsregmb/items.ts", "data/mods/championsregmb/learnsets.ts",
    )
    missing = [item for item in required if not (showdown / item).is_file()]
    if missing:
        raise BundleError(f"{showdown}: unsupported source shape; missing {', '.join(missing)}")


def _extract(
    showdown: Path, requested: str = "current", form_ids: list[str] | None = None
) -> dict[str, Any]:
    script = Path(__file__).with_name("extract.mjs")
    output = _run([
        "node", "--no-warnings", str(script), str(showdown), requested,
        ",".join(form_ids or []),
    ])
    try:
        return json.loads(output)
    except json.JSONDecodeError as error:
        raise BundleError(f"extractor returned invalid JSON: {error}") from error


HISTORICAL_PATHS = (
    "config/formats.ts", "data/pokedex.ts", "data/moves.ts", "data/abilities.ts", "data/items.ts", "data/natures.ts",
    "data/learnsets.ts", "data/text/moves.ts", "data/text/abilities.ts",
    "data/mods/champions/formats-data.ts", "data/mods/champions/moves.ts",
    "data/mods/champions/abilities.ts", "data/mods/champions/items.ts",
    "data/mods/champions/learnsets.ts", "LICENSE",
)


def _materialize_historical_tree(repository: Path, destination: Path) -> None:
    resolved = _run(["git", "rev-parse", f"{HISTORICAL_REVISION}^{{commit}}"], repository)
    if resolved != HISTORICAL_REVISION:
        raise BundleError(f"historical Showdown object resolved to {resolved}")
    commit_date = _run(["git", "show", "-s", "--format=%cs", HISTORICAL_REVISION], repository)
    if commit_date != HISTORICAL_COMMIT_DATE:
        raise BundleError(f"historical Showdown commit date changed: {commit_date}")
    result = subprocess.run(
        ["git", "archive", "--format=tar", HISTORICAL_REVISION, *HISTORICAL_PATHS],
        cwd=repository, check=False, capture_output=True,
    )
    if result.returncode:
        raise BundleError(f"historical Showdown tree is unavailable: {result.stderr.decode().strip()}")
    destination.mkdir()
    try:
        with tempfile.TemporaryFile() as archive_file:
            archive_file.write(result.stdout)
            archive_file.seek(0)
            with tarfile.open(fileobj=archive_file, mode="r:") as archive:
                names = {member.name for member in archive.getmembers() if member.isfile()}
                if names != set(HISTORICAL_PATHS):
                    raise BundleError(
                        "historical Showdown archive did not contain the exact allow-list"
                    )
                for member in archive.getmembers():
                    if (not (member.isfile() or member.isdir()) or member.name.startswith("/")
                            or ".." in Path(member.name).parts):
                        raise BundleError("historical Showdown archive contains an unsafe entry")
                archive.extractall(destination, filter="data")
    except (OSError, tarfile.TarError) as error:
        raise BundleError(f"historical Showdown archive is invalid: {error}") from error


def _combine_extractions(current: dict[str, Any], historical: dict[str, Any]) -> dict[str, Any]:
    if [item["id"] for item in historical["formats"]] != ["m-a"]:
        raise BundleError("historical extraction did not produce exactly Regulation M-A")
    if {item["id"] for item in current["formats"]} != {"m-b", "m-c"}:
        raise BundleError("current extraction did not produce Regulations M-B and M-C")
    if "natures" in historical and "natures" in current and historical["natures"] != current["natures"]:
        raise BundleError("cross-revision nature definitions conflict")
    forms: dict[str, dict[str, Any]] = {}
    for source in (historical, current):
        for form in source["forms"]:
            previous = forms.setdefault(form["id"], form)
            if previous != form:
                raise BundleError(f"cross-revision form identity conflict for {form['id']}")
    mega: dict[str, dict[str, str]] = {}
    for source in (historical, current):
        for relation in source["mega_relations"]:
            previous = mega.setdefault(relation["mega_form_id"], relation)
            if previous != relation:
                raise BundleError(f"cross-revision Mega relation conflict for {relation['mega_form_id']}")
    return {
        "formats": historical["formats"] + current["formats"],
        "forms": sorted(forms.values(), key=lambda item: item["id"]),
        "mega_relations": sorted(mega.values(), key=lambda item: item["mega_form_id"]),
        "natures": current.get("natures", historical.get("natures", [])),
        "regulations": {**historical["regulations"], **current["regulations"]},
        "source_counts": {
            "m-a": historical["source_counts"],
            "m-b,m-c": current["source_counts"],
        },
    }


def _records(extracted: dict[str, Any]) -> dict[str, Any]:
    regulations = []
    profiles = []
    memberships = []
    ability_profiles = []
    move_profiles = []
    move_flag_relations = []
    item_profiles = []
    mega_item_relations = []
    learnsets = []
    for regulation in extracted["formats"]:
        regulation_id = regulation["id"]
        regulations.append(
            {
                **regulation,
                "mechanics_profile_id": MECHANICS_PROFILE["id"],
            }
        )
        scoped = extracted["regulations"][regulation_id]
        memberships.extend({"regulation_id": regulation_id, **value} for value in scoped["memberships"])
        profiles.extend({"regulation_id": regulation_id, **value} for value in scoped["profiles"])
        ability_profiles.extend({"regulation_id": regulation_id, **value} for value in scoped["abilities"])
        for value in scoped["moves"]:
            move_profiles.append({"regulation_id": regulation_id, **{key: item for key, item in value.items() if key != "flags"}})
            move_flag_relations.extend(
                {"regulation_id": regulation_id, "move_id": value["id"], "flag_id": flag}
                for flag in value["flags"]
            )
        learnsets.extend({"regulation_id": regulation_id, **value} for value in scoped["learnsets"])
        for value in scoped["items"]:
            item_profiles.append({
                "regulation_id": regulation_id,
                "id": value["id"],
                "name": value["name"],
                "source_status": value["source_status"],
            })
            mega_item_relations.extend(
                {
                    "regulation_id": regulation_id,
                    "item_id": value["id"],
                    **relation,
                }
                for relation in value["mega_stone"]
                if relation["base_form_id"] in {form["id"] for form in extracted["forms"]}
                and relation["mega_form_id"] in {form["id"] for form in extracted["forms"]}
            )
    def identities(values: list[dict[str, Any]]) -> list[dict[str, str]]:
        by_id: dict[str, str] = {}
        for value in values:
            previous = by_id.setdefault(value["id"], value["name"])
            if previous != value["name"]:
                raise BundleError(f"identity {value['id']} has conflicting names {previous!r} and {value['name']!r}")
        return [{"id": key, "name": by_id[key]} for key in sorted(by_id)]
    type_names = sorted({name for profile in profiles for name in profile["types"]})
    types = [{"id": re.sub(r"[^a-z0-9]+", "", name.lower()), "name": name} for name in type_names]
    move_flags = sorted({value["flag_id"] for value in move_flag_relations})
    return {
        "mechanics_profiles.json": [MECHANICS_PROFILE],
        "regulations.json": sorted(regulations, key=lambda item: item["id"]),
        "forms.json": sorted(extracted["forms"], key=lambda item: item["id"]),
        "types.json": sorted(types, key=lambda item: item["id"]),
        "abilities.json": identities(ability_profiles),
        "moves.json": identities(move_profiles),
        "items.json": identities(item_profiles),
        "item_profiles.json": sorted(item_profiles, key=lambda item: (item["regulation_id"], item["id"])),
        "natures.json": extracted["natures"],
        "move_flags.json": [{"id": value} for value in move_flags],
        "regulation_memberships.json": sorted(
            memberships, key=lambda item: (item["regulation_id"], item["form_id"])
        ),
        "profiles.json": sorted(profiles, key=lambda item: (item["regulation_id"], item["form_id"])),
        "ability_profiles.json": sorted(ability_profiles, key=lambda item: (item["regulation_id"], item["id"])),
        "move_profiles.json": sorted(move_profiles, key=lambda item: (item["regulation_id"], item["id"])),
        "move_flag_relations.json": sorted(
            move_flag_relations, key=lambda item: (item["regulation_id"], item["move_id"], item["flag_id"])
        ),
        "mega_relations.json": extracted["mega_relations"],
        "mega_item_relations.json": sorted(
            mega_item_relations,
            key=lambda item: (item["regulation_id"], item["item_id"], item["base_form_id"]),
        ),
        "learnsets.json": sorted(
            learnsets, key=lambda item: (item["regulation_id"], item["form_id"], item["move_id"])
        ),
    }


def _apply_overlays(
    records: dict[str, Any], overrides: Path, fixtures: Path, output: Path
) -> list[dict[str, Any]]:
    candidates = sorted(path for path in overrides.iterdir() if path.name != "README.md")
    unknown = [path.name for path in candidates if not path.is_file() or path.suffix != ".json"]
    if unknown:
        raise BundleError(f"{overrides}: unrecognized override candidates {unknown}")
    applied: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_targets: set[tuple[str, tuple[str, ...]]] = set()
    required = {
        "id", "showdown_revision", "record", "rationale", "authoring_date", "before",
        "after", "fixture",
    }
    for path in candidates:
        try:
            overlay = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise BundleError(f"{path}: invalid override JSON: {error}") from error
        _fields(overlay, required, str(path))
        overlay_id = overlay["id"]
        if not isinstance(overlay_id, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", overlay_id):
            raise BundleError(f"{path}: invalid override id")
        if overlay_id in seen_ids:
            raise BundleError(f"{path}: duplicate override id {overlay_id}")
        seen_ids.add(overlay_id)
        if overlay["showdown_revision"] != EXPECTED_REVISION:
            raise BundleError(f"{path}: override targets another Showdown revision")
        if not isinstance(overlay["rationale"], str) or not overlay["rationale"].strip():
            raise BundleError(f"{path}: override rationale is required")
        try:
            datetime.date.fromisoformat(overlay["authoring_date"])
        except (TypeError, ValueError) as error:
            raise BundleError(f"{path}: invalid authoring date") from error
        if not isinstance(overlay["record"], str) or ":" not in overlay["record"]:
            raise BundleError(f"{path}: record must be '<data-file>:<key>'")
        filename, raw_key = overlay["record"].split(":", 1)
        if filename not in FILE_KEYS or filename not in records:
            raise BundleError(f"{path}: unrecognized target file {filename!r}")
        key = tuple(raw_key.split(":"))
        if len(key) != len(FILE_KEYS[filename]) or any(not value for value in key):
            raise BundleError(f"{path}: invalid key for {filename}")
        target = (filename, key)
        if target in seen_targets:
            raise BundleError(f"{path}: duplicate override target {overlay['record']}")
        seen_targets.add(target)
        matches = [
            record for record in records[filename]
            if tuple(str(record[field]) for field in FILE_KEYS[filename]) == key
        ]
        if len(matches) != 1:
            raise BundleError(f"{path}: target {overlay['record']} matched {len(matches)} records")
        if overlay["before"] != matches[0]:
            raise BundleError(f"{path}: before value no longer matches upstream")
        if not isinstance(overlay["after"], dict) or set(overlay["after"]) != set(matches[0]):
            raise BundleError(f"{path}: after value must preserve the record shape")
        after_key = tuple(str(overlay["after"][field]) for field in FILE_KEYS[filename])
        if after_key != key:
            raise BundleError(f"{path}: override cannot change its record key")
        fixture_relative = Path(overlay["fixture"])
        if fixture_relative.is_absolute() or ".." in fixture_relative.parts:
            raise BundleError(f"{path}: unsafe fixture path")
        fixture = fixtures / fixture_relative
        if not fixture.is_file():
            raise BundleError(f"{path}: missing regression fixture {overlay['fixture']}")
        try:
            fixture_value = json.loads(fixture.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise BundleError(f"{fixture}: invalid regression fixture: {error}") from error
        expected_fixture = {
            "overlay_id": overlay_id, "record": overlay["record"],
            "expected_before": overlay["before"], "expected_after": overlay["after"],
        }
        if fixture_value != expected_fixture:
            raise BundleError(f"{fixture}: regression fixture does not assert the overlay transition")
        records[filename][records[filename].index(matches[0])] = overlay["after"]
        bundled_overlay = output / "overlays" / path.name
        bundled_fixture = output / "overlay-fixtures" / f"{overlay_id}{fixture.suffix}"
        bundled_overlay.parent.mkdir(exist_ok=True)
        bundled_fixture.parent.mkdir(exist_ok=True)
        _write_json(bundled_overlay, overlay)
        shutil.copyfile(fixture, bundled_fixture)
        applied.append({
            "id": overlay_id,
            "record": overlay["record"],
            "path": bundled_overlay.relative_to(output).as_posix(),
            "sha256": _sha256(bundled_overlay),
            "fixture_path": bundled_fixture.relative_to(output).as_posix(),
            "fixture_sha256": _sha256(bundled_fixture),
        })
    return applied


def _to_id(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _load_sprite_mapping(forms: list[dict[str, Any]], pokeapi: Path) -> dict[str, dict[str, str]]:
    csv_path = pokeapi / "data/v2/csv/pokemon.csv"
    try:
        with csv_path.open(encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
    except OSError as error:
        raise BundleError(f"{csv_path}: {error}") from error
    expected_columns = {
        "id", "identifier", "species_id", "height", "weight", "base_experience",
        "order", "is_default",
    }
    if not rows or set(rows[0]) != expected_columns:
        raise BundleError(f"{csv_path}: unsupported pokemon.csv shape")
    by_identifier: dict[str, list[dict[str, str]]] = {}
    by_normalized: dict[str, list[dict[str, str]]] = {}
    for line, row in enumerate(rows, start=2):
        if set(row) != expected_columns or None in row.values():
            raise BundleError(f"{csv_path}:{line}: malformed pokemon.csv row")
        try:
            pokemon_id = int(row["id"])
            species_id = int(row["species_id"])
        except (TypeError, ValueError) as error:
            raise BundleError(f"{csv_path}:{line}: id and species_id must be integers") from error
        if pokemon_id <= 0 or species_id <= 0 or not re.fullmatch(r"[a-z0-9-]+", row["identifier"]):
            raise BundleError(f"{csv_path}:{line}: invalid Pokemon identity")
        by_identifier.setdefault(row["identifier"], []).append(row)
        by_normalized.setdefault(_to_id(row["identifier"]), []).append(row)
    result = {}
    for form in forms:
        exception = SPRITE_EXCEPTIONS.get(form["id"])
        if exception:
            candidates = by_identifier.get(exception, [])
            rule = "exception"
        else:
            candidates = by_normalized.get(form["id"], [])
            rule = "normalized-identifier"
        if len(candidates) != 1:
            raise BundleError(f"{csv_path}: {form['id']} maps to {len(candidates)} PokeAPI Pokemon records")
        row = candidates[0]
        if int(row["species_id"]) != form["national_dex_number"]:
            raise BundleError(f"{csv_path}: {form['id']} maps across National Dex identities")
        result[form["id"]] = {"pokemon_id": row["id"], "pokemon_identifier": row["identifier"], "rule": rule}
    return result


def _parse_png(path: Path) -> dict[str, int]:
    try:
        content = path.read_bytes()
    except OSError as error:
        raise BundleError(f"{path}: {error}") from error
    if content[:8] != b"\x89PNG\r\n\x1a\n":
        raise BundleError(f"{path}: invalid PNG signature")
    position = 8
    chunks = []
    while position < len(content):
        if position + 12 > len(content):
            raise BundleError(f"{path}: truncated PNG chunk")
        length = struct.unpack(">I", content[position:position + 4])[0]
        chunk_type = content[position + 4:position + 8]
        data_start = position + 8
        data_end = data_start + length
        crc_end = data_end + 4
        if crc_end > len(content):
            raise BundleError(f"{path}: truncated PNG {chunk_type!r} chunk")
        expected_crc = struct.unpack(">I", content[data_end:crc_end])[0]
        if zlib.crc32(chunk_type + content[data_start:data_end]) & 0xFFFFFFFF != expected_crc:
            raise BundleError(f"{path}: invalid PNG {chunk_type!r} CRC")
        chunks.append((chunk_type, content[data_start:data_end]))
        position = crc_end
        if chunk_type == b"IEND":
            break
    if position != len(content) or not chunks or chunks[0][0] != b"IHDR" or chunks[-1][0] != b"IEND":
        raise BundleError(f"{path}: invalid PNG chunk structure")
    ihdr = chunks[0][1]
    if len(ihdr) != 13:
        raise BundleError(f"{path}: invalid PNG IHDR length")
    width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(">IIBBBBB", ihdr)
    expected = (512, 512, 8, 6, 0, 0, 0)
    if (width, height, bit_depth, color_type, compression, filtering, interlace) != expected:
        raise BundleError(f"{path}: expected 512x512 8-bit RGBA non-interlaced PNG")
    return {
        "width": width, "height": height, "bit_depth": bit_depth,
        "color_type": color_type, "interlace": interlace,
    }


def _parse_webp(path: Path) -> dict[str, Any]:
    try:
        content = path.read_bytes()
    except OSError as error:
        raise BundleError(f"{path}: {error}") from error
    if len(content) < 12 or content[:4] != b"RIFF" or content[8:12] != b"WEBP":
        raise BundleError(f"{path}: invalid WebP RIFF header")
    if struct.unpack("<I", content[4:8])[0] + 8 != len(content):
        raise BundleError(f"{path}: invalid WebP RIFF size")
    position = 12
    chunks: dict[bytes, list[bytes]] = {}
    while position < len(content):
        if position + 8 > len(content):
            raise BundleError(f"{path}: truncated WebP chunk")
        kind = content[position:position + 4]
        length = struct.unpack("<I", content[position + 4:position + 8])[0]
        start = position + 8
        end = start + length
        if end > len(content):
            raise BundleError(f"{path}: truncated WebP {kind!r} chunk")
        chunks.setdefault(kind, []).append(content[start:end])
        position = end + length % 2
    if position != len(content) or b"VP8X" not in chunks or len(chunks[b"VP8X"]) != 1:
        raise BundleError(f"{path}: expected one extended WebP header")
    header = chunks[b"VP8X"][0]
    if len(header) != 10:
        raise BundleError(f"{path}: invalid WebP extended header")
    flags = header[0]
    width = int.from_bytes(header[4:7], "little") + 1
    height = int.from_bytes(header[7:10], "little") + 1
    return {
        "width": width, "height": height, "has_alpha": bool(flags & 0x10) and b"ALPH" in chunks,
        "is_animated": bool(flags & 0x02) or b"ANIM" in chunks or b"ANMF" in chunks,
        "has_metadata": bool(flags & 0x2C) or any(kind in chunks for kind in (b"ICCP", b"EXIF", b"XMP ")),
    }


def _tool_version(tool: str) -> str:
    output = _run([tool, "-version"])
    version = output.splitlines()[0].strip() if output else ""
    if version != WEBP_TOOL_VERSION:
        raise BundleError(f"{tool}: required version {WEBP_TOOL_VERSION}, found {version or 'unknown'}")
    return version


def _sprite_records(
    forms: list[dict[str, Any]], sprites: Path, pokeapi: Path, output: Path
) -> list[dict[str, Any]]:
    cwebp_version = _tool_version("cwebp")
    mapping = _load_sprite_mapping(forms, pokeapi)
    records = []
    seen_sources: set[str] = set()
    seen_targets: set[str] = set()
    output.mkdir(parents=True, exist_ok=True)
    stage = output / ".sprite-stage"
    stage.mkdir()
    try:
        for form in forms:
            mapped = mapping[form["id"]]
            for variant, subdirectory in (("normal", ""), ("shiny", "shiny")):
                source_relative = Path("sprites/pokemon/other/home")
                if subdirectory:
                    source_relative /= subdirectory
                source_relative /= f"{mapped['pokemon_id']}.png"
                source = sprites / source_relative
                if not source.is_file():
                    raise BundleError(f"{source}: required {variant} PokeAPI HOME sprite for {form['id']} is missing")
                source_key = source_relative.as_posix().casefold()
                if source_key in seen_sources:
                    raise BundleError(f"{source}: duplicate or case-colliding sprite source")
                seen_sources.add(source_key)
                logical = f"sprites/{variant}/{form['id']}.webp"
                if logical.casefold() in seen_targets:
                    raise BundleError(f"{source}: duplicate or case-colliding sprite target {logical}")
                seen_targets.add(logical.casefold())
                staged_source = stage / "input.png"
                encoded = stage / "output.webp"
                shutil.copyfile(source, staged_source)
                source_info = _parse_png(staged_source)
                _run(list(CWEBP_ARGUMENTS), stage)
                output_info = _parse_webp(encoded)
                if output_info != {
                    "width": 384, "height": 384, "has_alpha": True,
                    "is_animated": False, "has_metadata": False,
                }:
                    raise BundleError(f"{encoded}: unexpected static WebP properties {output_info}")
                destination = output / logical
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(encoded, destination)
                records.append({
                    "form_id": form["id"], "variant": variant, "path": logical,
                    "pokeapi_pokemon_id": int(mapped["pokemon_id"]),
                    "pokeapi_identifier": mapped["pokemon_identifier"], "mapping_rule": mapped["rule"],
                    "source_path": source_relative.as_posix(), "source_sha256": _sha256(source),
                    "source_width": source_info["width"], "source_height": source_info["height"],
                    "source_bit_depth": source_info["bit_depth"],
                    "source_color_type": source_info["color_type"],
                    "source_interlace": source_info["interlace"], "cwebp_version": cwebp_version,
                    "cwebp_args": list(CWEBP_ARGUMENTS), "width": 384, "height": 384,
                    "has_alpha": output_info["has_alpha"], "is_animated": output_info["is_animated"],
                    "has_metadata": output_info["has_metadata"],
                    "sha256": _sha256(destination),
                })
    finally:
        shutil.rmtree(stage)
    return sorted(records, key=lambda item: (item["form_id"], item["variant"]))


def _load_json(bundle: Path, name: str) -> Any:
    path = bundle / name
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        if path.read_bytes() != _canonical_bytes(value):
            raise BundleError(f"{path}: JSON is not canonically encoded")
        return value
    except (OSError, json.JSONDecodeError) as error:
        raise BundleError(f"{path}: {error}") from error


def _unique(records: list[dict[str, Any]], fields: tuple[str, ...], label: str) -> None:
    seen = set()
    for record in records:
        key = tuple(record.get(field) for field in fields)
        if key in seen:
            raise BundleError(f"{label}: duplicate key {key}")
        seen.add(key)


def _fields(record: Any, expected: set[str], label: str) -> None:
    if not isinstance(record, dict):
        raise BundleError(f"{label}: record must be an object")
    actual = set(record)
    if actual != expected:
        raise BundleError(f"{label}: expected fields {sorted(expected)}, found {sorted(actual)}")


def _typed(record: dict[str, Any], contract: dict[str, type | tuple[type, ...]], label: str) -> None:
    for field, expected in contract.items():
        value = record[field]
        if isinstance(value, bool) and (expected is int or (isinstance(expected, tuple) and int in expected)):
            raise BundleError(f"{label}.{field}: expected integer")
        if not isinstance(value, expected):
            names = expected.__name__ if isinstance(expected, type) else "/".join(item.__name__ for item in expected)
            raise BundleError(f"{label}.{field}: expected {names}")


def validate_bundle(bundle: Path, *, verify_manifest: bool = True) -> dict[str, Any]:
    data_files = DATA_FILES if (bundle / "items.json").is_file() else LEGACY_DATA_FILES
    data = {name: _load_json(bundle, name) for name in data_files}
    forms = data["forms.json"]
    regulations = data["regulations.json"]
    profiles = data["profiles.json"]
    memberships = data["regulation_memberships.json"]
    abilities = data["abilities.json"]
    moves = data["moves.json"]
    types = data["types.json"]
    move_flags = data["move_flags.json"]
    ability_profiles = data["ability_profiles.json"]
    move_profiles = data["move_profiles.json"]
    move_flag_relations = data["move_flag_relations.json"]
    learnsets = data["learnsets.json"]
    sprites = data["sprites.json"]
    sprite_mappings = data["sprite_mappings.json"]
    mega_relations = data["mega_relations.json"]
    items = data.get("items.json", [])
    item_profiles = data.get("item_profiles.json", [])
    natures = data.get("natures.json", [])
    mega_item_relations = data.get("mega_item_relations.json", [])
    for name, value in data.items():
        if not isinstance(value, list):
            raise BundleError(f"{name}: root must be an array")
    field_contracts = {
        "forms.json": {"id", "name", "national_dex_number", "base_form_id", "form_label", "is_mega", "sprite_id"},
        "regulations.json": {"id", "name", "showdown_format_id", "mod", "ruleset", "mechanics_profile_id"},
        "types.json": {"id", "name"}, "abilities.json": {"id", "name"}, "moves.json": {"id", "name"},
        "items.json": {"id", "name"},
        "item_profiles.json": {"regulation_id", "id", "name", "source_status"},
        "natures.json": {"id", "name", "increased_stat", "decreased_stat"},
        "move_flags.json": {"id"}, "regulation_memberships.json": {"regulation_id", "form_id"},
        "profiles.json": {"regulation_id", "form_id", "stats", "bst", "types", "abilities"},
        "ability_profiles.json": {"regulation_id", "id", "name", "short_description", "description"},
        "move_profiles.json": {"regulation_id", "id", "name", "type", "category", "base_power", "accuracy", "pp", "priority", "target", "short_description", "description"},
        "move_flag_relations.json": {"regulation_id", "move_id", "flag_id"},
        "mega_relations.json": {"base_form_id", "mega_form_id"},
        "mega_item_relations.json": {"regulation_id", "item_id", "base_form_id", "mega_form_id"},
        "learnsets.json": {"regulation_id", "form_id", "move_id", "form_resolution", "source_form_id", "source_mod", "source_kind"},
        "sprite_mappings.json": {"form_id", "pokeapi_pokemon_id", "pokeapi_identifier", "mapping_rule"},
        "sprites.json": {"form_id", "variant", "path", "pokeapi_pokemon_id", "pokeapi_identifier", "mapping_rule", "source_path", "source_sha256", "source_width", "source_height", "source_bit_depth", "source_color_type", "source_interlace", "cwebp_version", "cwebp_args", "width", "height", "has_alpha", "is_animated", "has_metadata", "sha256"},
        "mechanics_profiles.json": set(
            MECHANICS_PROFILE if items else {
                key: value for key, value in MECHANICS_PROFILE.items() if key != "sp_total_max"
            }
        ),
    }
    for filename, expected_fields in field_contracts.items():
        if filename not in data:
            continue
        for index, record in enumerate(data[filename]):
            _fields(record, expected_fields, f"{filename}[{index}]")
    string_fields = {
        "forms.json": ("id", "name", "base_form_id", "form_label", "sprite_id"),
        "regulations.json": ("id", "name", "showdown_format_id", "mod", "mechanics_profile_id"),
        "types.json": ("id", "name"), "abilities.json": ("id", "name"),
        "moves.json": ("id", "name"), "move_flags.json": ("id",),
        "items.json": ("id", "name"),
        "item_profiles.json": ("regulation_id", "id", "name", "source_status"),
        "regulation_memberships.json": ("regulation_id", "form_id"),
        "ability_profiles.json": ("regulation_id", "id", "name", "short_description", "description"),
        "move_flag_relations.json": ("regulation_id", "move_id", "flag_id"),
        "mega_relations.json": ("base_form_id", "mega_form_id"),
        "mega_item_relations.json": ("regulation_id", "item_id", "base_form_id", "mega_form_id"),
        "learnsets.json": ("regulation_id", "form_id", "move_id", "form_resolution", "source_form_id", "source_mod", "source_kind"),
        "sprite_mappings.json": ("form_id", "pokeapi_identifier", "mapping_rule"),
    }
    for filename, fields in string_fields.items():
        if filename not in data:
            continue
        for index, record in enumerate(data[filename]):
            _typed(record, {field: str for field in fields}, f"{filename}[{index}]")
    for index, form in enumerate(forms):
        _typed(form, {"national_dex_number": int, "is_mega": bool}, f"forms.json[{index}]")
    for index, regulation in enumerate(regulations):
        _typed(regulation, {"ruleset": list}, f"regulations.json[{index}]")
        if not all(isinstance(item, str) for item in regulation["ruleset"]):
            raise BundleError(f"regulations.json[{index}].ruleset: expected strings")
    for index, profile in enumerate(profiles):
        _typed(profile, {"regulation_id": str, "form_id": str, "stats": dict, "bst": int, "types": list, "abilities": list}, f"profiles.json[{index}]")
        if not all(isinstance(item, str) for item in profile["types"]):
            raise BundleError(f"profiles.json[{index}].types: expected strings")
        for ability_index, ability in enumerate(profile["abilities"]):
            _fields(ability, {"slot", "ability_id"}, f"profiles.json[{index}].abilities[{ability_index}]")
            _typed(ability, {"slot": str, "ability_id": str}, f"profiles.json[{index}].abilities[{ability_index}]")
    for index, move in enumerate(move_profiles):
        _typed(move, {
            "regulation_id": str, "id": str, "name": str, "type": str, "category": str,
            "base_power": int, "accuracy": (int, str), "pp": int, "priority": int,
            "target": str, "short_description": str, "description": str,
        }, f"move_profiles.json[{index}]")
    for index, mapping in enumerate(sprite_mappings):
        _typed(mapping, {"pokeapi_pokemon_id": int}, f"sprite_mappings.json[{index}]")
        if mapping["pokeapi_pokemon_id"] <= 0:
            raise BundleError(f"sprite_mappings.json[{index}]: invalid PokeAPI Pokemon id")
    for index, sprite in enumerate(sprites):
        _typed(sprite, {
            "form_id": str, "variant": str, "path": str, "pokeapi_pokemon_id": int,
            "pokeapi_identifier": str, "mapping_rule": str, "source_path": str,
            "source_sha256": str, "source_width": int, "source_height": int,
            "source_bit_depth": int, "source_color_type": int, "source_interlace": int,
            "cwebp_version": str, "cwebp_args": list, "width": int, "height": int,
            "has_alpha": bool, "is_animated": bool, "has_metadata": bool, "sha256": str,
        }, f"sprites.json[{index}]")
        if sprite["variant"] not in {"normal", "shiny"} or sprite["pokeapi_pokemon_id"] <= 0:
            raise BundleError(f"sprites.json[{index}]: invalid variant or PokeAPI Pokemon id")
        if not re.fullmatch(r"[0-9a-f]{64}", sprite["sha256"]):
            raise BundleError(f"sprites.json[{index}]: invalid output hash")
    for filename, fields in FILE_KEYS.items():
        if filename not in data:
            continue
        expected_order = sorted(data[filename], key=lambda record: tuple(str(record[field]) for field in fields))
        if data[filename] != expected_order:
            raise BundleError(f"{filename}: records are not in canonical key order")
    _unique(forms, ("id",), "forms.json")
    _unique(regulations, ("id",), "regulations.json")
    _unique(profiles, ("regulation_id", "form_id"), "profiles.json")
    _unique(memberships, ("regulation_id", "form_id"), "regulation_memberships.json")
    _unique(types, ("id",), "types.json")
    _unique(abilities, ("id",), "abilities.json")
    _unique(moves, ("id",), "moves.json")
    _unique(move_flags, ("id",), "move_flags.json")
    _unique(ability_profiles, ("regulation_id", "id"), "ability_profiles.json")
    _unique(move_profiles, ("regulation_id", "id"), "move_profiles.json")
    _unique(move_flag_relations, ("regulation_id", "move_id", "flag_id"), "move_flag_relations.json")
    _unique(learnsets, ("regulation_id", "form_id", "move_id"), "learnsets.json")
    _unique(sprites, ("form_id", "variant"), "sprites.json")
    _unique(sprite_mappings, ("form_id",), "sprite_mappings.json")
    _unique(mega_relations, ("mega_form_id",), "mega_relations.json")
    if items:
        _unique(items, ("id",), "items.json")
        _unique(item_profiles, ("regulation_id", "id"), "item_profiles.json")
        _unique(natures, ("id",), "natures.json")
        _unique(
            mega_item_relations,
            ("regulation_id", "item_id", "base_form_id"),
            "mega_item_relations.json",
        )
    form_ids = {value["id"] for value in forms}
    forms_by_id = {value["id"]: value for value in forms}
    regulation_ids = {value["id"] for value in regulations}
    type_ids = {value["id"] for value in types}
    stable_ability_ids = {value["id"] for value in abilities}
    stable_ability_names = {value["id"]: value["name"] for value in abilities}
    stable_move_ids = {value["id"] for value in moves}
    stable_move_names = {value["id"]: value["name"] for value in moves}
    stable_flag_ids = {value["id"] for value in move_flags}
    ability_ids = {(value["regulation_id"], value["id"]) for value in ability_profiles}
    move_ids = {(value["regulation_id"], value["id"]) for value in move_profiles}
    profile_ids = {(value["regulation_id"], value["form_id"]) for value in profiles}
    membership_ids = {(value["regulation_id"], value["form_id"]) for value in memberships}
    multi_revision = regulation_ids == {"m-a", "m-b", "m-c"}
    if not multi_revision and regulation_ids != {"m-b", "m-c"}:
        raise BundleError(f"regulations.json: unsupported regulation set {sorted(regulation_ids)}")
    expected_formats = {
        "m-a": ("[Gen 9 Champions] VGC 2026 Reg M-A", "champions"),
        "m-b": ("[Gen 9 Champions] VGC 2026 Reg M-B", "championsregmb"),
        "m-c": ("[Gen 9 Champions] VGC 2026 Reg M-C", "champions"),
    }
    for regulation in regulations:
        if (regulation.get("name"), regulation.get("mod")) != expected_formats[regulation["id"]]:
            raise BundleError(f"regulations.json: unexpected format metadata for {regulation['id']}")
        if regulation.get("mechanics_profile_id") != MECHANICS_PROFILE["id"]:
            raise BundleError(f"regulations.json: unexpected mechanics profile for {regulation['id']}")
    expected_mechanics = MECHANICS_PROFILE if items else {
        key: value for key, value in MECHANICS_PROFILE.items() if key != "sp_total_max"
    }
    if data["mechanics_profiles.json"] != [expected_mechanics]:
        raise BundleError("mechanics_profiles.json: exact Champions mechanics contract is required")
    for filename in ("types.json", "abilities.json", "moves.json"):
        for record in data[filename]:
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", record["id"]) or not record["name"].strip():
                raise BundleError(f"{filename}: invalid canonical identity {record['id']!r}")
    for record in move_flags:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", record["id"]):
            raise BundleError(f"move_flags.json: invalid canonical id {record['id']!r}")
    for form in forms:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", form["id"]) or not form["name"].strip():
            raise BundleError(f"forms.json: invalid canonical identity {form['id']!r}")
        if not isinstance(form.get("national_dex_number"), int) or form["national_dex_number"] <= 0:
            raise BundleError(f"forms.json: {form.get('id')} has invalid National Dex number")
        if form["base_form_id"] not in form_ids:
            raise BundleError(f"forms.json: {form['id']} has missing base form {form['base_form_id']}")
    mega_ids = {value["id"] for value in forms if value.get("is_mega")}
    relation_mega_ids = set()
    for relation in mega_relations:
        base_form_id = relation.get("base_form_id")
        mega_form_id = relation.get("mega_form_id")
        if base_form_id not in form_ids or mega_form_id not in mega_ids:
            raise BundleError(f"mega_relations.json: dangling or non-Mega relation {relation}")
        if base_form_id == mega_form_id:
            raise BundleError(f"mega_relations.json: self relation {relation}")
        base = forms_by_id[base_form_id]
        mega = forms_by_id[mega_form_id]
        if base["is_mega"] or mega["base_form_id"] != base_form_id:
            raise BundleError(f"mega_relations.json: incoherent base relation {relation}")
        if base["national_dex_number"] != mega["national_dex_number"]:
            raise BundleError(f"mega_relations.json: National Dex mismatch {relation}")
        relation_mega_ids.add(mega_form_id)
    if relation_mega_ids != mega_ids:
        raise BundleError("mega_relations.json: every Mega form must have exactly one base relation")
    if items:
        item_ids = {value["id"] for value in items}
        item_profile_ids = {(value["regulation_id"], value["id"]) for value in item_profiles}
        if any(
            value["id"] not in item_ids
            or value["regulation_id"] not in regulation_ids
            or value["source_status"] != "standard"
            for value in item_profiles
        ):
            raise BundleError("item_profiles.json: dangling or nonstandard legal item")
        neutral_natures = set()
        for nature in natures:
            directions = (nature["increased_stat"], nature["decreased_stat"])
            if directions == (None, None):
                neutral_natures.add(nature["id"])
            elif any(value not in {"atk", "def", "spa", "spd", "spe"} for value in directions):
                raise BundleError(f"natures.json: invalid stat direction for {nature['id']}")
        if neutral_natures != {"serious"}:
            raise BundleError("natures.json: Serious must be the only neutral nature")
        for relation in mega_item_relations:
            regulation_id = relation["regulation_id"]
            base = forms_by_id.get(relation["base_form_id"])
            mega = forms_by_id.get(relation["mega_form_id"])
            if (
                (regulation_id, relation["item_id"]) not in item_profile_ids
                or base is None
                or mega is None
                or base["is_mega"]
                or not mega["is_mega"]
                or mega["base_form_id"] != base["base_form_id"]
            ):
                raise BundleError(f"mega_item_relations.json: incoherent relation {relation}")
    for profile in profiles:
        key = (profile["regulation_id"], profile["form_id"])
        if profile["regulation_id"] not in regulation_ids or profile["form_id"] not in form_ids:
            raise BundleError(f"profiles.json: dangling profile {key}")
        stats = profile.get("stats", {})
        if set(stats) != {"hp", "atk", "def", "spa", "spd", "spe"} or any(
            not isinstance(value, int) or value <= 0 for value in stats.values()
        ):
            raise BundleError(f"profiles.json: invalid stats for {key}")
        if profile.get("bst") != sum(stats.values()):
            raise BundleError(f"profiles.json: invalid BST for {key}")
        if not 1 <= len(profile.get("types", [])) <= 2:
            raise BundleError(f"profiles.json: invalid types for {key}")
        if len(set(profile["types"])) != len(profile["types"]):
            raise BundleError(f"profiles.json: duplicate type for {key}")
        if any(re.sub(r"[^a-z0-9]+", "", name.lower()) not in type_ids for name in profile["types"]):
            raise BundleError(f"profiles.json: dangling type in {key}")
        for ability in profile.get("abilities", []):
            if (profile["regulation_id"], ability["ability_id"]) not in ability_ids:
                raise BundleError(f"profiles.json: dangling ability in {key}")
        slots = [value["slot"] for value in profile.get("abilities", [])]
        if not slots or len(slots) != len(set(slots)):
            raise BundleError(f"profiles.json: missing or duplicate ability slot for {key}")
    expected_profile_ids = {(regulation_id, form_id) for regulation_id in regulation_ids for form_id in form_ids}
    if profile_ids != expected_profile_ids:
        raise BundleError("profiles.json: every included form requires an effective profile in each regulation")
    if not membership_ids <= profile_ids:
        raise BundleError("regulation_memberships.json: membership without an effective profile")
    if any(value["id"] not in ALLOWED_MOVE_FLAGS for value in move_flags):
        unknown = stable_flag_ids - ALLOWED_MOVE_FLAGS
        raise BundleError(f"move_flags.json: unknown flags {sorted(unknown)}")
    for profile in ability_profiles:
        if profile["id"] not in stable_ability_ids or profile["regulation_id"] not in regulation_ids:
            raise BundleError(f"ability_profiles.json: dangling profile {profile}")
        if not profile.get("short_description") or not profile.get("description"):
            raise BundleError(f"ability_profiles.json: missing description for {profile['id']}")
        if profile["name"] != stable_ability_names[profile["id"]]:
            raise BundleError(f"ability_profiles.json: identity name mismatch for {profile['id']}")
    for move in move_profiles:
        if move["id"] not in stable_move_ids or move["regulation_id"] not in regulation_ids:
            raise BundleError(f"move_profiles.json: dangling profile {move}")
        if move.get("accuracy") != "always" and not isinstance(move.get("accuracy"), int):
            raise BundleError(f"move_profiles.json: {move['id']} has invalid accuracy")
        if isinstance(move.get("accuracy"), bool) or (
            isinstance(move.get("accuracy"), int) and not 1 <= move["accuracy"] <= 100
        ):
            raise BundleError(f"move_profiles.json: {move['id']} has invalid accuracy")
        if move.get("category") not in {"Physical", "Special", "Status"}:
            raise BundleError(f"move_profiles.json: {move['id']} has invalid category")
        if not isinstance(move.get("base_power"), int) or move["base_power"] < 0:
            raise BundleError(f"move_profiles.json: {move['id']} has invalid base power")
        if not isinstance(move.get("pp"), int) or not 1 <= move["pp"] <= 20:
            raise BundleError(f"move_profiles.json: {move['id']} has invalid PP")
        if not isinstance(move.get("priority"), int) or not isinstance(move.get("target"), str):
            raise BundleError(f"move_profiles.json: {move['id']} has invalid priority or target")
        if not move.get("short_description") or not move.get("description"):
            raise BundleError(f"move_profiles.json: missing description for {move['id']}")
        if move["name"] != stable_move_names[move["id"]]:
            raise BundleError(f"move_profiles.json: identity name mismatch for {move['id']}")
        if _to_id(move["type"]) not in type_ids:
            raise BundleError(f"move_profiles.json: dangling type for {move['id']}")
    for relation in move_flag_relations:
        if (
            (relation["regulation_id"], relation["move_id"]) not in move_ids
            or relation["flag_id"] not in stable_flag_ids
        ):
            raise BundleError(f"move_flag_relations.json: dangling relation {relation}")
    for relation in learnsets:
        key = (relation["regulation_id"], relation["form_id"])
        if key not in profile_ids or (relation["regulation_id"], relation["move_id"]) not in move_ids:
            raise BundleError(f"learnsets.json: dangling relation {relation}")
        if relation.get("form_resolution") not in {"direct", "pre-evolution", "changed-form", "base-to-mega"}:
            raise BundleError(f"learnsets.json: invalid form resolution {relation}")
        if relation.get("source_form_id") not in form_ids:
            raise BundleError(f"learnsets.json: invalid source form {relation}")
        if relation.get("source_mod") not in {"base", "champions", "championsregmb"}:
            raise BundleError(f"learnsets.json: invalid source mod {relation}")
        if relation.get("source_kind") not in {"direct", "inherited", "override"}:
            raise BundleError(f"learnsets.json: invalid source kind {relation}")
        resolution = relation["form_resolution"]
        if resolution == "direct" and relation["source_form_id"] != relation["form_id"]:
            raise BundleError(f"learnsets.json: direct resolution must use the target form {relation}")
        if resolution in {"changed-form", "base-to-mega"} and relation["source_form_id"] != forms_by_id[relation["form_id"]]["base_form_id"]:
            raise BundleError(f"learnsets.json: form fallback must use the target base form {relation}")
        if resolution == "base-to-mega" and relation["form_id"] not in relation_mega_ids:
            raise BundleError(f"learnsets.json: base-to-Mega resolution requires a Mega target {relation}")
        if resolution == "changed-form" and forms_by_id[relation["form_id"]]["is_mega"]:
            raise BundleError(f"learnsets.json: changed-form resolution cannot target a Mega {relation}")
        if resolution == "pre-evolution" and relation["source_form_id"] == relation["form_id"]:
            raise BundleError(f"learnsets.json: pre-evolution resolution must change form {relation}")
        source_pair = (relation["source_mod"], relation["source_kind"])
        allowed_source_pairs = {
            "m-a": {("champions", "direct"), ("base", "inherited")},
            "m-c": {("champions", "direct"), ("base", "inherited")},
            "m-b": {
                ("champions", "inherited"), ("base", "inherited"),
                ("championsregmb", "override"),
            },
        }
        if source_pair not in allowed_source_pairs[relation["regulation_id"]]:
            raise BundleError(f"learnsets.json: invalid regulation source combination {relation}")
    forms_with_learnsets = {(value["regulation_id"], value["form_id"]) for value in learnsets}
    if forms_with_learnsets != profile_ids:
        raise BundleError("learnsets.json: every effective form profile requires at least one legal move")
    sprite_counts = Counter((value["form_id"], value["variant"]) for value in sprites)
    mapping_by_form = {value["form_id"]: value for value in sprite_mappings}
    if set(mapping_by_form) != form_ids:
        raise BundleError("sprite_mappings.json: every included form requires one mapping")
    mapping_hash = hashlib.sha256(_canonical_bytes(sprite_mappings)).hexdigest()
    expected_mapping_hash = (
        LEGACY_SPRITE_MAPPING_SHA256 if len(forms) == LEGACY_PINNED_COUNTS["forms"]
        else SPRITE_MAPPING_SHA256
    )
    if mapping_hash != expected_mapping_hash:
        raise BundleError("sprite_mappings.json: pinned exact mapping hash changed")
    for form_id, mapping in mapping_by_form.items():
        expected_identifier = SPRITE_EXCEPTIONS.get(form_id)
        if expected_identifier is None:
            if mapping["mapping_rule"] != "normalized-identifier" or _to_id(mapping["pokeapi_identifier"]) != form_id:
                raise BundleError(f"sprite_mappings.json: invalid normalized mapping for {form_id}")
        elif mapping["mapping_rule"] != "exception" or mapping["pokeapi_identifier"] != expected_identifier:
            raise BundleError(f"sprite_mappings.json: invalid reviewed exception for {form_id}")
    for form_id in form_ids:
        for variant in ("normal", "shiny"):
            if sprite_counts[(form_id, variant)] != 1:
                raise BundleError(f"sprites.json: {form_id} requires exactly one {variant} sprite")
    for sprite in sprites:
        mapping = mapping_by_form.get(sprite["form_id"])
        if mapping is None or any(sprite[key] != mapping[key] for key in ("pokeapi_pokemon_id", "pokeapi_identifier", "mapping_rule")):
            raise BundleError(f"sprites.json: mapping does not match sprite_mappings.json for {sprite['form_id']}")
        path = bundle / sprite["path"]
        if not path.is_file() or _sha256(path) != sprite["sha256"]:
            raise BundleError(f"{path}: missing or hash mismatch")
        properties = _parse_webp(path)
        expected_properties = {
            "width": sprite.get("width"), "height": sprite.get("height"),
            "has_alpha": sprite.get("has_alpha"), "is_animated": sprite.get("is_animated"),
            "has_metadata": sprite.get("has_metadata"),
        }
        if properties != expected_properties or properties != {
            "width": 384, "height": 384, "has_alpha": True,
            "is_animated": False, "has_metadata": False,
        }:
            raise BundleError(f"{path}: WebP properties do not match sprites.json")
        if sprite.get("cwebp_version") != WEBP_TOOL_VERSION or sprite.get("cwebp_args") != list(CWEBP_ARGUMENTS):
            raise BundleError(f"sprites.json: invalid encoder provenance for {sprite['form_id']} {sprite['variant']}")
        expected_source = "sprites/pokemon/other/home/"
        if sprite["variant"] == "shiny":
            expected_source += "shiny/"
        expected_source += f"{sprite.get('pokeapi_pokemon_id')}.png"
        expected_path = f"sprites/{sprite['variant']}/{sprite['form_id']}.webp"
        if sprite.get("source_path") != expected_source or sprite.get("path") != expected_path:
            raise BundleError(f"sprites.json: invalid HOME source path for {sprite['form_id']}")
        if (
            sprite.get("source_width") != 512 or sprite.get("source_height") != 512
            or sprite.get("source_bit_depth") != 8 or sprite.get("source_color_type") != 6
            or sprite.get("source_interlace") != 0
            or sprite.get("mapping_rule") not in {"normalized-identifier", "exception"}
            or not re.fullmatch(r"[0-9a-f]{64}", sprite.get("source_sha256", ""))
        ):
            raise BundleError(f"sprites.json: invalid source provenance for {sprite['form_id']}")
    provenance = _load_json(bundle, "provenance.json")
    showdown_key = "showdown_sources" if multi_revision else "showdown"
    _fields(provenance, {showdown_key, "sprites", "pokeapi_mapping", "overlays"}, "provenance.json")
    if multi_revision:
        sources = provenance[showdown_key]
        if not isinstance(sources, list) or len(sources) != 2:
            raise BundleError("provenance.json.showdown_sources: expected exactly two sources")
        source_fields = {
            "regulations", "revision", "commit_date", "clean_tree", "source_counts",
            "notice_path", "notice_sha256",
        }
        for index, source in enumerate(sources):
            _fields(source, source_fields, f"provenance.json.showdown_sources[{index}]")
            if not isinstance(source["source_counts"], dict):
                raise BundleError(
                    f"provenance.json.showdown_sources[{index}].source_counts: expected object"
                )
        expected_sources = [
            {"regulations": ["m-a"], "revision": HISTORICAL_REVISION,
             "commit_date": HISTORICAL_COMMIT_DATE, "clean_tree": True,
             "source_counts": provenance[showdown_key][0].get("source_counts"),
             "notice_path": SHOWDOWN_NOTICE_PATH, "notice_sha256": SHOWDOWN_NOTICE_SHA256},
            {"regulations": ["m-b", "m-c"], "revision": EXPECTED_REVISION,
             "commit_date": EXPECTED_COMMIT_DATE, "clean_tree": True,
             "source_counts": provenance[showdown_key][1].get("source_counts"),
             "notice_path": SHOWDOWN_NOTICE_PATH, "notice_sha256": SHOWDOWN_NOTICE_SHA256},
        ]
        if provenance[showdown_key] != expected_sources:
            raise BundleError("provenance.json: unexpected multi-revision Showdown provenance")
    else:
        _fields(
            provenance["showdown"],
            {"revision", "commit_date", "clean_tree", "source_counts", "notice_path", "notice_sha256"},
            "provenance.json.showdown",
        )
    _fields(
        provenance["sprites"],
        {"revision", "clean_tree", "family", "mapping_rule_version", "mapping_revision", "mapping_sha256", "cwebp_version", "cwebp_args", "license", "mapping_exceptions"},
        "provenance.json.sprites",
    )
    _fields(provenance["pokeapi_mapping"], {"revision", "clean_tree"}, "provenance.json.pokeapi_mapping")
    if not multi_revision and provenance["showdown"] != {
        "revision": EXPECTED_REVISION, "commit_date": EXPECTED_COMMIT_DATE, "clean_tree": True,
        "source_counts": provenance["showdown"]["source_counts"],
        "notice_path": SHOWDOWN_NOTICE_PATH, "notice_sha256": SHOWDOWN_NOTICE_SHA256,
    }:
        raise BundleError("provenance.json: unexpected Showdown provenance")
    notice = bundle / SHOWDOWN_NOTICE_PATH
    if not notice.is_file() or _sha256(notice) != SHOWDOWN_NOTICE_SHA256:
        raise BundleError(f"{notice}: pinned Showdown notice is missing or altered")
    if provenance["sprites"] != {
        "revision": EXPECTED_SPRITES_REVISION, "clean_tree": True,
        "family": "sprites/pokemon/other/home", "mapping_rule_version": SPRITE_MAPPING_VERSION,
        "mapping_revision": EXPECTED_POKEAPI_REVISION, "mapping_sha256": expected_mapping_hash,
        "cwebp_version": WEBP_TOOL_VERSION,
        "cwebp_args": list(CWEBP_ARGUMENTS), "license": "license-not-supplied",
        "mapping_exceptions": dict(sorted(SPRITE_EXCEPTIONS.items())),
    }:
        raise BundleError("provenance.json: unexpected sprite provenance")
    if provenance["pokeapi_mapping"] != {"revision": EXPECTED_POKEAPI_REVISION, "clean_tree": True}:
        raise BundleError("provenance.json: unexpected PokeAPI mapping provenance")
    if not isinstance(provenance["overlays"], list):
        raise BundleError("provenance.json: overlays must be an array")
    overlay_fields = {"id", "record", "path", "sha256", "fixture_path", "fixture_sha256"}
    for index, overlay in enumerate(provenance["overlays"]):
        _fields(overlay, overlay_fields, f"provenance.json.overlays[{index}]")
        for field in overlay_fields:
            if not isinstance(overlay[field], str):
                raise BundleError(f"provenance.json.overlays[{index}].{field}: expected string")
        for path_field, hash_field in (("path", "sha256"), ("fixture_path", "fixture_sha256")):
            relative = Path(overlay[path_field])
            if relative.is_absolute() or ".." in relative.parts:
                raise BundleError(f"provenance.json.overlays[{index}]: unsafe path")
            target = bundle / relative
            if not target.is_file() or _sha256(target) != overlay[hash_field]:
                raise BundleError(f"{target}: missing or hash mismatch")
    if provenance.get("sprites", {}).get("revision") != EXPECTED_SPRITES_REVISION:
        raise BundleError("provenance.json: unexpected PokeAPI sprites revision")
    if provenance.get("pokeapi_mapping", {}).get("revision") != EXPECTED_POKEAPI_REVISION:
        raise BundleError("provenance.json: unexpected PokeAPI mapping revision")
    legacy_release = Counter(x["regulation_id"] for x in memberships) == {"m-b": 316, "m-c": 351}
    summary = {
        "status": "valid", "errors": [], "warnings": [], "overlays": provenance["overlays"],
        "source_counts": (
            {",".join(source["regulations"]): source["source_counts"] for source in provenance[showdown_key]}
            if multi_revision else provenance["showdown"]["source_counts"]
        ),
        "counts": {
            "forms": len(forms), "types": len(types), "memberships": len(memberships),
            "profiles": len(profiles),
            "abilities": len(abilities), "ability_profiles": len(ability_profiles),
            "moves": len(moves), "move_profiles": len(move_profiles),
            "move_flags": len(move_flags), "move_flag_relations": len(move_flag_relations),
            "learnsets": len(learnsets), "mega_relations": len(mega_relations),
            "sprites": len(sprites), "sprite_mappings": len(sprite_mappings),
            "sprites_by_variant": dict(sorted(Counter(x["variant"] for x in sprites).items())),
            "sprite_mapping_rules": dict(sorted(Counter(x["mapping_rule"] for x in sprites).items())),
            "legal_forms_by_regulation": dict(sorted(Counter(x["regulation_id"] for x in memberships).items())),
            "learnsets_by_regulation": dict(sorted(Counter(x["regulation_id"] for x in learnsets).items())),
            "learnsets_by_form_resolution": dict(sorted(Counter(x["form_resolution"] for x in learnsets).items())),
            "learnsets_by_source_mod": dict(sorted(Counter(x["source_mod"] for x in learnsets).items())),
            "learnsets_by_source_kind": dict(sorted(Counter(x["source_kind"] for x in learnsets).items())),
            "move_flag_usage": dict(sorted(Counter(value["flag_id"] for value in move_flag_relations).items())),
        },
        "ignored_source_categories": {
            (
                "illegal_or_past_forms" if legacy_release else "illegal_or_nonstandard_forms"
            ): "excluded by the effective regulation FormatsData table",
            "unreferenced_moves_and_abilities": "not attached to an included effective form profile",
            "non_home_sprites": "outside the approved PokeAPI HOME family",
            "source_pngs": "converted to deterministic static WebP derivatives rather than shipped",
        },
        "coverage": {
            "effective_profile_percent": 100, "learnset_profile_percent": 100,
            "mega_relation_percent": 100, "normal_sprite_percent": 100, "shiny_sprite_percent": 100,
        },
    }
    if items:
        summary["counts"].update({
            "items": len(items),
            "item_profiles": len(item_profiles),
            "natures": len(natures),
            "mega_item_relations": len(mega_item_relations),
        })
    expected_counts = (
        TEAM_PINNED_COUNTS if items else
        MULTI_PINNED_COUNTS if multi_revision else
        LEGACY_PINNED_COUNTS if legacy_release else EXPECTED_PINNED_COUNTS
    )
    for key, expected in expected_counts.items():
        if summary["counts"].get(key) != expected:
            raise BundleError(f"pinned bundle count {key}: expected {expected}, found {summary['counts'].get(key)}")
    expected_memberships = {"m-b": 316, "m-c": 351} if legacy_release else {"m-b": 314, "m-c": 349}
    if multi_revision:
        expected_memberships = {"m-a": 272, "m-b": 314, "m-c": 349}
    if summary["counts"]["legal_forms_by_regulation"] != expected_memberships:
        raise BundleError("pinned bundle regulation membership counts changed")
    expected_learnsets = (
        {"m-b": 21946, "m-c": 21945}
        if legacy_release else {"m-b": 21715, "m-c": 21714}
    )
    if multi_revision:
        expected_learnsets = {"m-a": 21506, "m-b": 21715, "m-c": 21714}
    if summary["counts"]["learnsets_by_regulation"] != expected_learnsets:
        raise BundleError("pinned bundle regulation learnset counts changed")
    expected_resolution = (
        {"base-to-mega": 11270, "changed-form": 932, "direct": 31689}
        if legacy_release else {"base-to-mega": 10962, "changed-form": 932, "direct": 31535}
    )
    if multi_revision:
        expected_resolution = {"base-to-mega": 16459, "changed-form": 1331, "direct": 47145}
    if summary["counts"]["learnsets_by_form_resolution"] != expected_resolution:
        raise BundleError("pinned bundle learnset form-resolution counts changed")
    expected_source_mod = (
        {"base": 676, "champions": 43164, "championsregmb": 51}
        if legacy_release else {"base": 214, "champions": 43164, "championsregmb": 51}
    )
    if multi_revision:
        expected_source_mod = {"base": 4578, "champions": 60306, "championsregmb": 51}
    if summary["counts"]["learnsets_by_source_mod"] != expected_source_mod:
        raise BundleError("pinned bundle learnset source-mod counts changed")
    expected_source_kind = (
        {"direct": 21607, "inherited": 22233, "override": 51}
        if legacy_release else {"direct": 21607, "inherited": 21771, "override": 51}
    )
    if multi_revision:
        expected_source_kind = {"direct": 38749, "inherited": 26135, "override": 51}
    if summary["counts"]["learnsets_by_source_kind"] != expected_source_kind:
        raise BundleError("pinned bundle learnset source-kind counts changed")
    if not multi_revision and provenance["showdown"]["source_counts"] != {
        "pokedex": 1518, "base_moves": 954, "base_abilities": 321, "base_learnsets": 1289,
        "champions_format_entries": 1361, "championsregmb_format_entries": 1361,
    }:
        raise BundleError("provenance.json: pinned Showdown source counts changed")
    if multi_revision and summary["source_counts"] != {
        "m-a": {
            "pokedex": 1516, "base_moves": 954, "base_abilities": 318,
            "base_learnsets": 1287, "champions_format_entries": 1330,
            "championsregmb_format_entries": 0,
        },
        "m-b,m-c": {
            "pokedex": 1518, "base_moves": 954, "base_abilities": 321,
            "base_learnsets": 1289, "champions_format_entries": 1361,
            "championsregmb_format_entries": 1361,
        },
    }:
        raise BundleError("provenance.json: pinned multi-revision source counts changed")
    if ("cinderace" in {form_id for regulation_id, form_id in membership_ids if regulation_id == "m-b"}
        or "cinderace" not in {form_id for regulation_id, form_id in membership_ids if regulation_id == "m-c"}
        or not {"charizard", "charizardmegax", "charizardmegay"} <= form_ids):
        raise BundleError("pinned bundle representative legality or form goldens changed")
    if not legacy_release and ({"magearnamega", "magearnaoriginalmega"} & {
        form_id for _, form_id in membership_ids
    }):
        raise BundleError("pinned bundle includes nonstandard Magearna Mega membership")
    if verify_manifest:
        manifest = _load_json(bundle, "manifest.json")
        expected_manifest_fields = {
            "bundle_id", "bundle_hash", "bundle_schema_version", "importer_version",
            "source_shape_version", showdown_key, "pokeapi_sprites", "pokeapi_mapping", "formats",
            "mechanics_profile_id", "sprite_provenance", "overlays", "validation_status",
            "validation_sha256", "counts", "files",
        }
        _fields(manifest, expected_manifest_fields, "manifest.json")
        expected_schema = SCHEMA_VERSION if items else ("2" if multi_revision else "1")
        if manifest["bundle_schema_version"] != expected_schema:
            raise BundleError("manifest.json: unsupported bundle schema version")
        importer_version = manifest["importer_version"]
        if importer_version not in {LEGACY_IMPORTER_VERSION, "2", "3", IMPORTER_VERSION}:
            raise BundleError("manifest.json: unsupported importer or source-shape version")
        expected_shape = (
            SOURCE_SHAPE_VERSION if items else
            "showdown-champions-multi-revision-2" if multi_revision else
            "showdown-champions-1"
        )
        if manifest["source_shape_version"] != expected_shape:
            raise BundleError("manifest.json: unsupported importer or source-shape version")
        if importer_version == LEGACY_IMPORTER_VERSION and not legacy_release:
            raise BundleError("manifest.json: importer version 1 cannot contain version 2 legality semantics")
        if importer_version in {"2", IMPORTER_VERSION} and legacy_release:
            raise BundleError("manifest.json: importer version 2 cannot contain legacy legality semantics")
        if manifest["formats"] != regulations or manifest["mechanics_profile_id"] != MECHANICS_PROFILE["id"]:
            raise BundleError("manifest.json: format or mechanics contract mismatch")
        if manifest["validation_status"] != "valid" or manifest["overlays"] != provenance["overlays"]:
            raise BundleError("manifest.json: invalid validation or overlay status")
        if manifest["counts"] != summary["counts"]:
            raise BundleError("manifest.json: counts do not match validated bundle")
        if manifest["sprite_provenance"] != provenance["sprites"]:
            raise BundleError("manifest.json: sprite provenance mismatch")
        if multi_revision and manifest["showdown_sources"] != [
            {key: source[key] for key in ("regulations", "revision", "commit_date", "clean_tree")}
            for source in provenance["showdown_sources"]
        ]:
            raise BundleError("manifest.json: unexpected Showdown sources")
        if not multi_revision and manifest["showdown"] != {
            "revision": EXPECTED_REVISION, "commit_date": EXPECTED_COMMIT_DATE, "clean_tree": True,
        }:
            raise BundleError("manifest.json: unexpected Showdown source")
        if manifest["pokeapi_sprites"] != {"revision": EXPECTED_SPRITES_REVISION, "clean_tree": True}:
            raise BundleError("manifest.json: unexpected PokeAPI sprite source")
        if manifest["pokeapi_mapping"] != {"revision": EXPECTED_POKEAPI_REVISION, "clean_tree": True}:
            raise BundleError("manifest.json: unexpected PokeAPI mapping source")
        file_records = manifest.get("files", [])
        if not isinstance(file_records, list):
            raise BundleError("manifest.json: files must be an array")
        for index, record in enumerate(file_records):
            _fields(record, {"path", "bytes", "sha256"}, f"manifest.json.files[{index}]")
            _typed(record, {"path": str, "bytes": int, "sha256": str}, f"manifest.json.files[{index}]")
            if record["bytes"] < 0 or not re.fullmatch(r"[0-9a-f]{64}", record["sha256"]):
                raise BundleError(f"manifest.json.files[{index}]: invalid size or hash")
        _unique(file_records, ("path",), "manifest.json files")
        for record in file_records:
            relative = Path(record["path"])
            if relative.is_absolute() or ".." in relative.parts:
                raise BundleError(f"manifest.json: unsafe path {record['path']}")
            path = bundle / relative
            if not path.is_file() or path.stat().st_size != record["bytes"] or _sha256(path) != record["sha256"]:
                raise BundleError(f"{path}: manifest size or hash mismatch")
        actual_records = _file_records(bundle)
        if file_records != actual_records:
            raise BundleError("manifest.json: file inventory does not exactly match bundle contents")
        bundle_hash = hashlib.sha256(_canonical_bytes(file_records)).hexdigest()
        if manifest.get("bundle_hash") != bundle_hash:
            raise BundleError("manifest.json: canonical bundle hash mismatch")
        expected_id = (
            f"showdown-multi-s{expected_schema}-i{importer_version}-{bundle_hash[:12]}"
            if multi_revision else
            f"showdown-{EXPECTED_REVISION[:8]}-s1-i{importer_version}-{bundle_hash[:12]}"
        )
        if manifest.get("bundle_id") != expected_id:
            raise BundleError("manifest.json: bundle identifier does not match its canonical hash")
        if not multi_revision and RETAINED_RELEASES.get(manifest["bundle_id"]) != bundle_hash:
            raise BundleError("manifest.json: schema-1 bundle is not an exact retained release")
        if not multi_revision and manifest.get("showdown", {}).get("revision") != EXPECTED_REVISION:
            raise BundleError("manifest.json: unexpected Showdown revision")
        if manifest.get("pokeapi_sprites", {}).get("revision") != EXPECTED_SPRITES_REVISION:
            raise BundleError("manifest.json: unexpected PokeAPI sprites revision")
        if manifest.get("pokeapi_mapping", {}).get("revision") != EXPECTED_POKEAPI_REVISION:
            raise BundleError("manifest.json: unexpected PokeAPI mapping revision")
        if manifest.get("validation_sha256") != _sha256(bundle / "validation.json"):
            raise BundleError("manifest.json: validation summary hash mismatch")
        if _load_json(bundle, "validation.json") != summary:
            raise BundleError("validation.json: content does not match computed validation summary")
    return summary


def _file_records(directory: Path) -> list[dict[str, Any]]:
    records = []
    for path in sorted(value for value in directory.rglob("*") if value.is_file() and value.name != "manifest.json"):
        records.append({"path": path.relative_to(directory).as_posix(), "bytes": path.stat().st_size, "sha256": _sha256(path)})
    return records


def build_bundle(showdown: Path, sprites: Path, pokeapi: Path, releases: Path) -> Path:
    showdown = showdown.resolve()
    sprites = sprites.resolve()
    pokeapi = pokeapi.resolve()
    releases.mkdir(parents=True, exist_ok=True)
    _verify_showdown(showdown)
    _verify_repository(sprites, EXPECTED_SPRITES_REVISION, "PokeAPI sprites")
    _verify_repository(pokeapi, EXPECTED_POKEAPI_REVISION, "PokeAPI mapping")
    current = _extract(showdown)
    with tempfile.TemporaryDirectory(prefix="bagredex-showdown-history-") as historical_name:
        historical_root = Path(historical_name) / "tree"
        _materialize_historical_tree(showdown, historical_root)
        historical = _extract(
            historical_root, "m-a", [form["id"] for form in current["forms"]]
        )
        extracted = _combine_extractions(current, historical)
    with tempfile.TemporaryDirectory(dir=releases, prefix=".bagredex-pokemon-data-") as temp_name:
        temp = Path(temp_name)
        records = _records(extracted)
        data_root = Path(__file__).resolve().parent.parent
        applied_overlays = _apply_overlays(
            records, data_root / "overrides", data_root / "fixtures", temp
        )
        for name, value in records.items():
            _write_json(temp / name, value)
        sprite_records = _sprite_records(records["forms.json"], sprites, pokeapi, temp)
        mapping_records = []
        for form_id in sorted({value["form_id"] for value in sprite_records}):
            sprite = next(value for value in sprite_records if value["form_id"] == form_id)
            mapping_records.append({
                "form_id": form_id, "pokeapi_pokemon_id": sprite["pokeapi_pokemon_id"],
                "pokeapi_identifier": sprite["pokeapi_identifier"], "mapping_rule": sprite["mapping_rule"],
            })
        _write_json(temp / "sprite_mappings.json", mapping_records)
        _write_json(temp / "sprites.json", sprite_records)
        _write_json(
            temp / "provenance.json",
            {
                "showdown_sources": [
                    {"regulations": ["m-a"], "revision": HISTORICAL_REVISION,
                     "commit_date": HISTORICAL_COMMIT_DATE, "clean_tree": True,
                     "source_counts": extracted["source_counts"]["m-a"],
                     "notice_path": SHOWDOWN_NOTICE_PATH, "notice_sha256": SHOWDOWN_NOTICE_SHA256},
                    {"regulations": ["m-b", "m-c"], "revision": EXPECTED_REVISION,
                     "commit_date": EXPECTED_COMMIT_DATE, "clean_tree": True,
                     "source_counts": extracted["source_counts"]["m-b,m-c"],
                     "notice_path": SHOWDOWN_NOTICE_PATH, "notice_sha256": SHOWDOWN_NOTICE_SHA256},
                ],
                "sprites": {
                    "revision": EXPECTED_SPRITES_REVISION, "clean_tree": True,
                    "family": "sprites/pokemon/other/home", "mapping_rule_version": SPRITE_MAPPING_VERSION,
                    "mapping_revision": EXPECTED_POKEAPI_REVISION,
                    "mapping_sha256": SPRITE_MAPPING_SHA256, "cwebp_version": WEBP_TOOL_VERSION,
                    "cwebp_args": list(CWEBP_ARGUMENTS), "license": "license-not-supplied",
                    "mapping_exceptions": dict(sorted(SPRITE_EXCEPTIONS.items())),
                },
                "pokeapi_mapping": {"revision": EXPECTED_POKEAPI_REVISION, "clean_tree": True},
                "overlays": applied_overlays,
            },
        )
        license_source = showdown / "LICENSE"
        if _sha256(license_source) != SHOWDOWN_NOTICE_SHA256:
            raise BundleError(f"{license_source}: pinned Showdown notice content changed")
        shutil.copyfile(license_source, temp / SHOWDOWN_NOTICE_PATH)
        summary = validate_bundle(temp, verify_manifest=False)
        _write_json(temp / "validation.json", summary)
        files = _file_records(temp)
        bundle_hash = hashlib.sha256(_canonical_bytes(files)).hexdigest()
        identifier = f"showdown-multi-s{SCHEMA_VERSION}-i{IMPORTER_VERSION}-{bundle_hash[:12]}"
        manifest = {
            "bundle_id": identifier, "bundle_hash": bundle_hash,
            "bundle_schema_version": SCHEMA_VERSION, "importer_version": IMPORTER_VERSION,
            "source_shape_version": SOURCE_SHAPE_VERSION,
            "showdown_sources": [
                {"regulations": ["m-a"], "revision": HISTORICAL_REVISION,
                 "commit_date": HISTORICAL_COMMIT_DATE, "clean_tree": True},
                {"regulations": ["m-b", "m-c"], "revision": EXPECTED_REVISION,
                 "commit_date": EXPECTED_COMMIT_DATE, "clean_tree": True},
            ],
            "pokeapi_sprites": {"revision": EXPECTED_SPRITES_REVISION, "clean_tree": True},
            "pokeapi_mapping": {"revision": EXPECTED_POKEAPI_REVISION, "clean_tree": True},
            "formats": records["regulations.json"], "mechanics_profile_id": MECHANICS_PROFILE["id"],
            "sprite_provenance": _load_json(temp, "provenance.json")["sprites"],
            "overlays": applied_overlays, "validation_status": "valid", "validation_sha256": _sha256(temp / "validation.json"),
            "counts": summary["counts"], "files": files,
        }
        _write_json(temp / "manifest.json", manifest)
        validate_bundle(temp)
        destination = releases / identifier
        if destination.exists():
            validate_bundle(destination)
            if _sha256(destination / "manifest.json") != _sha256(temp / "manifest.json"):
                raise BundleError(f"{destination}: bundle identifier exists with different content")
            return destination
        temp.rename(destination)
        return destination


def compare_bundles(before: Path, after: Path) -> dict[str, Any]:
    validate_bundle(before)
    validate_bundle(after)
    result: dict[str, Any] = {"before": before.name, "after": after.name, "files": {}}
    for name in DATA_FILES:
        left = _load_json(before, name) if (before / name).is_file() else []
        right = _load_json(after, name) if (after / name).is_file() else []
        fields = FILE_KEYS[name]
        left_by_key = {tuple(str(value[field]) for field in fields): value for value in left}
        right_by_key = {tuple(str(value[field]) for field in fields): value for value in right}
        added = sorted(set(right_by_key) - set(left_by_key))
        removed = sorted(set(left_by_key) - set(right_by_key))
        changed = sorted(
            key for key in set(left_by_key) & set(right_by_key)
            if _canonical_bytes(left_by_key[key]) != _canonical_bytes(right_by_key[key])
        )
        def render(keys: list[tuple[str, ...]]) -> list[str]:
            return [":".join(key) for key in keys]
        result["files"][name] = {
            "added": len(added), "removed": len(removed), "changed": len(changed),
            "added_keys": render(added), "removed_keys": render(removed), "changed_keys": render(changed),
        }
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    build = subparsers.add_parser("build")
    build.add_argument("--showdown", type=Path, required=True)
    build.add_argument("--sprites", type=Path, required=True)
    build.add_argument("--pokeapi", type=Path, required=True)
    build.add_argument("--releases", type=Path, default=Path("src/data/releases"))
    validate = subparsers.add_parser("validate")
    validate.add_argument("bundle", type=Path)
    compare = subparsers.add_parser("compare")
    compare.add_argument("before", type=Path)
    compare.add_argument("after", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            print(build_bundle(args.showdown, args.sprites, args.pokeapi, args.releases))
        elif args.command == "validate":
            print(json.dumps(validate_bundle(args.bundle), sort_keys=True))
        else:
            print(json.dumps(compare_bundles(args.before, args.after), sort_keys=True))
    except BundleError as error:
        parser.exit(1, f"error: {error}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

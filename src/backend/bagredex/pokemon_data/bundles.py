"""Strict reader for the versioned portable Pokémon data contract."""

from __future__ import annotations

import hashlib
import json
import re
import struct
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

SUPPORTED_SCHEMA_VERSION = "1"
SUPPORTED_IMPORTER_VERSION = "2"
SUPPORTED_IMPORTER_VERSIONS = frozenset({"1", SUPPORTED_IMPORTER_VERSION})
SUPPORTED_SOURCE_SHAPE_VERSION = "showdown-champions-1"
MULTI_SCHEMA_VERSION = "2"
MULTI_IMPORTER_VERSION = "3"
MULTI_SOURCE_SHAPE_VERSION = "showdown-champions-multi-revision-2"
TEAM_SCHEMA_VERSION = "3"
TEAM_IMPORTER_VERSION = "4"
TEAM_SOURCE_SHAPE_VERSION = "showdown-champions-multi-revision-3"
ITEM_INFO_SCHEMA_VERSION = "4"
ITEM_INFO_IMPORTER_VERSION = "5"
ITEM_INFO_SOURCE_SHAPE_VERSION = "showdown-champions-multi-revision-4"
CALCULATOR_SCHEMA_VERSION = "5"
CALCULATOR_IMPORTER_VERSION = "6"
CALCULATOR_SOURCE_SHAPE_VERSION = "showdown-champions-multi-revision-5"
MULTI_SCHEMA_VERSIONS = frozenset(
    {MULTI_SCHEMA_VERSION, TEAM_SCHEMA_VERSION, ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}
)
SUPPORTED_SCHEMA_VERSIONS = frozenset({SUPPORTED_SCHEMA_VERSION, *MULTI_SCHEMA_VERSIONS})
EXPECTED_SHOWDOWN_REVISION = "3a766f2cfb5e51c1e428cfe87d0dba91a8f01640"
EXPECTED_SPRITES_REVISION = "ba403973fdf9d0ac59175813861e6a1f8ed5020c"
EXPECTED_POKEAPI_REVISION = "81d20919845b6a445969b9265aab5cec6b04cece"
EXPECTED_SPRITE_MAPPING_SHA256 = "2fd464a37c34f7c543ebd153f39ca6c47f3d6788617b932db6f75f640a537602"
LEGACY_SPRITE_MAPPING_SHA256 = "4d77de037da77591d41b778850b4ec2ec2d9940dacc7fdbea5a8c4b03b7e15d4"
EXPECTED_COMMIT_DATE = "2026-10-13"
STATE_INPUT_POLICY = {
    "StateMove": {
        "source": ["name"],
        "user": [
            "isCrit",
            "hits",
            "hitsTaken",
            "lastMoveFailed",
            "targetDamaged",
            "allyUsedRound",
            "targetAlreadyMoved",
            "damagedByTarget",
            "allyMovesLater",
            "allyPledge",
            "timesUsed",
            "timesUsedWithMetronome",
        ],
        "deterministic_defaults": {"isStellarFirstUse": False, "waitsForAllyPledge": False},
        "unsupported": ["overrides"],
    },
    "StatePokemon": {
        "source": ["name", "ability", "item", "nature", "moves"],
        "user": [
            "abilityOn",
            "gender",
            "alliesFainted",
            "boostedStat",
            "evs",
            "boosts",
            "originalCurrentHp",
            "status",
            "teraType",
            "toxicCounter",
        ],
        "deterministic_defaults": {},
        "unsupported": ["overrides"],
    },
}
EXPECTED_MA_SHOWDOWN_REVISION = "b555f4d8ce7250e72939fe0c12cc5b303741d203"
EXPECTED_MA_COMMIT_DATE = "2026-04-10"
EXPECTED_CWEBP_VERSION = "1.3.2"
SHOWDOWN_NOTICE_PATH = "POKEMON-SHOWDOWN-LICENSE.txt"
SHOWDOWN_NOTICE_SHA256 = "b2002a9fd52ba8db3783a05fbdebfb09c34fd09513b90f6b390a2c0dfbc93ed0"
EXPECTED_CWEBP_ARGS = [
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
ID_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
HASH_PATTERN = re.compile(r"[0-9a-f]{64}")
EXPECTED_PINNED_COUNTS = {
    "forms": 350,
    "types": 18,
    "memberships": 663,
    "profiles": 700,
    "abilities": 216,
    "ability_profiles": 432,
    "moves": 510,
    "move_profiles": 1020,
    "move_flags": 37,
    "move_flag_relations": 3928,
    "learnsets": 43429,
    "mega_relations": 82,
    "sprites": 700,
    "sprite_mappings": 350,
}
LEGACY_PINNED_COUNTS = {
    "forms": 353,
    "types": 18,
    "memberships": 667,
    "profiles": 706,
    "abilities": 217,
    "ability_profiles": 434,
    "moves": 510,
    "move_profiles": 1020,
    "move_flags": 37,
    "move_flag_relations": 3928,
    "learnsets": 43891,
    "mega_relations": 84,
    "sprites": 706,
    "sprite_mappings": 353,
}
PINNED_GROUP_COUNTS = {
    "legal_forms_by_regulation": {"m-b": 314, "m-c": 349},
    "learnsets_by_regulation": {"m-b": 21715, "m-c": 21714},
    "learnsets_by_form_resolution": {
        "base-to-mega": 10962,
        "changed-form": 932,
        "direct": 31535,
    },
    "learnsets_by_source_mod": {
        "base": 214,
        "champions": 43164,
        "championsregmb": 51,
    },
    "learnsets_by_source_kind": {
        "direct": 21607,
        "inherited": 21771,
        "override": 51,
    },
}
LEGACY_GROUP_COUNTS = {
    "legal_forms_by_regulation": {"m-b": 316, "m-c": 351},
    "learnsets_by_regulation": {"m-b": 21946, "m-c": 21945},
    "learnsets_by_form_resolution": {
        "base-to-mega": 11270,
        "changed-form": 932,
        "direct": 31689,
    },
    "learnsets_by_source_mod": {
        "base": 676,
        "champions": 43164,
        "championsregmb": 51,
    },
    "learnsets_by_source_kind": {
        "direct": 21607,
        "inherited": 22233,
        "override": 51,
    },
}
MULTI_PINNED_COUNTS = {
    "forms": 350,
    "types": 18,
    "memberships": 935,
    "profiles": 1050,
    "abilities": 216,
    "ability_profiles": 645,
    "moves": 511,
    "move_profiles": 1513,
    "move_flags": 37,
    "move_flag_relations": 5833,
    "learnsets": 64935,
    "mega_relations": 82,
    "sprites": 700,
    "sprite_mappings": 350,
}
TEAM_PINNED_COUNTS = {
    **MULTI_PINNED_COUNTS,
    "items": 166,
    "item_profiles": 431,
    "natures": 21,
    "mega_item_relations": 214,
}
ITEM_DESCRIPTION_SOURCE_COUNTS = {
    "m-a": {"desc": 2, "shortDesc": 115},
    "m-b": {"desc": 2, "shortDesc": 146},
    "m-c": {"desc": 2, "shortDesc": 164},
}
ITEM_INFO_PINNED_COUNTS = {
    **TEAM_PINNED_COUNTS,
    "item_description_sources_by_regulation": ITEM_DESCRIPTION_SOURCE_COUNTS,
}
CALCULATOR_PINNED_COUNTS = {
    **ITEM_INFO_PINNED_COUNTS,
    "type_effectiveness": 324,
    "calculator_capabilities": 1,
}
MULTI_GROUP_COUNTS = {
    "legal_forms_by_regulation": {"m-a": 272, "m-b": 314, "m-c": 349},
    "learnsets_by_regulation": {"m-a": 21506, "m-b": 21715, "m-c": 21714},
    "learnsets_by_form_resolution": {
        "base-to-mega": 16459,
        "changed-form": 1331,
        "direct": 47145,
    },
    "learnsets_by_source_mod": {
        "base": 4578,
        "champions": 60306,
        "championsregmb": 51,
    },
    "learnsets_by_source_kind": {
        "direct": 38749,
        "inherited": 26135,
        "override": 51,
    },
}
PINNED_RELEASE_CONTRACTS = {
    "showdown-multi-s5-i6-38ee90625b30": (
        "38ee90625b301639ff581409f3728f91e717373a9658ea516a4e9a336113fedd",
        CALCULATOR_PINNED_COUNTS,
        MULTI_GROUP_COUNTS,
        EXPECTED_SPRITE_MAPPING_SHA256,
        {
            "m-a": {
                "pokedex": 1516,
                "base_moves": 954,
                "base_abilities": 318,
                "base_item_texts": 564,
                "base_learnsets": 1287,
                "champions_format_entries": 1330,
                "championsregmb_format_entries": 0,
            },
            "m-b,m-c": {
                "pokedex": 1518,
                "base_moves": 954,
                "base_abilities": 321,
                "base_item_texts": 583,
                "base_learnsets": 1289,
                "champions_format_entries": 1361,
                "championsregmb_format_entries": 1361,
            },
        },
    ),
    "showdown-multi-s4-i5-7205fa48044e": (
        "7205fa48044e73f059e980629e222fcbdc1d5aaffb2bd667c8b8837a7b15ab6b",
        ITEM_INFO_PINNED_COUNTS,
        MULTI_GROUP_COUNTS,
        EXPECTED_SPRITE_MAPPING_SHA256,
        {
            "m-a": {
                "pokedex": 1516,
                "base_moves": 954,
                "base_abilities": 318,
                "base_item_texts": 564,
                "base_learnsets": 1287,
                "champions_format_entries": 1330,
                "championsregmb_format_entries": 0,
            },
            "m-b,m-c": {
                "pokedex": 1518,
                "base_moves": 954,
                "base_abilities": 321,
                "base_item_texts": 583,
                "base_learnsets": 1289,
                "champions_format_entries": 1361,
                "championsregmb_format_entries": 1361,
            },
        },
    ),
    "showdown-multi-s3-i4-5073b2ab1402": (
        "5073b2ab1402a90ec951e0b4ccc123956998b40092d7d74c26b50e9736a61267",
        TEAM_PINNED_COUNTS,
        MULTI_GROUP_COUNTS,
        EXPECTED_SPRITE_MAPPING_SHA256,
        {
            "m-a": {
                "pokedex": 1516,
                "base_moves": 954,
                "base_abilities": 318,
                "base_learnsets": 1287,
                "champions_format_entries": 1330,
                "championsregmb_format_entries": 0,
            },
            "m-b,m-c": {
                "pokedex": 1518,
                "base_moves": 954,
                "base_abilities": 321,
                "base_learnsets": 1289,
                "champions_format_entries": 1361,
                "championsregmb_format_entries": 1361,
            },
        },
    ),
    "showdown-3a766f2c-s1-i2-4bedbf1eb44d": (
        "4bedbf1eb44d797b319aa5f750698463fb5cca6a63de6ff725d5c0bb0bc115a9",
        EXPECTED_PINNED_COUNTS,
        PINNED_GROUP_COUNTS,
        EXPECTED_SPRITE_MAPPING_SHA256,
        None,
    ),
    "showdown-3a766f2c-s1-i1-923ba416555c": (
        "923ba416555ca33c4b5d17f84d246661d6ef61a6170959aac807454a1978ead2",
        LEGACY_PINNED_COUNTS,
        LEGACY_GROUP_COUNTS,
        LEGACY_SPRITE_MAPPING_SHA256,
        None,
    ),
    "showdown-multi-s2-i3-fc85b358deaa": (
        "fc85b358deaa105d4fcd57602dee863e29a57fa62e7bb6b1b69018ddd2dbd038",
        MULTI_PINNED_COUNTS,
        MULTI_GROUP_COUNTS,
        EXPECTED_SPRITE_MAPPING_SHA256,
        {
            "m-a": {
                "pokedex": 1516,
                "base_moves": 954,
                "base_abilities": 318,
                "base_learnsets": 1287,
                "champions_format_entries": 1330,
                "championsregmb_format_entries": 0,
            },
            "m-b,m-c": {
                "pokedex": 1518,
                "base_moves": 954,
                "base_abilities": 321,
                "base_learnsets": 1289,
                "champions_format_entries": 1361,
                "championsregmb_format_entries": 1361,
            },
        },
    ),
}
EXPECTED_SOURCE_COUNTS = {
    "pokedex": 1518,
    "base_moves": 954,
    "base_abilities": 321,
    "base_learnsets": 1289,
    "champions_format_entries": 1361,
    "championsregmb_format_entries": 1361,
}
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
ALLOWED_MOVE_FLAGS = frozenset(
    {
        "allyanim",
        "bypasssub",
        "bite",
        "bullet",
        "cantusetwice",
        "charge",
        "contact",
        "dance",
        "defrost",
        "distance",
        "failcopycat",
        "failencore",
        "failinstruct",
        "failmefirst",
        "failmimic",
        "futuremove",
        "gravity",
        "heal",
        "metronome",
        "minimize",
        "mirror",
        "mustpressure",
        "noassist",
        "nonsky",
        "noparentalbond",
        "nosketch",
        "nosleeptalk",
        "pledgecombo",
        "powder",
        "protect",
        "pulse",
        "punch",
        "recharge",
        "reflectable",
        "slicing",
        "snatch",
        "sound",
        "wind",
    }
)
DATA_FILES = (
    "mechanics_profiles.json",
    "regulations.json",
    "forms.json",
    "types.json",
    "abilities.json",
    "moves.json",
    "move_flags.json",
    "regulation_memberships.json",
    "profiles.json",
    "ability_profiles.json",
    "move_profiles.json",
    "move_flag_relations.json",
    "mega_relations.json",
    "learnsets.json",
    "sprite_mappings.json",
    "sprites.json",
)
TEAM_DATA_FILES = (
    *DATA_FILES[:6],
    "items.json",
    "item_profiles.json",
    "natures.json",
    *DATA_FILES[6:13],
    "mega_item_relations.json",
    *DATA_FILES[13:],
)
CALCULATOR_DATA_FILES = (
    *TEAM_DATA_FILES[:-2],
    "type_effectiveness.json",
    "calculator_capabilities.json",
    *TEAM_DATA_FILES[-2:],
)
FILE_KEYS: dict[str, tuple[str, ...]] = {
    "mechanics_profiles.json": ("id",),
    "regulations.json": ("id",),
    "forms.json": ("id",),
    "types.json": ("id",),
    "abilities.json": ("id",),
    "moves.json": ("id",),
    "move_flags.json": ("id",),
    "regulation_memberships.json": ("regulation_id", "form_id"),
    "profiles.json": ("regulation_id", "form_id"),
    "ability_profiles.json": ("regulation_id", "id"),
    "move_profiles.json": ("regulation_id", "id"),
    "move_flag_relations.json": ("regulation_id", "move_id", "flag_id"),
    "mega_relations.json": ("mega_form_id",),
    "learnsets.json": ("regulation_id", "form_id", "move_id"),
    "sprite_mappings.json": ("form_id",),
    "sprites.json": ("form_id", "variant"),
    "items.json": ("id",),
    "item_profiles.json": ("regulation_id", "id"),
    "natures.json": ("id",),
    "mega_item_relations.json": ("regulation_id", "item_id", "base_form_id"),
    "type_effectiveness.json": ("attacking_type_id", "defending_type_id"),
    "calculator_capabilities.json": ("id",),
}


class BundleReadError(ValueError):
    """A bundle is unsafe, corrupt, unsupported, or internally inconsistent."""


JsonObject = dict[str, Any]


@dataclass(frozen=True)
class PokemonDataBundle:
    """A verified bundle fully resident in memory before persistence starts."""

    directory: Path
    manifest: JsonObject
    provenance: JsonObject
    validation: JsonObject
    records: dict[str, list[JsonObject]]
    semantic_inventory: dict[str, dict[str, str]]

    @property
    def identifier(self) -> str:
        return cast(str, self.manifest["bundle_id"])

    @property
    def bundle_hash(self) -> str:
        return cast(str, self.manifest["bundle_hash"])


def canonical_bytes(value: object) -> bytes:
    """Serialize a value using the bundle's canonical JSON encoding."""
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _json(path: Path) -> Any:
    try:
        raw = path.read_bytes()
        value: Any = json.loads(raw)
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise BundleReadError(f"{path}: cannot read canonical JSON: {error}") from error
    if raw != canonical_bytes(value):
        raise BundleReadError(f"{path}: JSON is not canonically encoded")
    return value


def _object(value: Any, label: str) -> JsonObject:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise BundleReadError(f"{label}: expected an object")
    return cast(JsonObject, value)


def _records(value: Any, label: str) -> list[JsonObject]:
    if not isinstance(value, list):
        raise BundleReadError(f"{label}: expected an array")
    return [_object(item, f"{label}[{index}]") for index, item in enumerate(value)]


def _string(record: JsonObject, field: str, label: str) -> str:
    value = record.get(field)
    if not isinstance(value, str) or not value:
        raise BundleReadError(f"{label}: {field} must be a non-empty string")
    return value


def _text(record: JsonObject, field: str, label: str, *, maximum: int | None = None) -> str:
    value = _string(record, field, label)
    if maximum is not None and len(value) > maximum:
        raise BundleReadError(f"{label}: {field} exceeds {maximum} characters")
    return value


def _identifier(record: JsonObject, field: str, label: str) -> str:
    value = _text(record, field, label, maximum=100)
    if ID_PATTERN.fullmatch(value) is None:
        raise BundleReadError(f"{label}: {field} is not a canonical identifier")
    return value


def _canonical_json_object(path: Path, label: str) -> JsonObject:
    value = _object(_json(path), label)
    if path.read_bytes() != canonical_bytes(value):
        raise BundleReadError(f"{label}: JSON must use canonical encoding")
    return value


def _validate_item_text_overlay(directory: Path, declaration: JsonObject) -> dict[str, JsonObject]:
    """Authenticate the exact six historical Item-text transitions and fixtures."""
    overlay_path = Path(_string(declaration, "path", "provenance.json:overlays[0]"))
    overlay = _canonical_json_object(directory / overlay_path, overlay_path.as_posix())
    _exact_keys(
        overlay,
        {
            "id",
            "target_regulation",
            "target_revision",
            "text_source_revision",
            "transitions",
        },
        overlay_path.as_posix(),
    )
    if (
        overlay.get("id") != declaration.get("id")
        or overlay.get("target_regulation") != "m-a"
        or overlay.get("target_revision") != declaration.get("target_revision")
        or overlay.get("text_source_revision") != declaration.get("text_source_revision")
    ):
        raise BundleReadError(f"{overlay_path}: metadata does not match its declaration")
    declared_transitions = _records(
        declaration.get("transitions"), "provenance.json:overlays[0]:transitions"
    )
    overlay_transitions = _records(overlay.get("transitions"), f"{overlay_path}:transitions")
    if len(overlay_transitions) != len(declared_transitions):
        raise BundleReadError(f"{overlay_path}: transition count does not match its declaration")
    transition_keys = {
        "after",
        "authoring_date",
        "before",
        "fixture",
        "item_id",
        "rationale",
        "record",
    }
    state_keys = {
        "description",
        "description_source",
        "id",
        "mega_stone",
        "name",
        "short_description",
        "source_status",
    }
    fixture_keys = {"expected_after", "expected_before", "overlay_id", "record"}
    resolved_after: dict[str, JsonObject] = {}
    for index, (transition, declared) in enumerate(
        zip(overlay_transitions, declared_transitions, strict=True)
    ):
        label = f"{overlay_path}:transitions[{index}]"
        _exact_keys(transition, transition_keys, label)
        item_id = _identifier(transition, "item_id", label)
        expected_record = f"item_profiles.json:m-a:{item_id}"
        if (
            transition.get("record") != expected_record
            or declared.get("item_id") != item_id
            or declared.get("record") != expected_record
            or transition.get("authoring_date") != declared.get("authoring_date")
            or transition.get("rationale") != declared.get("rationale")
        ):
            raise BundleReadError(f"{label}: identity does not match its declaration")
        before = _object(transition.get("before"), f"{label}:before")
        after = _object(transition.get("after"), f"{label}:after")
        _exact_keys(before, state_keys, f"{label}:before")
        _exact_keys(after, state_keys, f"{label}:after")
        if (
            before.get("id") != item_id
            or before.get("short_description") is not None
            or before.get("description") is not None
            or before.get("description_source") is not None
            or after.get("id") != item_id
            or before.get("name") != after.get("name")
            or before.get("source_status") != "standard"
            or after.get("source_status") != "standard"
            or before.get("mega_stone") != after.get("mega_stone")
        ):
            raise BundleReadError(f"{label}: invalid before/after Item transition")
        item_name = _text(after, "name", f"{label}:after", maximum=200)
        expected_rationale = (
            f"The pinned M-A revision legally enables {item_name} but lacks its Item text; "
            "use the exact text from the pinned current revision."
        )
        if transition.get("rationale") != expected_rationale:
            raise BundleReadError(f"{label}: rationale does not identify the declared Item")
        short_description = _text(after, "short_description", f"{label}:after")
        description = _text(after, "description", f"{label}:after")
        if after.get("description_source") != "shortDesc" or description != short_description:
            raise BundleReadError(f"{label}: invalid resolved Item text")
        mega_stones = _records(after.get("mega_stone"), f"{label}:after:mega_stone")
        if not mega_stones:
            raise BundleReadError(f"{label}: missing Mega Stone identity")
        for stone_index, stone in enumerate(mega_stones):
            stone_label = f"{label}:after:mega_stone[{stone_index}]"
            _exact_keys(stone, {"base_form_id", "mega_form_id"}, stone_label)
            _identifier(stone, "base_form_id", stone_label)
            _identifier(stone, "mega_form_id", stone_label)
        fixture_name = transition.get("fixture")
        fixture_path = Path(_string(declared, "fixture_path", label))
        if fixture_name != fixture_path.name:
            raise BundleReadError(f"{label}: fixture identity does not match its declaration")
        fixture = _canonical_json_object(directory / fixture_path, fixture_path.as_posix())
        _exact_keys(fixture, fixture_keys, fixture_path.as_posix())
        if (
            fixture.get("overlay_id") != declaration.get("id")
            or fixture.get("record") != expected_record
            or fixture.get("expected_before") != before
            or fixture.get("expected_after") != after
        ):
            raise BundleReadError(f"{fixture_path}: fixture does not match transition {item_id}")
        resolved_after[item_id] = after
    return resolved_after


def _boolean(record: JsonObject, field: str, label: str) -> bool:
    value = record.get(field)
    if not isinstance(value, bool):
        raise BundleReadError(f"{label}: {field} must be a boolean")
    return value


def _integer_range(
    record: JsonObject, field: str, label: str, *, minimum: int, maximum: int
) -> int:
    value = record.get(field)
    if not isinstance(value, int) or isinstance(value, bool) or not minimum <= value <= maximum:
        raise BundleReadError(
            f"{label}: {field} must be an integer between {minimum} and {maximum}"
        )
    return value


def _exact_keys(record: JsonObject, expected: set[str], label: str) -> None:
    if set(record) != expected:
        missing = sorted(expected - record.keys())
        unexpected = sorted(record.keys() - expected)
        raise BundleReadError(
            f"{label}: unexpected record shape; missing={missing}, unexpected={unexpected}"
        )


def _string_list(value: Any, label: str, *, minimum: int = 0) -> list[str]:
    if (
        not isinstance(value, list)
        or len(value) < minimum
        or any(not isinstance(item, str) or not item for item in value)
    ):
        raise BundleReadError(f"{label}: expected an array of non-empty strings")
    return cast(list[str], value)


def _key(record: JsonObject, fields: tuple[str, ...], label: str) -> str:
    return ":".join(_string(record, field, label) for field in fields)


def _validate_unique(records: list[JsonObject], fields: tuple[str, ...], label: str) -> None:
    seen: set[str] = set()
    for record in records:
        key = _key(record, fields, label)
        if key in seen:
            raise BundleReadError(f"{label}: duplicate key {key}")
        seen.add(key)


def _validate_contextual_inputs(value: Any, label: str) -> None:
    values = _records(value, label)
    allowed = {
        "ability_active",
        "allies_fainted",
        "boosted_stat",
        "consecutive_uses",
        "hits_taken",
        "last_move_failed",
        "target_already_moved",
        "target_damaged",
        "damaged_by_target",
        "ally_used_round",
        "ally_pledge",
        "ally_moves_later",
        "hits",
        "prior_damage_taken",
        "stockpile_count",
        "ally_1_base_attack",
        "ally_2_base_attack",
        "ally_3_base_attack",
    }
    seen: set[str] = set()
    for index, record in enumerate(values):
        record_label = f"{label}[{index}]"
        kind = record.get("kind")
        keys = {"key", "label", "kind", "default"}
        if kind == "integer":
            keys.update({"minimum", "maximum"})
        elif kind == "choice":
            keys.add("choices")
        elif kind != "boolean":
            raise BundleReadError(f"{record_label}: invalid context kind")
        _exact_keys(record, keys, record_label)
        key = _string(record, "key", record_label)
        if key not in allowed or key in seen:
            raise BundleReadError(f"{record_label}: unknown or duplicate context key")
        seen.add(key)
        _text(record, "label", record_label, maximum=100)
        if kind == "boolean" and not isinstance(record.get("default"), bool):
            raise BundleReadError(f"{record_label}: invalid boolean default")
        if kind == "integer":
            minimum = _integer_range(record, "minimum", record_label, minimum=0, maximum=100)
            maximum = _integer_range(
                record, "maximum", record_label, minimum=minimum, maximum=65535
            )
            _integer_range(record, "default", record_label, minimum=minimum, maximum=maximum)
        if kind == "choice":
            choices = record.get("choices")
            _string_list(choices, f"{record_label}:choices", minimum=1)
            assert isinstance(choices, list)
            if record.get("default") not in choices:
                raise BundleReadError(f"{record_label}: unavailable choice default")


def _validate_effect(value: Any, label: str) -> None:
    if value is None:
        return
    record = _object(value, label)
    _exact_keys(record, {"chance", "boosts", "self_boosts", "status", "volatile_status"}, label)
    chance = record["chance"]
    if chance is not None and (
        not isinstance(chance, int) or isinstance(chance, bool) or not 0 <= chance <= 100
    ):
        raise BundleReadError(f"{label}: invalid chance")
    for field in ("boosts", "self_boosts"):
        boosts = _object(record[field], f"{label}:{field}")
        if any(
            key not in {"atk", "def", "spa", "spd", "spe", "accuracy", "evasion"}
            or not isinstance(stages, int)
            or isinstance(stages, bool)
            or not -6 <= stages <= 6
            for key, stages in boosts.items()
        ):
            raise BundleReadError(f"{label}: invalid boosts")
    for field in ("status", "volatile_status"):
        if record[field] is not None and not isinstance(record[field], str):
            raise BundleReadError(f"{label}: invalid {field}")


def _validate_fraction(value: Any, label: str) -> None:
    if value is not None and (
        not isinstance(value, list)
        or len(value) != 2
        or any(not isinstance(part, int) or isinstance(part, bool) for part in value)
        or value[0] < 0
        or value[1] <= 0
    ):
        raise BundleReadError(f"{label}: invalid fraction")


def _validate_item_calculation(value: Any, label: str, type_ids: set[str]) -> None:
    record = _object(value, label)
    _exact_keys(
        record,
        {
            "fling_base_power",
            "natural_gift",
            "plate_type_id",
            "drive_type_id",
            "memory_type_id",
            "mega_stone",
            "damage_boost",
            "damage_resist",
        },
        label,
    )
    _integer_range(record, "fling_base_power", label, minimum=0, maximum=255)
    _boolean(record, "mega_stone", label)
    for field in ("plate_type_id", "drive_type_id", "memory_type_id"):
        if record[field] is not None and record[field] not in type_ids:
            raise BundleReadError(f"{label}: unknown {field}")
    for field in ("natural_gift", "damage_boost", "damage_resist"):
        if record[field] is None:
            continue
        nested = _object(record[field], f"{label}:{field}")
        required = (
            {"type_id", "base_power"}
            if field == "natural_gift"
            else {"type_id", "numerator", "denominator"}
            if field == "damage_boost"
            else {"type_id"}
        )
        _exact_keys(nested, required, f"{label}:{field}")
        if nested["type_id"] not in type_ids:
            raise BundleReadError(f"{label}:{field}: unknown type_id")
        for number in required - {"type_id"}:
            _integer_range(nested, number, f"{label}:{field}", minimum=1, maximum=65535)


def _validate_record_shapes(records: dict[str, list[JsonObject]], *, schema_version: str) -> None:
    """Validate every field before ORM construction can observe malformed values."""
    mechanics_keys = {
        "id",
        "level",
        "sp_minimum",
        "sp_maximum",
        "hp_formula",
        "other_formula",
        "nature_percentages",
    }
    if "items.json" in records:
        mechanics_keys.add("sp_total_max")
    for index, record in enumerate(records["mechanics_profiles.json"]):
        label = f"mechanics_profiles.json[{index}]"
        _exact_keys(record, mechanics_keys, label)
        _identifier(record, "id", label)
    regulation_keys = {
        "id",
        "name",
        "showdown_format_id",
        "mod",
        "ruleset",
        "mechanics_profile_id",
    }
    for index, record in enumerate(records["regulations.json"]):
        label = f"regulations.json[{index}]"
        _exact_keys(record, regulation_keys, label)
        _identifier(record, "id", label)
        _text(record, "name", label, maximum=200)
        _text(record, "showdown_format_id", label, maximum=150)
        _text(record, "mod", label, maximum=100)
        _identifier(record, "mechanics_profile_id", label)
        _string_list(record["ruleset"], f"{label}:ruleset", minimum=1)
    form_keys = {
        "id",
        "name",
        "national_dex_number",
        "base_form_id",
        "form_label",
        "is_mega",
        "sprite_id",
    }
    if schema_version == CALCULATOR_SCHEMA_VERSION:
        form_keys.update({"is_nfe", "gender", "gender_options", "default_gender"})
    for index, record in enumerate(records["forms.json"]):
        label = f"forms.json[{index}]"
        _exact_keys(record, form_keys, label)
        _identifier(record, "id", label)
        _text(record, "name", label, maximum=200)
        _integer_range(record, "national_dex_number", label, minimum=1, maximum=32767)
        _identifier(record, "base_form_id", label)
        form_label = record.get("form_label")
        if not isinstance(form_label, str) or len(form_label) > 100:
            raise BundleReadError(f"{label}: form_label must be a string up to 100 characters")
        _boolean(record, "is_mega", label)
        if schema_version == CALCULATOR_SCHEMA_VERSION:
            _boolean(record, "is_nfe", label)
            if _text(record, "gender", label, maximum=16) not in {"M", "F", "N", "variable"}:
                raise BundleReadError(f"{label}: invalid gender")
            gender_options = _string_list(
                record.get("gender_options"), f"{label}:gender_options", minimum=1
            )
            default_gender = _text(record, "default_gender", label, maximum=1)
            expected_options = ["M", "F"] if record["gender"] == "variable" else [record["gender"]]
            if gender_options != expected_options or default_gender not in gender_options:
                raise BundleReadError(f"{label}: invalid gender options or default")
        sprite_id = _text(record, "sprite_id", label, maximum=100)
        if re.fullmatch(r"[a-z0-9-]+", sprite_id) is None:
            raise BundleReadError(f"{label}: invalid sprite_id")
    for name in ("types.json", "abilities.json", "moves.json"):
        for index, record in enumerate(records[name]):
            label = f"{name}[{index}]"
            _exact_keys(record, {"id", "name"}, label)
            _identifier(record, "id", label)
            _text(record, "name", label, maximum=200)
    if "items.json" in records:
        for name in ("items.json", "natures.json"):
            for index, record in enumerate(records[name]):
                label = f"{name}[{index}]"
                if name == "items.json":
                    _exact_keys(record, {"id", "name"}, label)
                else:
                    _exact_keys(record, {"id", "name", "increased_stat", "decreased_stat"}, label)
                    for field in ("increased_stat", "decreased_stat"):
                        value = record[field]
                        if value is not None and value not in {"atk", "def", "spa", "spd", "spe"}:
                            raise BundleReadError(f"{label}: invalid {field}")
                _identifier(record, "id", label)
                _text(record, "name", label, maximum=200)
        for index, record in enumerate(records["item_profiles.json"]):
            label = f"item_profiles.json[{index}]"
            keys = {"regulation_id", "id", "name", "source_status"}
            if schema_version in {ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}:
                keys.update({"short_description", "description", "description_source"})
            if schema_version == CALCULATOR_SCHEMA_VERSION:
                keys.update({"contextual_inputs", "calculation"})
            _exact_keys(record, keys, label)
            _identifier(record, "regulation_id", label)
            _identifier(record, "id", label)
            _text(record, "name", label, maximum=200)
            if record.get("source_status") != "standard":
                raise BundleReadError(f"{label}: item must be standard")
            if schema_version in {ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}:
                short_description = _text(record, "short_description", label)
                description = _text(record, "description", label)
                if (
                    short_description.strip() != short_description
                    or description.strip() != description
                ):
                    raise BundleReadError(f"{label}: Item descriptions must be trimmed")
                description_source = record.get("description_source")
                if description_source not in {"desc", "shortDesc"}:
                    raise BundleReadError(f"{label}: invalid description_source")
                if description_source == "shortDesc" and description != short_description:
                    raise BundleReadError(
                        f"{label}: shortDesc description must equal short_description"
                    )
            if schema_version == CALCULATOR_SCHEMA_VERSION:
                _validate_contextual_inputs(
                    record.get("contextual_inputs"), f"{label}:contextual_inputs"
                )
                _validate_item_calculation(
                    record.get("calculation"),
                    f"{label}:calculation",
                    {_string(item, "id", "types.json") for item in records["types.json"]},
                )
        for index, record in enumerate(records["mega_item_relations.json"]):
            label = f"mega_item_relations.json[{index}]"
            _exact_keys(record, {"regulation_id", "item_id", "base_form_id", "mega_form_id"}, label)
            for field in ("regulation_id", "item_id", "base_form_id", "mega_form_id"):
                _identifier(record, field, label)
    for index, record in enumerate(records["move_flags.json"]):
        label = f"move_flags.json[{index}]"
        _exact_keys(record, {"id"}, label)
        _identifier(record, "id", label)
    for index, record in enumerate(records["regulation_memberships.json"]):
        label = f"regulation_memberships.json[{index}]"
        _exact_keys(record, {"regulation_id", "form_id"}, label)
        _identifier(record, "regulation_id", label)
        _identifier(record, "form_id", label)
    for index, record in enumerate(records["profiles.json"]):
        label = f"profiles.json[{index}]"
        profile_keys = {"regulation_id", "form_id", "stats", "bst", "types", "abilities"}
        if schema_version == CALCULATOR_SCHEMA_VERSION:
            profile_keys.add("weight_tenths_kg")
        _exact_keys(record, profile_keys, label)
        _identifier(record, "regulation_id", label)
        _identifier(record, "form_id", label)
        stats = _object(record.get("stats"), f"{label}:stats")
        _exact_keys(stats, {"hp", "atk", "def", "spa", "spd", "spe"}, f"{label}:stats")
        for stat in ("hp", "atk", "def", "spa", "spd", "spe"):
            _integer_range(stats, stat, f"{label}:stats", minimum=1, maximum=32767)
        _integer_range(record, "bst", label, minimum=6, maximum=32767)
        if schema_version == CALCULATOR_SCHEMA_VERSION:
            _integer_range(record, "weight_tenths_kg", label, minimum=1, maximum=2_147_483_647)
        _string_list(record["types"], f"{label}:types", minimum=1)
        abilities = _records(record.get("abilities"), f"{label}:abilities")
        if not abilities:
            raise BundleReadError(f"{label}: at least one ability is required")
        for ability_index, ability in enumerate(abilities):
            ability_label = f"{label}:abilities[{ability_index}]"
            _exact_keys(ability, {"slot", "ability_id"}, ability_label)
            if _text(ability, "slot", ability_label, maximum=20) not in {"0", "1", "H", "S"}:
                raise BundleReadError(f"{ability_label}: unsupported ability slot")
            _identifier(ability, "ability_id", ability_label)
    ability_profile_keys = {
        "regulation_id",
        "id",
        "name",
        "short_description",
        "description",
    }
    if schema_version == CALCULATOR_SCHEMA_VERSION:
        ability_profile_keys.add("contextual_inputs")
    for index, record in enumerate(records["ability_profiles.json"]):
        label = f"ability_profiles.json[{index}]"
        _exact_keys(record, ability_profile_keys, label)
        _identifier(record, "regulation_id", label)
        _identifier(record, "id", label)
        _text(record, "name", label, maximum=200)
        _text(record, "short_description", label)
        _text(record, "description", label)
        if schema_version == CALCULATOR_SCHEMA_VERSION:
            _validate_contextual_inputs(
                record.get("contextual_inputs"), f"{label}:contextual_inputs"
            )
    move_profile_keys = {
        "regulation_id",
        "id",
        "name",
        "type",
        "category",
        "base_power",
        "accuracy",
        "pp",
        "priority",
        "target",
        "short_description",
        "description",
    }
    if schema_version == CALCULATOR_SCHEMA_VERSION:
        move_profile_keys.update({"calculation", "contextual_inputs"})
    for index, record in enumerate(records["move_profiles.json"]):
        label = f"move_profiles.json[{index}]"
        _exact_keys(record, move_profile_keys, label)
        _identifier(record, "regulation_id", label)
        _identifier(record, "id", label)
        _text(record, "name", label, maximum=200)
        _text(record, "type", label, maximum=200)
        if _text(record, "category", label) not in {"Physical", "Special", "Status"}:
            raise BundleReadError(f"{label}: invalid category")
        _integer_range(record, "base_power", label, minimum=0, maximum=32767)
        accuracy = record.get("accuracy")
        if accuracy != "always":
            _integer_range(record, "accuracy", label, minimum=1, maximum=100)
        _integer_range(record, "pp", label, minimum=1, maximum=20)
        _integer_range(record, "priority", label, minimum=-32768, maximum=32767)
        _text(record, "target", label, maximum=100)
        _text(record, "short_description", label)
        _text(record, "description", label)
        if schema_version == CALCULATOR_SCHEMA_VERSION:
            calculation = _object(record.get("calculation"), f"{label}:calculation")
            _exact_keys(
                calculation,
                {
                    "multihit",
                    "multiaccuracy",
                    "crit_ratio",
                    "always_crit",
                    "drain",
                    "recoil",
                    "crash_damage",
                    "mind_blown_recoil",
                    "struggle_recoil",
                    "ignore_defensive",
                    "override_defensive_stat",
                    "breaks_protect",
                    "self",
                    "self_boost",
                    "secondary",
                    "secondaries",
                },
                f"{label}:calculation",
            )
            _validate_fraction(calculation["drain"], f"{label}:calculation:drain")
            _validate_fraction(calculation["recoil"], f"{label}:calculation:recoil")
            for field in ("self", "self_boost", "secondary"):
                _validate_effect(calculation[field], f"{label}:calculation:{field}")
            secondaries = calculation["secondaries"]
            if not isinstance(secondaries, list):
                raise BundleReadError(f"{label}:calculation:secondaries must be an array")
            for effect_index, effect in enumerate(secondaries):
                _validate_effect(effect, f"{label}:calculation:secondaries[{effect_index}]")
            for field in (
                "multiaccuracy",
                "always_crit",
                "crash_damage",
                "mind_blown_recoil",
                "struggle_recoil",
                "ignore_defensive",
                "breaks_protect",
            ):
                _boolean(calculation, field, f"{label}:calculation")
            multihit = calculation["multihit"]
            if multihit is not None and (
                isinstance(multihit, bool)
                or (
                    not (isinstance(multihit, int) and multihit > 0)
                    and not (
                        isinstance(multihit, list)
                        and len(multihit) == 2
                        and all(
                            isinstance(hit, int) and not isinstance(hit, bool) for hit in multihit
                        )
                        and 0 < multihit[0] <= multihit[1] <= 100
                    )
                )
            ):
                raise BundleReadError(f"{label}:calculation: invalid multihit")
            _integer_range(calculation, "crit_ratio", f"{label}:calculation", minimum=0, maximum=6)
            if calculation["override_defensive_stat"] not in {None, "def", "spd"}:
                raise BundleReadError(f"{label}:calculation: unsupported defensive stat")
            _validate_contextual_inputs(
                record.get("contextual_inputs"), f"{label}:contextual_inputs"
            )
    relation_shapes = {
        "move_flag_relations.json": {"regulation_id", "move_id", "flag_id"},
        "mega_relations.json": {"base_form_id", "mega_form_id"},
    }
    for name, expected_keys in relation_shapes.items():
        for index, record in enumerate(records[name]):
            label = f"{name}[{index}]"
            _exact_keys(record, expected_keys, label)
            for field in expected_keys:
                _identifier(record, field, label)
    learnset_keys = {
        "regulation_id",
        "form_id",
        "move_id",
        "form_resolution",
        "source_form_id",
        "source_mod",
        "source_kind",
    }
    for index, record in enumerate(records["learnsets.json"]):
        label = f"learnsets.json[{index}]"
        _exact_keys(record, learnset_keys, label)
        for field in ("regulation_id", "form_id", "move_id", "source_form_id"):
            _identifier(record, field, label)
        if record.get("form_resolution") not in {
            "direct",
            "pre-evolution",
            "changed-form",
            "base-to-mega",
        }:
            raise BundleReadError(f"{label}: invalid form_resolution")
        if record.get("source_mod") not in {"base", "champions", "championsregmb"}:
            raise BundleReadError(f"{label}: invalid source_mod")
        if record.get("source_kind") not in {"direct", "inherited", "override"}:
            raise BundleReadError(f"{label}: invalid source_kind")
    if schema_version == CALCULATOR_SCHEMA_VERSION:
        for index, record in enumerate(records["type_effectiveness.json"]):
            label = f"type_effectiveness.json[{index}]"
            _exact_keys(
                record, {"attacking_type_id", "defending_type_id", "multiplier_percent"}, label
            )
            _identifier(record, "attacking_type_id", label)
            _identifier(record, "defending_type_id", label)
            multiplier = _integer_range(record, "multiplier_percent", label, minimum=0, maximum=200)
            if multiplier not in {0, 50, 100, 200}:
                raise BundleReadError(f"{label}: invalid multiplier")
        expected_capability = [
            {
                "id": "damage-calculator-v1",
                "formula_reference": "vgcmulticalc@166578cf88c4219dff7dbaa562b0a4e798b274f3",
                "game_type": "Doubles",
                "level": 50,
                "context_schema_version": "damage-context-v1",
                "status_values": ["", "brn", "par", "psn", "slp", "frz", "tox"],
                "stat_stage_minimum": -6,
                "stat_stage_maximum": 6,
                "state_input_policy": STATE_INPUT_POLICY,
            }
        ]
        if records["calculator_capabilities.json"] != expected_capability:
            raise BundleReadError("calculator_capabilities.json: unsupported calculator contract")
    mapping_keys = {"form_id", "pokeapi_pokemon_id", "pokeapi_identifier", "mapping_rule"}
    for index, record in enumerate(records["sprite_mappings.json"]):
        label = f"sprite_mappings.json[{index}]"
        _exact_keys(record, mapping_keys, label)
        _identifier(record, "form_id", label)
        _integer_range(record, "pokeapi_pokemon_id", label, minimum=1, maximum=2_147_483_647)
        identifier = _text(record, "pokeapi_identifier", label, maximum=200)
        if re.fullmatch(r"[a-z0-9-]+", identifier) is None:
            raise BundleReadError(f"{label}: invalid pokeapi_identifier")
        if record.get("mapping_rule") not in {"normalized-identifier", "exception"}:
            raise BundleReadError(f"{label}: invalid mapping_rule")
    sprite_keys = {
        "form_id",
        "variant",
        "path",
        "source_path",
        "source_sha256",
        "pokeapi_pokemon_id",
        "pokeapi_identifier",
        "mapping_rule",
        "source_width",
        "source_height",
        "source_bit_depth",
        "source_color_type",
        "source_interlace",
        "cwebp_version",
        "cwebp_args",
        "sha256",
        "width",
        "height",
        "has_alpha",
        "is_animated",
        "has_metadata",
    }
    for index, record in enumerate(records["sprites.json"]):
        label = f"sprites.json[{index}]"
        _exact_keys(record, sprite_keys, label)
        form_id = _identifier(record, "form_id", label)
        variant = _text(record, "variant", label)
        if variant not in {"normal", "shiny"}:
            raise BundleReadError(f"{label}: invalid variant")
        pokemon_id = _integer_range(
            record, "pokeapi_pokemon_id", label, minimum=1, maximum=2_147_483_647
        )
        _text(record, "pokeapi_identifier", label, maximum=200)
        if re.fullmatch(r"[a-z0-9-]+", cast(str, record["pokeapi_identifier"])) is None:
            raise BundleReadError(f"{label}: invalid pokeapi_identifier")
        if record.get("mapping_rule") not in {"normalized-identifier", "exception"}:
            raise BundleReadError(f"{label}: invalid mapping_rule")
        expected_path = f"sprites/{variant}/{form_id}.webp"
        if _string(record, "path", label) != expected_path:
            raise BundleReadError(f"{label}: path must be {expected_path}")
        shiny = "shiny/" if variant == "shiny" else ""
        expected_source = f"sprites/pokemon/other/home/{shiny}{pokemon_id}.png"
        if _string(record, "source_path", label) != expected_source:
            raise BundleReadError(f"{label}: source_path must be {expected_source}")
        for field in ("source_sha256", "sha256"):
            if HASH_PATTERN.fullmatch(_string(record, field, label)) is None:
                raise BundleReadError(f"{label}: invalid {field}")
        expected_constants: dict[str, object] = {
            "source_width": 512,
            "source_height": 512,
            "source_bit_depth": 8,
            "source_color_type": 6,
            "source_interlace": 0,
            "cwebp_version": EXPECTED_CWEBP_VERSION,
            "cwebp_args": EXPECTED_CWEBP_ARGS,
            "width": 384,
            "height": 384,
            "has_alpha": True,
            "is_animated": False,
            "has_metadata": False,
        }
        for field, expected in expected_constants.items():
            if record.get(field) != expected or type(record.get(field)) is not type(expected):
                raise BundleReadError(f"{label}: {field} must be {expected!r}")


def _validate_relations(records: dict[str, list[JsonObject]], *, schema_version: str) -> None:
    form_ids = {_string(item, "id", "forms.json") for item in records["forms.json"]}
    regulation_ids = {
        _string(item, "id", "regulations.json") for item in records["regulations.json"]
    }
    type_ids = {_string(item, "id", "types.json") for item in records["types.json"]}
    ability_ids = {_string(item, "id", "abilities.json") for item in records["abilities.json"]}
    move_ids = {_string(item, "id", "moves.json") for item in records["moves.json"]}
    flag_ids = {_string(item, "id", "move_flags.json") for item in records["move_flags.json"]}
    if not flag_ids <= ALLOWED_MOVE_FLAGS:
        raise BundleReadError(
            f"move_flags.json: unknown flags {sorted(flag_ids - ALLOWED_MOVE_FLAGS)}"
        )
    mechanics_ids = {
        _string(item, "id", "mechanics_profiles.json")
        for item in records["mechanics_profiles.json"]
    }
    expected_regulation_ids = (
        {"m-a", "m-b", "m-c"} if schema_version in MULTI_SCHEMA_VERSIONS else {"m-b", "m-c"}
    )
    if regulation_ids != expected_regulation_ids:
        required = ", ".join(sorted(expected_regulation_ids))
        raise BundleReadError(f"regulations.json: exactly {required} are required")
    expected_mechanics: JsonObject = {
        "id": "champions-level-50-v1",
        "level": 50,
        "sp_minimum": 0,
        "sp_maximum": 32,
        "hp_formula": "base + sp + 75",
        "other_formula": "truncate((base + sp + 20) * nature_percent / 100)",
        "nature_percentages": {"hindering": 90, "neutral": 100, "increasing": 110},
    }
    if schema_version in {TEAM_SCHEMA_VERSION, ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}:
        expected_mechanics["sp_total_max"] = 66
    if records["mechanics_profiles.json"] != [expected_mechanics]:
        raise BundleReadError("mechanics_profiles.json: unsupported mechanics contract")
    if schema_version == CALCULATOR_SCHEMA_VERSION:
        expected_pairs = {
            (attacking, defending) for attacking in type_ids for defending in type_ids
        }
        actual_pairs = {
            (
                _string(value, "attacking_type_id", "type_effectiveness.json"),
                _string(value, "defending_type_id", "type_effectiveness.json"),
            )
            for value in records["type_effectiveness.json"]
        }
        if actual_pairs != expected_pairs:
            raise BundleReadError("type_effectiveness.json: exact type pair coverage is required")
    regulations_by_id = {
        _string(item, "id", "regulations.json"): item for item in records["regulations.json"]
    }
    expected_regulations = {
        "m-a": {
            "name": "[Gen 9 Champions] VGC 2026 Reg M-A",
            "showdown_format_id": "gen9championsvgc2026regma",
            "mod": "champions",
        },
        "m-b": {
            "name": "[Gen 9 Champions] VGC 2026 Reg M-B",
            "showdown_format_id": "gen9championsvgc2026regmb",
            "mod": "championsregmb",
        },
        "m-c": {
            "name": "[Gen 9 Champions] VGC 2026 Reg M-C",
            "showdown_format_id": "gen9championsvgc2026regmc",
            "mod": "champions",
        },
    }
    for regulation_id in expected_regulation_ids:
        expected = expected_regulations[regulation_id]
        regulation = regulations_by_id[regulation_id]
        if any(regulation[field] != value for field, value in expected.items()) or regulation[
            "ruleset"
        ] != ["Flat Rules", "VGC Timer", "Open Team Sheets"]:
            raise BundleReadError(f"regulations.json:{regulation_id}: unexpected format metadata")
    for form in records["forms.json"]:
        form_id = _string(form, "id", "forms.json")
        base_id = _string(form, "base_form_id", f"forms.json:{form_id}")
        if base_id not in form_ids:
            raise BundleReadError(f"forms.json:{form_id}: missing base form {base_id}")
        dex = form.get("national_dex_number")
        if not isinstance(dex, int) or isinstance(dex, bool) or dex <= 0:
            raise BundleReadError(f"forms.json:{form_id}: invalid National Dex number")
    for regulation_id, regulation in regulations_by_id.items():
        mechanics_id = _string(
            regulation, "mechanics_profile_id", f"regulations.json:{regulation_id}"
        )
        if mechanics_id not in mechanics_ids:
            raise BundleReadError(
                f"regulations.json:{regulation_id}: missing mechanics profile {mechanics_id}"
            )
    ability_profile_ids = {
        (
            _string(item, "regulation_id", "ability_profiles.json"),
            _string(item, "id", "ability_profiles.json"),
        )
        for item in records["ability_profiles.json"]
    }
    move_profile_ids = {
        (
            _string(item, "regulation_id", "move_profiles.json"),
            _string(item, "id", "move_profiles.json"),
        )
        for item in records["move_profiles.json"]
    }
    profile_ids: set[tuple[str, str]] = set()
    for profile in records["profiles.json"]:
        regulation_id = _string(profile, "regulation_id", "profiles.json")
        form_id = _string(profile, "form_id", "profiles.json")
        if regulation_id not in regulation_ids or form_id not in form_ids:
            raise BundleReadError(f"profiles.json: dangling profile {regulation_id}:{form_id}")
        stats = _object(profile.get("stats"), f"profiles.json:{regulation_id}:{form_id}:stats")
        if set(stats) != {"hp", "atk", "def", "spa", "spd", "spe"} or any(
            not isinstance(value, int) or isinstance(value, bool) or value <= 0
            for value in stats.values()
        ):
            raise BundleReadError(f"profiles.json:{regulation_id}:{form_id}: invalid stats")
        if profile.get("bst") != sum(cast(int, value) for value in stats.values()):
            raise BundleReadError(f"profiles.json:{regulation_id}:{form_id}: invalid BST")
        types = profile.get("types")
        if (
            not isinstance(types, list)
            or not 1 <= len(types) <= 2
            or len(set(types)) != len(types)
            or any(
                not isinstance(value, str)
                or re.sub(r"[^a-z0-9]+", "", value.lower()) not in type_ids
                for value in types
            )
        ):
            raise BundleReadError(f"profiles.json:{regulation_id}:{form_id}: invalid types")
        abilities = _records(
            profile.get("abilities"), f"profiles.json:{regulation_id}:{form_id}:abilities"
        )
        if not abilities:
            raise BundleReadError(
                f"profiles.json:{regulation_id}:{form_id}: abilities are required"
            )
        slots: set[str] = set()
        for ability in abilities:
            slot = _string(ability, "slot", "profile ability")
            ability_id = _string(ability, "ability_id", "profile ability")
            if slot in slots or (regulation_id, ability_id) not in ability_profile_ids:
                raise BundleReadError(
                    f"profiles.json:{regulation_id}:{form_id}: invalid ability {slot}:{ability_id}"
                )
            slots.add(slot)
        profile_ids.add((regulation_id, form_id))
    expected_profiles = {
        (regulation_id, form_id) for regulation_id in regulation_ids for form_id in form_ids
    }
    if profile_ids != expected_profiles:
        raise BundleReadError(
            "profiles.json: every included form requires every regulation profile"
        )
    memberships = {
        (
            _string(item, "regulation_id", "regulation_memberships.json"),
            _string(item, "form_id", "regulation_memberships.json"),
        )
        for item in records["regulation_memberships.json"]
    }
    if not memberships <= profile_ids:
        raise BundleReadError(
            "regulation_memberships.json: membership without an effective profile"
        )
    if schema_version in {TEAM_SCHEMA_VERSION, ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}:
        item_ids = {_string(item, "id", "items.json") for item in records["items.json"]}
        item_profiles = {
            (
                _string(item, "regulation_id", "item_profiles.json"),
                _string(item, "id", "item_profiles.json"),
            )
            for item in records["item_profiles.json"]
        }
        if any(
            regulation_id not in regulation_ids or item_id not in item_ids
            for regulation_id, item_id in item_profiles
        ):
            raise BundleReadError("item_profiles.json: dangling item profile")
        natures = records["natures.json"]
        if {item["id"] for item in natures if item["increased_stat"] is None} != {"serious"}:
            raise BundleReadError("natures.json: Serious must be the only neutral nature")
        for relation in records["mega_item_relations.json"]:
            regulation_id = _string(relation, "regulation_id", "mega_item_relations.json")
            item_id = _string(relation, "item_id", "mega_item_relations.json")
            base_id = _string(relation, "base_form_id", "mega_item_relations.json")
            mega_id = _string(relation, "mega_form_id", "mega_item_relations.json")
            if (
                (regulation_id, item_id) not in item_profiles
                or base_id not in form_ids
                or mega_id not in form_ids
            ):
                raise BundleReadError("mega_item_relations.json: dangling relation")
            base = next(item for item in records["forms.json"] if item["id"] == base_id)
            mega = next(item for item in records["forms.json"] if item["id"] == mega_id)
            if (
                base["is_mega"]
                or not mega["is_mega"]
                or mega["base_form_id"] != base["base_form_id"]
            ):
                raise BundleReadError("mega_item_relations.json: incoherent Mega mapping")
    for profile in records["ability_profiles.json"]:
        if (
            _string(profile, "regulation_id", "ability_profiles.json") not in regulation_ids
            or _string(profile, "id", "ability_profiles.json") not in ability_ids
        ):
            raise BundleReadError("ability_profiles.json: dangling profile")
        _string(profile, "short_description", "ability_profiles.json")
        _string(profile, "description", "ability_profiles.json")
        stable_ability = next(
            item for item in records["abilities.json"] if item["id"] == profile["id"]
        )
        if profile["name"] != stable_ability["name"]:
            raise BundleReadError("ability_profiles.json: identity name mismatch")
    for profile in records["move_profiles.json"]:
        regulation_id = _string(profile, "regulation_id", "move_profiles.json")
        move_id = _string(profile, "id", "move_profiles.json")
        move_type = re.sub(
            r"[^a-z0-9]+", "", _string(profile, "type", "move_profiles.json").lower()
        )
        if (
            regulation_id not in regulation_ids
            or move_id not in move_ids
            or move_type not in type_ids
        ):
            raise BundleReadError(f"move_profiles.json: dangling profile {regulation_id}:{move_id}")
        accuracy = profile.get("accuracy")
        if accuracy != "always" and (not isinstance(accuracy, int) or isinstance(accuracy, bool)):
            raise BundleReadError(f"move_profiles.json:{regulation_id}:{move_id}: invalid accuracy")
        if profile.get("category") not in {"Physical", "Special", "Status"}:
            raise BundleReadError(f"move_profiles.json:{regulation_id}:{move_id}: invalid category")
        for field in ("base_power", "pp", "priority"):
            if not isinstance(profile.get(field), int) or isinstance(profile.get(field), bool):
                raise BundleReadError(
                    f"move_profiles.json:{regulation_id}:{move_id}: invalid {field}"
                )
        if cast(int, profile["base_power"]) < 0 or not 1 <= cast(int, profile["pp"]) <= 20:
            raise BundleReadError(
                f"move_profiles.json:{regulation_id}:{move_id}: invalid power or PP"
            )
        stable_move = next(item for item in records["moves.json"] if item["id"] == move_id)
        if profile["name"] != stable_move["name"]:
            raise BundleReadError("move_profiles.json: identity name mismatch")
    for relation in records["move_flag_relations.json"]:
        regulation_id = _string(relation, "regulation_id", "move_flag_relations.json")
        move_id = _string(relation, "move_id", "move_flag_relations.json")
        flag_id = _string(relation, "flag_id", "move_flag_relations.json")
        if (regulation_id, move_id) not in move_profile_ids or flag_id not in flag_ids:
            raise BundleReadError("move_flag_relations.json: dangling relation")
    for relation in records["learnsets.json"]:
        regulation_id = _string(relation, "regulation_id", "learnsets.json")
        form_id = _string(relation, "form_id", "learnsets.json")
        move_id = _string(relation, "move_id", "learnsets.json")
        if (regulation_id, form_id) not in profile_ids or (
            regulation_id,
            move_id,
        ) not in move_profile_ids:
            raise BundleReadError("learnsets.json: dangling relation")
        if _string(relation, "source_form_id", "learnsets.json") not in form_ids:
            raise BundleReadError("learnsets.json: dangling source form")
    learnset_profiles = {
        (
            _string(item, "regulation_id", "learnsets.json"),
            _string(item, "form_id", "learnsets.json"),
        )
        for item in records["learnsets.json"]
    }
    if learnset_profiles != profile_ids:
        raise BundleReadError("learnsets.json: every effective profile requires a legal move")
    forms_by_id = {_string(item, "id", "forms.json"): item for item in records["forms.json"]}
    for form_id, form in forms_by_id.items():
        base = forms_by_id[_string(form, "base_form_id", f"forms.json:{form_id}")]
        if base.get("is_mega") is not False or (
            base.get("national_dex_number") != form.get("national_dex_number")
        ):
            raise BundleReadError(f"forms.json:{form_id}: invalid base-form identity")
    mega_form_ids: set[str] = set()
    for relation in records["mega_relations.json"]:
        base_id = _string(relation, "base_form_id", "mega_relations.json")
        mega_id = _string(relation, "mega_form_id", "mega_relations.json")
        if (
            base_id == mega_id
            or base_id not in form_ids
            or mega_id not in form_ids
            or forms_by_id[base_id].get("is_mega") is not False
            or forms_by_id[mega_id].get("is_mega") is not True
            or forms_by_id[mega_id].get("base_form_id") != base_id
        ):
            raise BundleReadError(f"mega_relations.json: invalid relation {base_id}:{mega_id}")
        if (
            forms_by_id[base_id]["national_dex_number"]
            != forms_by_id[mega_id]["national_dex_number"]
        ):
            raise BundleReadError(f"mega_relations.json: National Dex mismatch {base_id}:{mega_id}")
        mega_form_ids.add(mega_id)
    expected_mega_ids = {
        form_id for form_id, form in forms_by_id.items() if form.get("is_mega") is True
    }
    if mega_form_ids != expected_mega_ids:
        raise BundleReadError("mega_relations.json: every Mega requires exactly one relation")
    mapping_by_form = {
        _string(item, "form_id", "sprite_mappings.json"): item
        for item in records["sprite_mappings.json"]
    }
    if set(mapping_by_form) != form_ids:
        raise BundleReadError("sprite_mappings.json: every form requires exactly one mapping")
    for form_id, mapping in mapping_by_form.items():
        identifier = _string(mapping, "pokeapi_identifier", "sprite_mappings.json")
        rule = _string(mapping, "mapping_rule", "sprite_mappings.json")
        if rule == "normalized-identifier" and re.sub(r"[^a-z0-9]+", "", identifier) != form_id:
            raise BundleReadError(
                f"sprite_mappings.json:{form_id}: normalized identifier does not match"
            )
    sprite_variants = {
        (_string(item, "form_id", "sprites.json"), _string(item, "variant", "sprites.json"))
        for item in records["sprites.json"]
    }
    if sprite_variants != {
        (form_id, variant) for form_id in form_ids for variant in ("normal", "shiny")
    }:
        raise BundleReadError(
            "sprites.json: every form requires exactly one normal and shiny sprite"
        )
    for sprite in records["sprites.json"]:
        form_id = _string(sprite, "form_id", "sprites.json")
        mapping = mapping_by_form[form_id]
        for field in ("pokeapi_pokemon_id", "pokeapi_identifier", "mapping_rule"):
            if sprite[field] != mapping[field]:
                raise BundleReadError(
                    f"sprites.json:{form_id}: {field} does not match sprite_mappings.json"
                )


def _webp_properties(path: Path, label: str) -> dict[str, object]:
    """Validate the static WebP structure without trusting declared properties."""
    try:
        content = path.read_bytes()
    except OSError as error:
        raise BundleReadError(f"{label}: cannot read WebP: {error}") from error
    if len(content) < 12 or content[:4] != b"RIFF" or content[8:12] != b"WEBP":
        raise BundleReadError(f"{label}: invalid WebP RIFF header")
    if struct.unpack("<I", content[4:8])[0] + 8 != len(content):
        raise BundleReadError(f"{label}: invalid WebP RIFF size")
    position = 12
    chunks: dict[bytes, list[bytes]] = {}
    chunk_order: list[bytes] = []
    while position < len(content):
        if position + 8 > len(content):
            raise BundleReadError(f"{label}: truncated WebP chunk")
        kind = content[position : position + 4]
        length = struct.unpack("<I", content[position + 4 : position + 8])[0]
        start = position + 8
        end = start + length
        if end > len(content):
            raise BundleReadError(f"{label}: truncated WebP {kind!r} chunk")
        chunks.setdefault(kind, []).append(content[start:end])
        chunk_order.append(kind)
        position = end + length % 2
    supported_chunks = {
        b"VP8X",
        b"ALPH",
        b"VP8 ",
        b"VP8L",
        b"ANIM",
        b"ANMF",
        b"ICCP",
        b"EXIF",
        b"XMP ",
    }
    unsupported = set(chunks) - supported_chunks
    if unsupported:
        raise BundleReadError(f"{label}: unsupported WebP chunk {min(unsupported)!r}")
    if position != len(content) or len(chunks.get(b"VP8X", [])) != 1:
        raise BundleReadError(f"{label}: expected exactly one extended WebP header")
    header = chunks[b"VP8X"][0]
    if len(header) != 10:
        raise BundleReadError(f"{label}: invalid WebP extended header")
    flags = header[0]
    if any(header[1:4]) or flags & 0xC1:
        raise BundleReadError(f"{label}: invalid reserved WebP extended-header bits")
    width = int.from_bytes(header[4:7], "little") + 1
    height = int.from_bytes(header[7:10], "little") + 1
    image_kinds = [kind for kind in (b"VP8 ", b"VP8L") if kind in chunks]
    if len(image_kinds) != 1 or len(chunks[image_kinds[0]]) != 1:
        raise BundleReadError(f"{label}: expected exactly one WebP image payload")
    for singleton in (b"ALPH", b"ANIM", b"ICCP", b"EXIF", b"XMP "):
        if len(chunks.get(singleton, [])) > 1:
            raise BundleReadError(f"{label}: duplicate WebP {singleton!r} chunk")
    image_kind = image_kinds[0]
    image_payload = chunks[image_kind][0]
    if chunk_order[0] != b"VP8X":
        raise BundleReadError(f"{label}: WebP extended header must be the first chunk")
    if image_kind == b"VP8 ":
        if len(image_payload) < 10:
            raise BundleReadError(f"{label}: truncated WebP VP8 image payload")
        frame_tag = int.from_bytes(image_payload[:3], "little")
        if frame_tag & 1 or image_payload[3:6] != b"\x9d\x01\x2a":
            raise BundleReadError(f"{label}: invalid WebP VP8 key-frame header")
        if 10 + (frame_tag >> 5) > len(image_payload):
            raise BundleReadError(f"{label}: truncated WebP VP8 first partition")
        image_width = int.from_bytes(image_payload[6:8], "little") & 0x3FFF
        image_height = int.from_bytes(image_payload[8:10], "little") & 0x3FFF
        if chunks.get(b"ALPH") and chunk_order.index(b"ALPH") > chunk_order.index(b"VP8 "):
            raise BundleReadError(f"{label}: WebP alpha chunk must precede the VP8 payload")
        if chunks.get(b"ALPH") and not chunks[b"ALPH"][0]:
            raise BundleReadError(f"{label}: empty WebP alpha payload")
        if chunks.get(b"ALPH") and chunks[b"ALPH"][0][0] & 0xC0:
            raise BundleReadError(f"{label}: invalid WebP alpha header")
        has_alpha = len(chunks.get(b"ALPH", [])) == 1
    else:
        if len(image_payload) < 5 or image_payload[0] != 0x2F:
            raise BundleReadError(f"{label}: invalid WebP VP8L image header")
        packed = int.from_bytes(image_payload[1:5], "little")
        if packed >> 29:
            raise BundleReadError(f"{label}: invalid WebP VP8L version bits")
        image_width = (packed & 0x3FFF) + 1
        image_height = ((packed >> 14) & 0x3FFF) + 1
        has_alpha = bool(packed & (1 << 28))
        if b"ALPH" in chunks:
            raise BundleReadError(f"{label}: VP8L WebP cannot contain an alpha chunk")
    if (width, height) != (image_width, image_height):
        raise BundleReadError(
            f"{label}: VP8X dimensions {width}x{height} do not match image "
            f"dimensions {image_width}x{image_height}"
        )
    if bool(flags & 0x10) != has_alpha:
        raise BundleReadError(f"{label}: WebP alpha flag does not match its image payload")
    return {
        "width": width,
        "height": height,
        "has_alpha": has_alpha,
        "is_animated": bool(flags & 0x02) or b"ANIM" in chunks or b"ANMF" in chunks,
        "has_metadata": bool(flags & 0x2C)
        or any(kind in chunks for kind in (b"ICCP", b"EXIF", b"XMP ")),
    }


def _expected_counts(records: dict[str, list[JsonObject]]) -> dict[str, object]:
    memberships = records["regulation_memberships.json"]
    learnsets = records["learnsets.json"]
    sprites = records["sprites.json"]
    flag_relations = records["move_flag_relations.json"]
    counts: dict[str, object] = {
        "forms": len(records["forms.json"]),
        "types": len(records["types.json"]),
        "memberships": len(memberships),
        "profiles": len(records["profiles.json"]),
        "abilities": len(records["abilities.json"]),
        "ability_profiles": len(records["ability_profiles.json"]),
        "moves": len(records["moves.json"]),
        "move_profiles": len(records["move_profiles.json"]),
        "move_flags": len(records["move_flags.json"]),
        "move_flag_relations": len(flag_relations),
        "learnsets": len(learnsets),
        "mega_relations": len(records["mega_relations.json"]),
        "sprites": len(sprites),
        "sprite_mappings": len(records["sprite_mappings.json"]),
        "sprites_by_variant": dict(
            sorted(Counter(_string(item, "variant", "sprites.json") for item in sprites).items())
        ),
        "sprite_mapping_rules": dict(
            sorted(
                Counter(_string(item, "mapping_rule", "sprites.json") for item in sprites).items()
            )
        ),
        "legal_forms_by_regulation": dict(
            sorted(
                Counter(
                    _string(item, "regulation_id", "regulation_memberships.json")
                    for item in memberships
                ).items()
            )
        ),
        "learnsets_by_regulation": dict(
            sorted(
                Counter(
                    _string(item, "regulation_id", "learnsets.json") for item in learnsets
                ).items()
            )
        ),
        "learnsets_by_form_resolution": dict(
            sorted(
                Counter(
                    _string(item, "form_resolution", "learnsets.json") for item in learnsets
                ).items()
            )
        ),
        "learnsets_by_source_mod": dict(
            sorted(
                Counter(_string(item, "source_mod", "learnsets.json") for item in learnsets).items()
            )
        ),
        "learnsets_by_source_kind": dict(
            sorted(
                Counter(
                    _string(item, "source_kind", "learnsets.json") for item in learnsets
                ).items()
            )
        ),
        "move_flag_usage": dict(
            sorted(
                Counter(
                    _string(item, "flag_id", "move_flag_relations.json") for item in flag_relations
                ).items()
            )
        ),
    }
    if "items.json" in records:
        counts.update(
            {
                "items": len(records["items.json"]),
                "item_profiles": len(records["item_profiles.json"]),
                "natures": len(records["natures.json"]),
                "mega_item_relations": len(records["mega_item_relations.json"]),
            }
        )
        if any("description_source" in record for record in records["item_profiles.json"]):
            counts["item_description_sources_by_regulation"] = {
                regulation_id: dict(sorted(source_counts.items()))
                for regulation_id, source_counts in sorted(
                    {
                        regulation_id: Counter(
                            _string(item, "description_source", "item_profiles.json")
                            for item in records["item_profiles.json"]
                            if _string(item, "regulation_id", "item_profiles.json") == regulation_id
                        )
                        for regulation_id in {
                            _string(item, "regulation_id", "item_profiles.json")
                            for item in records["item_profiles.json"]
                        }
                    }.items()
                )
            }
    if "calculator_capabilities.json" in records:
        counts.update(
            {
                "type_effectiveness": len(records["type_effectiveness.json"]),
                "calculator_capabilities": len(records["calculator_capabilities.json"]),
            }
        )
    return counts


def read_bundle(directory: Path, *, require_pinned: bool = True) -> PokemonDataBundle:
    """Read and fully verify a bundle before any database transaction starts."""
    try:
        directory = directory.resolve(strict=True)
    except OSError as error:
        raise BundleReadError(f"{directory}: bundle path does not exist") from error
    if not directory.is_dir():
        raise BundleReadError(f"{directory}: bundle path is not a directory")
    manifest = _object(_json(directory / "manifest.json"), "manifest.json")
    schema_version = _string(manifest, "bundle_schema_version", "manifest.json")
    source_field = "showdown_sources" if schema_version in MULTI_SCHEMA_VERSIONS else "showdown"
    _exact_keys(
        manifest,
        {
            "bundle_id",
            "bundle_hash",
            "bundle_schema_version",
            "importer_version",
            "source_shape_version",
            source_field,
            "pokeapi_sprites",
            "pokeapi_mapping",
            "formats",
            "mechanics_profile_id",
            "sprite_provenance",
            "overlays",
            "validation_status",
            "validation_sha256",
            "counts",
            "files",
        },
        "manifest.json",
    )
    if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
        raise BundleReadError("manifest.json: unsupported bundle schema version")
    importer_version = _string(manifest, "importer_version", "manifest.json")
    expected_importers = (
        {CALCULATOR_IMPORTER_VERSION}
        if schema_version == CALCULATOR_SCHEMA_VERSION
        else {ITEM_INFO_IMPORTER_VERSION}
        if schema_version == ITEM_INFO_SCHEMA_VERSION
        else (
            {TEAM_IMPORTER_VERSION}
            if schema_version == TEAM_SCHEMA_VERSION
            else (
                {MULTI_IMPORTER_VERSION}
                if schema_version == MULTI_SCHEMA_VERSION
                else SUPPORTED_IMPORTER_VERSIONS
            )
        )
    )
    if importer_version not in expected_importers:
        raise BundleReadError("manifest.json: unsupported importer version")
    expected_source_shape = (
        CALCULATOR_SOURCE_SHAPE_VERSION
        if schema_version == CALCULATOR_SCHEMA_VERSION
        else ITEM_INFO_SOURCE_SHAPE_VERSION
        if schema_version == ITEM_INFO_SCHEMA_VERSION
        else (
            TEAM_SOURCE_SHAPE_VERSION
            if schema_version == TEAM_SCHEMA_VERSION
            else (
                MULTI_SOURCE_SHAPE_VERSION
                if schema_version == MULTI_SCHEMA_VERSION
                else SUPPORTED_SOURCE_SHAPE_VERSION
            )
        )
    )
    if manifest.get("source_shape_version") != expected_source_shape:
        raise BundleReadError("manifest.json: unsupported source shape version")
    for field in ("bundle_hash", "validation_sha256"):
        if HASH_PATTERN.fullmatch(_string(manifest, field, "manifest.json")) is None:
            raise BundleReadError(f"manifest.json: invalid {field}")
    if manifest.get("validation_status") != "valid":
        raise BundleReadError("manifest.json: bundle validation is incomplete")
    file_records = _records(manifest.get("files"), "manifest.json:files")
    for index, record in enumerate(file_records):
        label = f"manifest.json:files[{index}]"
        _exact_keys(record, {"path", "bytes", "sha256"}, label)
        _string(record, "path", label)
        _integer_range(record, "bytes", label, minimum=0, maximum=2**63 - 1)
        if HASH_PATTERN.fullmatch(_string(record, "sha256", label)) is None:
            raise BundleReadError(f"{label}: invalid sha256")
    _validate_unique(file_records, ("path",), "manifest.json:files")
    declared_paths: set[str] = set()
    for record in file_records:
        relative_text = _string(record, "path", "manifest.json:files")
        relative = Path(relative_text)
        if relative.is_absolute() or ".." in relative.parts:
            raise BundleReadError(f"manifest.json: unsafe path {relative_text}")
        path = directory / relative
        try:
            resolved = path.resolve(strict=True)
        except OSError as error:
            raise BundleReadError(f"{path}: declared file is missing") from error
        if directory not in resolved.parents or not resolved.is_file() or path.is_symlink():
            raise BundleReadError(f"manifest.json: unsafe file {relative_text}")
        size = record.get("bytes")
        expected_hash = record.get("sha256")
        if (
            not isinstance(size, int)
            or isinstance(size, bool)
            or size < 0
            or path.stat().st_size != size
        ):
            raise BundleReadError(f"{path}: size does not match manifest")
        if not isinstance(expected_hash, str) or _sha256(path) != expected_hash:
            raise BundleReadError(f"{path}: hash does not match manifest")
        declared_paths.add(relative.as_posix())
    actual_paths = {
        path.relative_to(directory).as_posix()
        for path in directory.rglob("*")
        if path.is_file() and path.name != "manifest.json"
    }
    if actual_paths != declared_paths:
        raise BundleReadError(
            "manifest.json: file inventory does not exactly match bundle contents"
        )
    data_files = (
        CALCULATOR_DATA_FILES
        if schema_version == CALCULATOR_SCHEMA_VERSION
        else TEAM_DATA_FILES
        if schema_version in {TEAM_SCHEMA_VERSION, ITEM_INFO_SCHEMA_VERSION}
        else DATA_FILES
    )
    required_files = frozenset((*data_files, "provenance.json", "validation.json"))
    if not declared_paths >= required_files:
        missing = sorted(required_files - declared_paths)
        raise BundleReadError(f"manifest.json: required files are missing: {', '.join(missing)}")
    bundle_hash = hashlib.sha256(canonical_bytes(file_records)).hexdigest()
    if manifest.get("bundle_hash") != bundle_hash:
        raise BundleReadError("manifest.json: canonical bundle hash mismatch")
    if schema_version in MULTI_SCHEMA_VERSIONS:
        showdown_sources = _records(
            manifest.get("showdown_sources"), "manifest.json:showdown_sources"
        )
        expected_showdown_sources = [
            {
                "revision": EXPECTED_MA_SHOWDOWN_REVISION,
                "commit_date": EXPECTED_MA_COMMIT_DATE,
                "clean_tree": True,
                "regulations": ["m-a"],
            },
            {
                "revision": EXPECTED_SHOWDOWN_REVISION,
                "commit_date": EXPECTED_COMMIT_DATE,
                "clean_tree": True,
                "regulations": ["m-b", "m-c"],
            },
        ]
        if showdown_sources != expected_showdown_sources:
            raise BundleReadError("manifest.json: unexpected Showdown sources")
        revision = "multi"
    else:
        showdown = _object(manifest.get("showdown"), "manifest.json:showdown")
        _exact_keys(
            showdown,
            {"revision", "commit_date", "clean_tree"},
            "manifest.json:showdown",
        )
        revision = _string(showdown, "revision", "manifest.json:showdown")
        if (
            revision != EXPECTED_SHOWDOWN_REVISION
            or showdown.get("commit_date") != EXPECTED_COMMIT_DATE
            or showdown.get("clean_tree") is not True
        ):
            raise BundleReadError("manifest.json: unexpected Showdown revision")
    for field, expected_revision in (
        ("pokeapi_sprites", EXPECTED_SPRITES_REVISION),
        ("pokeapi_mapping", EXPECTED_POKEAPI_REVISION),
    ):
        source = _object(manifest.get(field), f"manifest.json:{field}")
        _exact_keys(source, {"revision", "clean_tree"}, f"manifest.json:{field}")
        if source.get("revision") != expected_revision or source.get("clean_tree") is not True:
            raise BundleReadError(f"manifest.json: unexpected {field} source")
    expected_id = (
        f"showdown-multi-s{schema_version}-i{importer_version}-{bundle_hash[:12]}"
        if schema_version in MULTI_SCHEMA_VERSIONS
        else (f"showdown-{revision[:8]}-s{schema_version}-i{importer_version}-{bundle_hash[:12]}")
    )
    if manifest.get("bundle_id") != expected_id or directory.name != expected_id:
        raise BundleReadError(
            "manifest.json: bundle identifier does not match content or directory"
        )
    validation = _object(_json(directory / "validation.json"), "validation.json")
    _exact_keys(
        validation,
        {
            "status",
            "errors",
            "warnings",
            "overlays",
            "source_counts",
            "counts",
            "ignored_source_categories",
            "coverage",
        },
        "validation.json",
    )
    if validation.get("status") != "valid" or validation.get("errors") != []:
        raise BundleReadError("validation.json: validation did not complete successfully")
    if not isinstance(validation.get("warnings"), list) or any(
        not isinstance(item, str) for item in cast(list[Any], validation.get("warnings"))
    ):
        raise BundleReadError("validation.json: warnings must be an array of strings")
    for field in ("counts", "source_counts", "ignored_source_categories", "coverage"):
        _object(validation.get(field), f"validation.json:{field}")
    if manifest.get("validation_sha256") != _sha256(directory / "validation.json"):
        raise BundleReadError("manifest.json: validation summary hash mismatch")
    provenance = _object(_json(directory / "provenance.json"), "provenance.json")
    provenance_source_field = (
        "showdown_sources" if schema_version in MULTI_SCHEMA_VERSIONS else "showdown"
    )
    provenance_keys = {provenance_source_field, "sprites", "pokeapi_mapping", "overlays"}
    if schema_version in {ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}:
        provenance_keys.add("item_description_sources")
    _exact_keys(provenance, provenance_keys, "provenance.json")
    source_count_keys = {
        "pokedex",
        "base_moves",
        "base_abilities",
        "base_learnsets",
        "champions_format_entries",
        "championsregmb_format_entries",
    }
    if schema_version in {ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}:
        source_count_keys.add("base_item_texts")
    if schema_version in MULTI_SCHEMA_VERSIONS:
        provenance_sources = _records(
            provenance.get("showdown_sources"), "provenance.json:showdown_sources"
        )
        manifest_sources = cast(list[JsonObject], manifest["showdown_sources"])
        if len(provenance_sources) != len(manifest_sources):
            raise BundleReadError("provenance.json: unexpected Showdown sources")
        source_counts: JsonObject = {}
        for index, (source, manifest_source) in enumerate(
            zip(provenance_sources, manifest_sources, strict=True)
        ):
            label = f"provenance.json:showdown_sources[{index}]"
            _exact_keys(
                source,
                {
                    "revision",
                    "commit_date",
                    "clean_tree",
                    "regulations",
                    "source_counts",
                    "notice_path",
                    "notice_sha256",
                },
                label,
            )
            if (
                any(source.get(field) != manifest_source.get(field) for field in manifest_source)
                or source.get("notice_path") != SHOWDOWN_NOTICE_PATH
                or source.get("notice_sha256") != SHOWDOWN_NOTICE_SHA256
            ):
                raise BundleReadError("provenance.json: unexpected Showdown source")
            counts = _object(source.get("source_counts"), f"{label}:source_counts")
            _exact_keys(counts, source_count_keys, f"{label}:source_counts")
            for field in counts:
                _integer_range(
                    counts,
                    field,
                    f"{label}:source_counts",
                    minimum=0,
                    maximum=2**31 - 1,
                )
            regulations = _string_list(source.get("regulations"), f"{label}:regulations", minimum=1)
            source_counts[",".join(regulations)] = counts
    else:
        provenance_showdown = _object(provenance.get("showdown"), "provenance.json:showdown")
        _exact_keys(
            provenance_showdown,
            {
                "revision",
                "commit_date",
                "clean_tree",
                "source_counts",
                "notice_path",
                "notice_sha256",
            },
            "provenance.json:showdown",
        )
        if (
            provenance_showdown.get("revision") != EXPECTED_SHOWDOWN_REVISION
            or provenance_showdown.get("commit_date") != EXPECTED_COMMIT_DATE
            or provenance_showdown.get("clean_tree") is not True
            or provenance_showdown.get("notice_path") != SHOWDOWN_NOTICE_PATH
            or provenance_showdown.get("notice_sha256") != SHOWDOWN_NOTICE_SHA256
        ):
            raise BundleReadError("provenance.json: unexpected Showdown source")
        source_counts = _object(
            provenance_showdown.get("source_counts"),
            "provenance.json:showdown:source_counts",
        )
        _exact_keys(
            source_counts,
            source_count_keys,
            "provenance.json:showdown:source_counts",
        )
        for field in source_counts:
            _integer_range(
                source_counts,
                field,
                "provenance.json:showdown:source_counts",
                minimum=1,
                maximum=2**31 - 1,
            )
    notice = directory / SHOWDOWN_NOTICE_PATH
    if not notice.is_file() or _sha256(notice) != SHOWDOWN_NOTICE_SHA256:
        raise BundleReadError(f"{notice}: pinned Showdown notice is missing or altered")
    sprite_provenance = _object(provenance.get("sprites"), "provenance.json:sprites")
    _exact_keys(
        sprite_provenance,
        {
            "revision",
            "clean_tree",
            "family",
            "mapping_rule_version",
            "mapping_revision",
            "mapping_sha256",
            "cwebp_version",
            "cwebp_args",
            "license",
            "mapping_exceptions",
        },
        "provenance.json:sprites",
    )
    if sprite_provenance != manifest.get("sprite_provenance"):
        raise BundleReadError("manifest.json: sprite provenance does not match provenance.json")
    if (
        sprite_provenance.get("revision") != EXPECTED_SPRITES_REVISION
        or sprite_provenance.get("clean_tree") is not True
        or sprite_provenance.get("family") != "sprites/pokemon/other/home"
        or sprite_provenance.get("mapping_rule_version") != "pokeapi-csv-v1"
        or sprite_provenance.get("mapping_revision") != EXPECTED_POKEAPI_REVISION
        or not isinstance(sprite_provenance.get("mapping_sha256"), str)
        or HASH_PATTERN.fullmatch(cast(str, sprite_provenance["mapping_sha256"])) is None
        or sprite_provenance.get("mapping_sha256") != _sha256(directory / "sprite_mappings.json")
        or sprite_provenance.get("cwebp_version") != EXPECTED_CWEBP_VERSION
        or sprite_provenance.get("cwebp_args") != EXPECTED_CWEBP_ARGS
        or sprite_provenance.get("license") != "license-not-supplied"
        or not isinstance(sprite_provenance.get("mapping_exceptions"), dict)
    ):
        raise BundleReadError("provenance.json: unexpected sprite provenance")
    mapping_exceptions = cast(dict[Any, Any], sprite_provenance["mapping_exceptions"])
    if any(
        not isinstance(key, str)
        or ID_PATTERN.fullmatch(key) is None
        or not isinstance(value, str)
        or re.fullmatch(r"[a-z0-9-]+", value) is None
        for key, value in mapping_exceptions.items()
    ):
        raise BundleReadError("provenance.json: invalid sprite mapping exception")
    mapping_provenance = _object(
        provenance.get("pokeapi_mapping"), "provenance.json:pokeapi_mapping"
    )
    _exact_keys(
        mapping_provenance,
        {"revision", "clean_tree"},
        "provenance.json:pokeapi_mapping",
    )
    if (
        mapping_provenance.get("revision") != EXPECTED_POKEAPI_REVISION
        or mapping_provenance.get("clean_tree") is not True
    ):
        raise BundleReadError("provenance.json: unexpected PokeAPI mapping source")
    overlays = provenance.get("overlays")
    if not isinstance(overlays, list):
        raise BundleReadError("provenance.json: overlays must be an array")
    item_overlay_after: dict[str, JsonObject] = {}
    if schema_version in {ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}:
        if len(overlays) != 1:
            raise BundleReadError("provenance.json: expected one Item text compatibility overlay")
        overlay = _object(overlays[0], "provenance.json:overlays[0]")
        overlay_keys = {
            "id",
            "path",
            "sha256",
            "target_keys",
            "target_revision",
            "text_source_revision",
            "transitions",
        }
        _exact_keys(overlay, overlay_keys, "provenance.json:overlays[0]")
        if (
            overlay.get("id") != "m-a-item-text-compatibility"
            or overlay.get("target_revision") != EXPECTED_MA_SHOWDOWN_REVISION
            or overlay.get("text_source_revision") != EXPECTED_SHOWDOWN_REVISION
        ):
            raise BundleReadError("provenance.json: unexpected Item text overlay source")
        expected_overlay_items = [
            "chimechite",
            "crabominite",
            "glimmoranite",
            "golurkite",
            "meowsticite",
            "scovillainite",
        ]
        if overlay.get("target_keys") != expected_overlay_items:
            raise BundleReadError("provenance.json: unexpected Item text overlay targets")
        overlay_path = Path(_string(overlay, "path", "provenance.json:overlays[0]"))
        if (
            overlay_path.is_absolute()
            or ".." in overlay_path.parts
            or not (directory / overlay_path).is_file()
            or _sha256(directory / overlay_path) != overlay.get("sha256")
        ):
            raise BundleReadError("provenance.json: Item text overlay is missing or altered")
        transitions = _records(
            overlay.get("transitions"), "provenance.json:overlays[0]:transitions"
        )
        if [transition.get("item_id") for transition in transitions] != expected_overlay_items:
            raise BundleReadError("provenance.json: unexpected Item text overlay transitions")
        transition_keys = {
            "authoring_date",
            "fixture_path",
            "fixture_sha256",
            "item_id",
            "rationale",
            "record",
        }
        for index, transition in enumerate(transitions):
            label = f"provenance.json:overlays[0]:transitions[{index}]"
            _exact_keys(transition, transition_keys, label)
            for field in transition_keys:
                _string(transition, field, label)
            if transition["authoring_date"] != "2026-10-24":
                raise BundleReadError(f"{label}: unexpected authoring_date")
            fixture_path = Path(cast(str, transition["fixture_path"]))
            if (
                fixture_path.is_absolute()
                or ".." in fixture_path.parts
                or not (directory / fixture_path).is_file()
                or _sha256(directory / fixture_path) != transition["fixture_sha256"]
            ):
                raise BundleReadError(f"{label}: fixture is missing or altered")
        item_overlay_after = _validate_item_text_overlay(directory, overlay)
    else:
        overlay_keys = {"id", "record", "path", "sha256", "fixture_path", "fixture_sha256"}
        for index, raw_overlay in enumerate(overlays):
            overlay = _object(raw_overlay, f"provenance.json:overlays[{index}]")
            label = f"provenance.json:overlays[{index}]"
            _exact_keys(overlay, overlay_keys, label)
            for field in overlay_keys:
                _string(overlay, field, label)
            for path_field, hash_field in (
                ("path", "sha256"),
                ("fixture_path", "fixture_sha256"),
            ):
                relative = Path(cast(str, overlay[path_field]))
                if relative.is_absolute() or ".." in relative.parts:
                    raise BundleReadError(f"{label}: unsafe {path_field}")
                target = directory / relative
                if not target.is_file() or _sha256(target) != overlay[hash_field]:
                    raise BundleReadError(f"{target}: overlay file is missing or altered")
    records = {name: _records(_json(directory / name), name) for name in data_files}
    _validate_record_shapes(records, schema_version=schema_version)
    for name, values in records.items():
        _validate_unique(values, FILE_KEYS[name], name)
    _validate_relations(records, schema_version=schema_version)
    if schema_version in {ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}:
        m_a_item_profiles = {
            _string(profile, "id", "item_profiles.json"): profile
            for profile in records["item_profiles.json"]
            if profile.get("regulation_id") == "m-a"
        }
        for item_id, after in item_overlay_after.items():
            portable_after = {
                "regulation_id": "m-a",
                **{key: value for key, value in after.items() if key != "mega_stone"},
            }
            if schema_version == CALCULATOR_SCHEMA_VERSION:
                portable_after["contextual_inputs"] = []
            actual_profile = m_a_item_profiles.get(item_id)
            if schema_version == CALCULATOR_SCHEMA_VERSION and actual_profile is not None:
                actual_profile = {
                    key: value for key, value in actual_profile.items() if key != "calculation"
                }
            if actual_profile != portable_after:
                raise BundleReadError(
                    f"item_profiles.json:m-a:{item_id}: does not match overlay transition"
                )
    mappings = {
        _string(item, "form_id", "sprite_mappings.json"): item
        for item in records["sprite_mappings.json"]
    }
    relevant_exceptions = {
        form_id: identifier
        for form_id, identifier in SPRITE_EXCEPTIONS.items()
        if form_id in mappings
    }
    if mapping_exceptions != relevant_exceptions:
        raise BundleReadError(
            "provenance.json: sprite mapping exceptions do not match reviewed set"
        )
    for form_id, mapping in mappings.items():
        identifier = _string(mapping, "pokeapi_identifier", "sprite_mappings.json")
        rule = _string(mapping, "mapping_rule", "sprite_mappings.json")
        expected_exception = mapping_exceptions.get(form_id)
        if rule == "exception" and expected_exception != identifier:
            raise BundleReadError(
                f"sprite_mappings.json:{form_id}: exception is not reviewed in provenance"
            )
        if rule == "normalized-identifier" and expected_exception is not None:
            raise BundleReadError(
                f"sprite_mappings.json:{form_id}: reviewed exception must use exception rule"
            )
    expected_counts = _expected_counts(records)
    if validation.get("counts") != expected_counts or manifest.get("counts") != expected_counts:
        raise BundleReadError("bundle counts do not match normalized records")
    if schema_version in {ITEM_INFO_SCHEMA_VERSION, CALCULATOR_SCHEMA_VERSION}:
        item_description_sources = _object(
            provenance.get("item_description_sources"),
            "provenance.json:item_description_sources",
        )
        if item_description_sources != expected_counts.get(
            "item_description_sources_by_regulation"
        ):
            raise BundleReadError(
                "provenance.json: Item description source counts do not match records"
            )
    if validation.get("source_counts") != source_counts:
        raise BundleReadError("validation.json: source counts do not match provenance")
    if require_pinned:
        contract = PINNED_RELEASE_CONTRACTS.get(cast(str, manifest.get("bundle_id")))
        if contract is None or contract[0] != bundle_hash:
            raise BundleReadError("bundle is not an allowlisted pinned release")
        (
            _,
            pinned_counts,
            pinned_group_counts,
            pinned_mapping_sha256,
            pinned_source_counts,
        ) = contract
        for name, expected in cast(dict[str, object], pinned_counts).items():
            if expected_counts.get(name) != expected:
                raise BundleReadError(
                    f"pinned bundle count {name}: expected {expected}, "
                    f"found {expected_counts.get(name)}"
                )
        if sprite_provenance["mapping_sha256"] != pinned_mapping_sha256:
            raise BundleReadError("provenance.json: unexpected pinned sprite mapping hash")
        for name, group_expected in pinned_group_counts.items():
            if expected_counts.get(name) != group_expected:
                raise BundleReadError(f"pinned bundle count {name} changed")
        expected_source_counts = pinned_source_counts or EXPECTED_SOURCE_COUNTS
        if source_counts != expected_source_counts:
            raise BundleReadError("pinned Showdown source counts changed")
    if manifest.get("formats") != records["regulations.json"]:
        raise BundleReadError("manifest.json: formats do not match regulations.json")
    if manifest.get("mechanics_profile_id") != "champions-level-50-v1":
        raise BundleReadError("manifest.json: unsupported mechanics profile")
    if manifest.get("overlays") != overlays or validation.get("overlays") != overlays:
        raise BundleReadError("bundle overlay declarations do not match provenance")
    for sprite in records["sprites.json"]:
        relative_text = _string(sprite, "path", "sprites.json")
        relative = Path(relative_text)
        path = directory / relative
        if (
            relative.is_absolute()
            or ".." in relative.parts
            or relative.suffix != ".webp"
            or relative_text not in declared_paths
        ):
            raise BundleReadError(f"sprites.json: unsafe or undeclared path {relative_text}")
        if _string(sprite, "sha256", "sprites.json") != _sha256(path):
            raise BundleReadError(f"{path}: sprite record hash mismatch")
        properties = _webp_properties(path, f"sprites.json:{sprite['form_id']}:{sprite['variant']}")
        expected_properties = {
            "width": 384,
            "height": 384,
            "has_alpha": True,
            "is_animated": False,
            "has_metadata": False,
        }
        if properties != expected_properties:
            raise BundleReadError(
                f"sprites.json:{sprite['form_id']}:{sprite['variant']}: "
                f"unexpected WebP properties {properties}"
            )
    inventory = {
        name: {
            _key(record, FILE_KEYS[name], name): hashlib.sha256(canonical_bytes(record)).hexdigest()
            for record in values
        }
        for name, values in records.items()
    }
    overlays = manifest.get("overlays")
    if not isinstance(overlays, list):
        raise BundleReadError("manifest.json: overlays must be an array")
    inventory["overlays"] = {
        str(index): hashlib.sha256(canonical_bytes(value)).hexdigest()
        for index, value in enumerate(overlays)
    }
    return PokemonDataBundle(directory, manifest, provenance, validation, records, inventory)

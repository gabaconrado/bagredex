"""Read-only selectors and serializers for the regulation-aware Pokédex."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any

from django.db.models import QuerySet
from django.urls import reverse

from .pokemon_data.models import (
    ActiveDataVersion,
    DataVersion,
    LearnsetEntry,
    MegaRelation,
    MoveFlagRelation,
    PokemonProfile,
    PokemonProfileAbility,
    PokemonProfileType,
    Regulation,
    RegulationMembership,
    Sprite,
)
from .pokemon_data.stats import level_50_stat

REGULATION_IDS = ("m-c", "m-b")
CANONICAL_ID = re.compile(r"^[a-z0-9]+$")
INDEX_SCHEMA = "pokedex-index-v1"
DETAIL_SCHEMA = "pokedex-form-detail-v1"
BOOTSTRAP_SCHEMA = "pokedex-bootstrap-v1"


class PokedexUnavailable(RuntimeError):
    """The requested canonical data snapshot cannot be served."""


@dataclass(frozen=True)
class Snapshot:
    """One active immutable data version and regulation."""

    version: DataVersion
    regulation: Regulation


def active_version() -> DataVersion | None:
    """Return the loaded active version, if the singleton points to one."""
    pointer = ActiveDataVersion.objects.select_related("version").filter(singleton_key=1).first()
    if pointer is None or pointer.version is None:
        return None
    if pointer.version.status != DataVersion.Status.LOADED:
        return None
    return pointer.version


def snapshot_for(version: DataVersion, regulation_id: str) -> Snapshot | None:
    """Resolve an allow-listed regulation inside an already-resolved version."""
    if regulation_id not in REGULATION_IDS:
        return None
    regulation = (
        Regulation.objects.select_related("mechanics_profile")
        .filter(version=version, canonical_id=regulation_id)
        .first()
    )
    return Snapshot(version, regulation) if regulation is not None else None


def _validate_mechanics(snapshot: Snapshot) -> None:
    """Fail closed unless the active profile matches the exact arithmetic helper."""
    mechanics = snapshot.regulation.mechanics_profile
    if (
        mechanics.level != 50
        or mechanics.sp_minimum != 0
        or mechanics.sp_maximum != 32
        or mechanics.hp_formula != "base + sp + 75"
        or mechanics.other_formula != "truncate((base + sp + 20) * nature_percent / 100)"
        or mechanics.nature_percentages != {"hindering": 90, "neutral": 100, "increasing": 110}
    ):
        raise PokedexUnavailable("The active regulation has unsupported stat mechanics.")


def bootstrap(version: DataVersion, selected: Regulation) -> dict[str, Any]:
    """Build JSON-safe page configuration from regulations in one version."""
    available = {
        regulation.canonical_id: regulation
        for regulation in Regulation.objects.filter(
            version=version, canonical_id__in=REGULATION_IDS
        )
    }
    regulations = [
        {
            "id": canonical_id,
            "name": available[canonical_id].name,
            "url": f"{reverse('home')}?regulation={canonical_id}",
        }
        for canonical_id in REGULATION_IDS
        if canonical_id in available
    ]
    version_id = version.pk
    return {
        "schema_version": BOOTSTRAP_SCHEMA,
        "active_version": version_id,
        "regulation": {"id": selected.canonical_id, "name": selected.name},
        "regulations": regulations,
        "index_url": (
            f"{reverse('pokedex-index', kwargs={'regulation': selected.canonical_id})}"
            f"?version={version_id}"
        ),
        "detail_url_template": (
            reverse(
                "pokedex-form-detail",
                kwargs={"regulation": selected.canonical_id, "form": "__FORM__"},
            )
            + f"?version={version_id}"
        ),
    }


def _profile_rows(snapshot: Snapshot) -> QuerySet[PokemonProfile]:
    return PokemonProfile.objects.filter(
        regulation=snapshot.regulation, membership__isnull=False
    ).select_related("form")


def regulation_index(snapshot: Snapshot) -> dict[str, Any]:
    """Serialize all browser-local filtering data using fixed-count queries."""
    profiles = list(
        _profile_rows(snapshot).order_by("form__national_dex_number", "form__canonical_id")
    )
    profile_ids = [profile.pk for profile in profiles]
    types_by_profile: dict[Any, list[dict[str, str]]] = {}
    referenced_types: dict[str, str] = {}
    for type_row in (
        PokemonProfileType.objects.filter(profile_id__in=profile_ids)
        .values("profile_id", "position", "type__canonical_id", "type__name")
        .order_by("profile_id", "position")
    ):
        item = {"id": type_row["type__canonical_id"], "name": type_row["type__name"]}
        types_by_profile.setdefault(type_row["profile_id"], []).append(item)
        referenced_types[item["id"]] = item["name"]

    abilities_by_profile: dict[Any, list[str]] = {}
    referenced_abilities: dict[str, str] = {}
    for ability_row in (
        PokemonProfileAbility.objects.filter(profile_id__in=profile_ids)
        .values(
            "profile_id",
            "slot",
            "ability_profile__ability__canonical_id",
            "ability_profile__ability__name",
        )
        .order_by("profile_id", "slot")
    ):
        ability_id = ability_row["ability_profile__ability__canonical_id"]
        abilities_by_profile.setdefault(ability_row["profile_id"], []).append(ability_id)
        referenced_abilities[ability_id] = ability_row["ability_profile__ability__name"]

    moves_by_profile: dict[Any, list[tuple[str, str]]] = {}
    referenced_moves: dict[str, str] = {}
    for move_row in LearnsetEntry.objects.filter(profile_id__in=profile_ids).values(
        "profile_id", "move_profile__move__canonical_id", "move_profile__move__name"
    ):
        move_id = move_row["move_profile__move__canonical_id"]
        move_name = move_row["move_profile__move__name"]
        moves_by_profile.setdefault(move_row["profile_id"], []).append((move_id, move_name))
        referenced_moves[move_id] = move_name
    for profile_moves in moves_by_profile.values():
        profile_moves.sort(key=lambda pair: (pair[1].casefold(), pair[0]))

    forms = []
    for profile in profiles:
        forms.append(
            {
                "id": profile.form.canonical_id,
                "name": profile.form.name,
                "national_dex_number": profile.form.national_dex_number,
                "is_mega": profile.form.is_mega,
                "types": types_by_profile.get(profile.pk, []),
                "stats": {
                    "hp": profile.hp,
                    "atk": profile.attack,
                    "def": profile.defense,
                    "spa": profile.special_attack,
                    "spd": profile.special_defense,
                    "spe": profile.speed,
                },
                "bst": profile.bst,
                "ability_ids": abilities_by_profile.get(profile.pk, []),
                "move_ids": [move_id for move_id, _ in moves_by_profile.get(profile.pk, [])],
            }
        )

    def named(values: dict[str, str]) -> list[dict[str, str]]:
        return [
            {"id": identifier, "name": name}
            for identifier, name in sorted(
                values.items(), key=lambda pair: (pair[1].casefold(), pair[0])
            )
        ]

    return {
        "schema_version": INDEX_SCHEMA,
        "data_version": snapshot.version.pk,
        "regulation": {"id": snapshot.regulation.canonical_id, "name": snapshot.regulation.name},
        "forms": forms,
        "moves": named(referenced_moves),
        "abilities": named(referenced_abilities),
        "types": named(referenced_types),
    }


def _stat_values(stat_id: str, name: str, base: int) -> dict[str, Any]:
    is_hp = stat_id == "hp"
    return {
        "id": stat_id,
        "name": name,
        "base": base,
        "real": level_50_stat(base=base, sp=0, hp=is_hp),
        "minimum": level_50_stat(base=base, sp=0, hp=is_hp, nature="hindering"),
        "maximum": level_50_stat(base=base, sp=32, hp=is_hp, nature="increasing"),
    }


def form_detail(snapshot: Snapshot, form_id: str) -> dict[str, Any] | None:
    """Serialize one legal or toggle-supporting effective form."""
    _validate_mechanics(snapshot)
    profile = (
        PokemonProfile.objects.select_related("form", "form__base_form")
        .filter(regulation=snapshot.regulation, form__canonical_id=form_id)
        .first()
    )
    if profile is None:
        return None
    is_list_legal = RegulationMembership.objects.filter(profile=profile).exists()
    types = [
        {"id": row.type.canonical_id, "name": row.type.name}
        for row in PokemonProfileType.objects.filter(profile=profile)
        .select_related("type")
        .order_by("position")
    ]
    abilities = [
        {
            "id": row.ability_profile.ability.canonical_id,
            "name": row.ability_profile.ability.name,
            "slot": row.slot,
            "short_description": row.ability_profile.short_description,
            "description": row.ability_profile.description,
        }
        for row in PokemonProfileAbility.objects.filter(profile=profile)
        .select_related("ability_profile__ability")
        .order_by("slot")
    ]
    entries = list(
        LearnsetEntry.objects.filter(profile=profile).select_related(
            "move_profile__move", "move_profile__type"
        )
    )
    entries.sort(
        key=lambda entry: (
            entry.move_profile.move.name.casefold(),
            entry.move_profile.move.canonical_id,
        )
    )
    move_profile_ids = [entry.move_profile_id for entry in entries]
    flags_by_move: dict[Any, list[str]] = {}
    for flag_row in (
        MoveFlagRelation.objects.filter(move_profile_id__in=move_profile_ids)
        .values("move_profile_id", "flag__canonical_id")
        .order_by("move_profile_id", "flag__canonical_id")
    ):
        flags_by_move.setdefault(flag_row["move_profile_id"], []).append(
            flag_row["flag__canonical_id"]
        )
    moves = []
    for entry in entries:
        move = entry.move_profile
        moves.append(
            {
                "id": move.move.canonical_id,
                "name": move.move.name,
                "type": {"id": move.type.canonical_id, "name": move.type.name},
                "category": move.category,
                "base_power": move.base_power,
                "accuracy": move.accuracy,
                "always_hits": move.always_hits,
                "pp": move.pp,
                "priority": move.priority,
                "target": move.target,
                "short_description": move.short_description,
                "description": move.description,
                "flags": flags_by_move.get(move.pk, []),
            }
        )
    sprite_variants = {
        sprite.variant: reverse(
            "pokedex-sprite",
            kwargs={
                "version": snapshot.version.pk,
                "form": profile.form.canonical_id,
                "variant": sprite.variant,
            },
        )
        for sprite in Sprite.objects.filter(mapping__form=profile.form)
    }
    base_form = profile.form.base_form
    mega_rows = (
        MegaRelation.objects.filter(version=snapshot.version, base_form=base_form)
        .select_related("mega_form")
        .filter(mega_form__pokemonprofile__regulation=snapshot.regulation)
        .order_by("mega_form__canonical_id")
    )
    stat_fields = (
        ("hp", "HP", profile.hp),
        ("atk", "Attack", profile.attack),
        ("def", "Defense", profile.defense),
        ("spa", "Special Attack", profile.special_attack),
        ("spd", "Special Defense", profile.special_defense),
        ("spe", "Speed", profile.speed),
    )
    return {
        "schema_version": DETAIL_SCHEMA,
        "data_version": snapshot.version.pk,
        "regulation_id": snapshot.regulation.canonical_id,
        "form": {
            "id": profile.form.canonical_id,
            "name": profile.form.name,
            "is_list_legal": is_list_legal,
            "is_mega": profile.form.is_mega,
            "types": types,
            "sprites": sprite_variants,
            "form_switches": {
                "base": {"id": base_form.canonical_id, "name": base_form.name},
                "megas": [
                    {"id": relation.mega_form.canonical_id, "name": relation.mega_form.name}
                    for relation in mega_rows
                ],
            },
            "stats": [_stat_values(*stat) for stat in stat_fields],
            "abilities": abilities,
            "moves": moves,
        },
    }


def response_etag(*parts: str) -> str:
    """Return a deterministic strong ETag for immutable logical response identity."""
    encoded = json.dumps(parts, ensure_ascii=True, separators=(",", ":")).encode()
    return f'"{hashlib.sha256(encoded).hexdigest()}"'

"""Read-only retained builder dataset serialization."""

from __future__ import annotations

from typing import Any

from django.urls import reverse

from bagredex.pokedex import Snapshot
from bagredex.pokemon_data.form_groups import pokemon_search_entries
from bagredex.pokemon_data.models import (
    ItemProfile,
    LearnsetEntry,
    MegaItemRelation,
    MoveFlagRelation,
    Nature,
    PokemonProfile,
    PokemonProfileAbility,
    PokemonProfileType,
)

from .services import DATA_SCHEMA, mechanics_supported


def builder_dataset(snapshot: Snapshot) -> dict[str, Any]:
    """Return all browser-local choices for one exact retained snapshot."""
    mechanics = snapshot.regulation.mechanics_profile
    if not mechanics_supported(snapshot.regulation):
        raise ValueError("Team building requires supported Champions mechanics.")
    profiles = list(
        PokemonProfile.objects.filter(
            regulation=snapshot.regulation,
            membership__isnull=False,
            form__is_mega=False,
        )
        .select_related("form__base_form")
        .order_by("form__national_dex_number", "form__canonical_id")
    )
    profile_ids = [profile.pk for profile in profiles]
    legal_form_ids = {profile.form_id for profile in profiles}
    types: dict[Any, list[str]] = {}
    type_names: dict[str, str] = {}
    for type_row in (
        PokemonProfileType.objects.filter(profile_id__in=profile_ids)
        .values("profile_id", "position", "type__canonical_id", "type__name")
        .order_by("profile_id", "position")
    ):
        type_id = type_row["type__canonical_id"]
        types.setdefault(type_row["profile_id"], []).append(type_id)
        type_names[type_id] = type_row["type__name"]
    abilities: dict[Any, list[str]] = {}
    ability_records: dict[str, dict[str, Any]] = {}
    for ability_row in PokemonProfileAbility.objects.filter(profile_id__in=profile_ids).values(
        "profile_id",
        "ability_profile__ability__canonical_id",
        "ability_profile__ability__name",
        "ability_profile__short_description",
        "ability_profile__description",
        "ability_profile__suppresses_held_item",
    ):
        ability_id = ability_row["ability_profile__ability__canonical_id"]
        abilities.setdefault(ability_row["profile_id"], []).append(ability_id)
        ability_records[ability_id] = {
            "id": ability_id,
            "name": ability_row["ability_profile__ability__name"],
            "short_description": ability_row["ability_profile__short_description"],
            "description": ability_row["ability_profile__description"],
            "suppresses_held_item": ability_row["ability_profile__suppresses_held_item"],
        }
    moves: dict[Any, list[str]] = {}
    move_records: dict[str, dict[str, Any]] = {}
    move_profile_ids: dict[Any, str] = {}
    for move_row in LearnsetEntry.objects.filter(profile_id__in=profile_ids).values(
        "profile_id",
        "move_profile_id",
        "move_profile__move__canonical_id",
        "move_profile__move__name",
        "move_profile__type__canonical_id",
        "move_profile__type__name",
        "move_profile__category",
        "move_profile__base_power",
        "move_profile__accuracy",
        "move_profile__always_hits",
        "move_profile__pp",
        "move_profile__priority",
        "move_profile__target",
        "move_profile__short_description",
        "move_profile__description",
    ):
        move_id = move_row["move_profile__move__canonical_id"]
        moves.setdefault(move_row["profile_id"], []).append(move_id)
        move_profile_ids[move_row["move_profile_id"]] = move_id
        move_records[move_id] = {
            "id": move_id,
            "name": move_row["move_profile__move__name"],
            "type": {
                "id": move_row["move_profile__type__canonical_id"],
                "name": move_row["move_profile__type__name"],
            },
            "category": move_row["move_profile__category"],
            "base_power": move_row["move_profile__base_power"],
            "accuracy": move_row["move_profile__accuracy"],
            "always_hits": move_row["move_profile__always_hits"],
            "pp": move_row["move_profile__pp"],
            "priority": move_row["move_profile__priority"],
            "target": move_row["move_profile__target"],
            "short_description": move_row["move_profile__short_description"],
            "description": move_row["move_profile__description"],
            "flags": [],
        }
    for flag_row in (
        MoveFlagRelation.objects.filter(move_profile_id__in=move_profile_ids)
        .values("move_profile_id", "flag__canonical_id")
        .order_by("move_profile_id", "flag__canonical_id")
    ):
        move_records[move_profile_ids[flag_row["move_profile_id"]]]["flags"].append(
            flag_row["flag__canonical_id"]
        )

    mega_rows = list(
        MegaItemRelation.objects.filter(
            regulation=snapshot.regulation,
            base_form_id__in=legal_form_ids,
        )
        .select_related("item_profile__item", "base_form", "mega_form")
        .order_by("base_form__canonical_id", "item_profile__item__canonical_id")
    )
    mega_profile_ids = [row.mega_form_id for row in mega_rows]
    mega_profiles = {
        profile.form_id: profile
        for profile in PokemonProfile.objects.filter(
            regulation=snapshot.regulation, form_id__in=mega_profile_ids
        ).select_related("form")
    }
    mega_abilities: dict[Any, list[str]] = {}
    for mega_ability_row in PokemonProfileAbility.objects.filter(
        profile__regulation=snapshot.regulation, profile__form_id__in=mega_profile_ids
    ).values(
        "profile__form_id",
        "ability_profile__ability__canonical_id",
        "ability_profile__ability__name",
        "ability_profile__short_description",
        "ability_profile__description",
        "ability_profile__suppresses_held_item",
    ):
        ability_id = mega_ability_row["ability_profile__ability__canonical_id"]
        mega_abilities.setdefault(mega_ability_row["profile__form_id"], []).append(ability_id)
        ability_records[ability_id] = {
            "id": ability_id,
            "name": mega_ability_row["ability_profile__ability__name"],
            "short_description": mega_ability_row["ability_profile__short_description"],
            "description": mega_ability_row["ability_profile__description"],
            "suppresses_held_item": mega_ability_row["ability_profile__suppresses_held_item"],
        }
    mega_types: dict[Any, list[str]] = {}
    for mega_type_row in (
        PokemonProfileType.objects.filter(
            profile__regulation=snapshot.regulation, profile__form_id__in=mega_profile_ids
        )
        .values("profile__form_id", "position", "type__canonical_id", "type__name")
        .order_by("profile__form_id", "position")
    ):
        type_id = mega_type_row["type__canonical_id"]
        mega_types.setdefault(mega_type_row["profile__form_id"], []).append(type_id)
        type_names[type_id] = mega_type_row["type__name"]
    mega_moves: dict[Any, list[str]] = {}
    for mega_move_row in LearnsetEntry.objects.filter(
        profile__regulation=snapshot.regulation, profile__form_id__in=mega_profile_ids
    ).values(
        "profile__form_id",
        "move_profile_id",
        "move_profile__move__canonical_id",
        "move_profile__move__name",
        "move_profile__type__canonical_id",
        "move_profile__type__name",
        "move_profile__category",
        "move_profile__base_power",
        "move_profile__accuracy",
        "move_profile__always_hits",
        "move_profile__pp",
        "move_profile__priority",
        "move_profile__target",
        "move_profile__short_description",
        "move_profile__description",
    ):
        move_id = mega_move_row["move_profile__move__canonical_id"]
        mega_moves.setdefault(mega_move_row["profile__form_id"], []).append(move_id)
        move_profile_ids[mega_move_row["move_profile_id"]] = move_id
        move_records[move_id] = {
            "id": move_id,
            "name": mega_move_row["move_profile__move__name"],
            "type": {
                "id": mega_move_row["move_profile__type__canonical_id"],
                "name": mega_move_row["move_profile__type__name"],
            },
            "category": mega_move_row["move_profile__category"],
            "base_power": mega_move_row["move_profile__base_power"],
            "accuracy": mega_move_row["move_profile__accuracy"],
            "always_hits": mega_move_row["move_profile__always_hits"],
            "pp": mega_move_row["move_profile__pp"],
            "priority": mega_move_row["move_profile__priority"],
            "target": mega_move_row["move_profile__target"],
            "short_description": mega_move_row["move_profile__short_description"],
            "description": mega_move_row["move_profile__description"],
            "flags": [],
        }
    for flag_row in (
        MoveFlagRelation.objects.filter(move_profile_id__in=move_profile_ids)
        .values("move_profile_id", "flag__canonical_id")
        .order_by("move_profile_id", "flag__canonical_id")
    ):
        flags = move_records[move_profile_ids[flag_row["move_profile_id"]]]["flags"]
        flag_id = flag_row["flag__canonical_id"]
        if flag_id not in flags:
            flags.append(flag_id)

    def named(values: dict[str, str]) -> list[dict[str, str]]:
        return [
            {"id": identifier, "name": name}
            for identifier, name in sorted(
                values.items(), key=lambda pair: (pair[1].casefold(), pair[0])
            )
        ]

    forms = [
        {
            "id": profile.form.canonical_id,
            "name": profile.form.name,
            "base_species": profile.form.base_form.canonical_id,
            "national_dex_number": profile.form.national_dex_number,
            "type_ids": types.get(profile.pk, []),
            "ability_ids": sorted(abilities.get(profile.pk, [])),
            "move_ids": sorted(moves.get(profile.pk, [])),
            "base_stats": {
                "hp": profile.hp,
                "attack": profile.attack,
                "defense": profile.defense,
                "special_attack": profile.special_attack,
                "special_defense": profile.special_defense,
                "speed": profile.speed,
            },
            "sprite_form": profile.form.canonical_id,
            "is_nfe": profile.form.is_nfe,
        }
        for profile in profiles
    ]
    item_profiles = ItemProfile.objects.filter(regulation=snapshot.regulation).select_related(
        "item"
    )
    nature_rows = Nature.objects.filter(version=snapshot.version).filter(
        increased_stat__isnull=False
    ) | Nature.objects.filter(version=snapshot.version, canonical_id="serious")
    return {
        "schema_version": DATA_SCHEMA,
        "data_version": snapshot.version.pk,
        "regulation": {"id": snapshot.regulation.canonical_id, "name": snapshot.regulation.name},
        "forms": forms,
        "pokemon_search_entries": pokemon_search_entries(
            (profile.form.canonical_id, profile.form.name) for profile in profiles
        ),
        "types": named(type_names),
        "abilities": sorted(
            ability_records.values(), key=lambda value: (value["name"].casefold(), value["id"])
        ),
        "moves": sorted(
            move_records.values(), key=lambda value: (value["name"].casefold(), value["id"])
        ),
        "items": [
            {
                "id": profile.item.canonical_id,
                "name": profile.item.name,
                "short_description": profile.short_description,
                "description": profile.description,
                "stat_modifiers": profile.stat_modifiers,
            }
            for profile in sorted(
                item_profiles,
                key=lambda value: (value.item.name.casefold(), value.item.canonical_id),
            )
        ],
        "natures": [
            {
                "id": nature.canonical_id,
                "name": nature.name,
                "increased_stat": nature.increased_stat,
                "decreased_stat": nature.decreased_stat,
            }
            for nature in sorted(
                nature_rows, key=lambda value: (value.name.casefold(), value.canonical_id)
            )
        ],
        "mechanics": {
            "level": mechanics.level,
            "sp_minimum": mechanics.sp_minimum,
            "sp_maximum": mechanics.sp_maximum,
            "sp_total_max": mechanics.sp_total_max,
            "hp_formula": mechanics.hp_formula,
            "other_formula": mechanics.other_formula,
            "nature_percentages": mechanics.nature_percentages,
        },
        "mega_relations": [
            {
                "base_form": row.base_form.canonical_id,
                "item": row.item_profile.item.canonical_id,
                "target": {
                    "id": row.mega_form.canonical_id,
                    "name": row.mega_form.name,
                    "sprite_form": row.mega_form.canonical_id,
                    "is_nfe": row.mega_form.is_nfe,
                    "ability_ids": sorted(mega_abilities.get(row.mega_form_id, [])),
                    "base_stats": {
                        "hp": mega_profiles[row.mega_form_id].hp,
                        "attack": mega_profiles[row.mega_form_id].attack,
                        "defense": mega_profiles[row.mega_form_id].defense,
                        "special_attack": mega_profiles[row.mega_form_id].special_attack,
                        "special_defense": mega_profiles[row.mega_form_id].special_defense,
                        "speed": mega_profiles[row.mega_form_id].speed,
                    },
                },
            }
            for row in mega_rows
            if row.mega_form_id in mega_profiles
        ],
        "mega_search_entries": [
            {
                "id": row.mega_form.canonical_id,
                "name": row.mega_form.name,
                "base_form_id": row.base_form.canonical_id,
                "item_id": row.item_profile.item.canonical_id,
                "sprite_form": row.mega_form.canonical_id,
                "is_nfe": row.mega_form.is_nfe,
                "type_ids": mega_types.get(row.mega_form_id, []),
                "ability_ids": sorted(mega_abilities.get(row.mega_form_id, [])),
                "move_ids": sorted(mega_moves.get(row.mega_form_id, [])),
                "base_stats": {
                    "hp": mega_profiles[row.mega_form_id].hp,
                    "attack": mega_profiles[row.mega_form_id].attack,
                    "defense": mega_profiles[row.mega_form_id].defense,
                    "special_attack": mega_profiles[row.mega_form_id].special_attack,
                    "special_defense": mega_profiles[row.mega_form_id].special_defense,
                    "speed": mega_profiles[row.mega_form_id].speed,
                },
            }
            for row in mega_rows
            if row.mega_form_id in mega_profiles
        ],
        "sprite_url_template": reverse(
            "pokedex-sprite",
            kwargs={"version": snapshot.version.pk, "form": "__FORM__", "variant": "__VARIANT__"},
        ),
    }

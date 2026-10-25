"""Serialize an exact active Damage Calculator dataset."""

from __future__ import annotations

from typing import Any

from django.urls import reverse

from bagredex.pokedex import Snapshot
from bagredex.pokemon_data.models import (
    AbilityProfile,
    CalculatorCapability,
    ItemProfile,
    LearnsetEntry,
    MegaItemRelation,
    MoveFlagRelation,
    MoveProfile,
    Nature,
    PokemonForm,
    PokemonProfile,
    PokemonProfileAbility,
    PokemonProfileType,
    Type,
    TypeEffectiveness,
)

DATA_SCHEMA = "damage-calculator-data-v2"
CAPABILITY_ID = "damage-calculator-v1"

_ABILITY_SLOT_ORDER = {"0": 0, "1": 1, "H": 2, "S": 3}


class DamageCalculatorUnavailable(RuntimeError):
    """The normalized snapshot cannot satisfy the calculator contract."""


def _capability(snapshot: Snapshot) -> CalculatorCapability:
    capability = CalculatorCapability.objects.filter(
        version=snapshot.version,
        canonical_id=CAPABILITY_ID,
    ).first()
    if capability is None:
        raise DamageCalculatorUnavailable(
            "The active Pokémon data does not support damage calculation."
        )
    return capability


def calculator_supported(snapshot: Snapshot) -> bool:
    """Return whether this exact snapshot advertises the calculator contract."""
    return CalculatorCapability.objects.filter(
        version=snapshot.version,
        canonical_id=CAPABILITY_ID,
    ).exists()


def _stats(profile: PokemonProfile) -> dict[str, int]:
    return {
        "hp": profile.hp,
        "atk": profile.attack,
        "def": profile.defense,
        "spa": profile.special_attack,
        "spd": profile.special_defense,
        "spe": profile.speed,
    }


def _gender_fields(form: PokemonForm) -> dict[str, str | list[str]]:
    expected_options = ["M", "F"] if form.gender == "variable" else [form.gender]
    if (
        form.gender not in {"M", "F", "N", "variable"}
        or form.gender_options != expected_options
        or form.default_gender not in expected_options
    ):
        raise DamageCalculatorUnavailable("A Pokémon gender contract is invalid.")
    return {
        "gender": form.gender,
        "gender_options": form.gender_options,
        "default_gender": form.default_gender,
    }


def _move_description(profile: MoveProfile) -> str:
    description = profile.description
    if not description.strip():
        raise DamageCalculatorUnavailable("A move description is unavailable.")
    return description


def damage_calculator_dataset(snapshot: Snapshot) -> dict[str, Any]:
    """Return normalized game facts for browser-local damage calculation."""
    capability = _capability(snapshot)
    mechanics = snapshot.regulation.mechanics_profile

    mega_rows = list(
        MegaItemRelation.objects.filter(regulation=snapshot.regulation)
        .select_related("item_profile__item", "base_form", "mega_form")
        .order_by("base_form__canonical_id", "item_profile__item__canonical_id")
    )
    mega_form_ids = {mega_relation.mega_form.pk for mega_relation in mega_rows}
    profiles = list(
        PokemonProfile.objects.filter(
            regulation=snapshot.regulation,
            membership__isnull=False,
        )
        .select_related("form")
        .order_by("form__national_dex_number", "form__canonical_id")
    )
    searchable_profile_ids = {profile.pk for profile in profiles}
    existing_form_ids = {profile.form.pk for profile in profiles}
    if mega_form_ids - existing_form_ids:
        profiles.extend(
            PokemonProfile.objects.filter(
                regulation=snapshot.regulation,
                form_id__in=mega_form_ids - existing_form_ids,
            )
            .select_related("form")
            .order_by("form__national_dex_number", "form__canonical_id")
        )
    profiles.sort(key=lambda value: (value.form.national_dex_number, value.form.canonical_id))
    profile_ids = [profile.pk for profile in profiles]

    types_by_profile: dict[Any, list[str]] = {}
    for type_relation in (
        PokemonProfileType.objects.filter(profile_id__in=profile_ids)
        .values("profile_id", "position", "type__canonical_id")
        .order_by("profile_id", "position")
    ):
        types_by_profile.setdefault(type_relation["profile_id"], []).append(
            type_relation["type__canonical_id"]
        )

    abilities_by_profile: dict[Any, list[dict[str, str]]] = {}
    for ability_relation in PokemonProfileAbility.objects.filter(profile_id__in=profile_ids).values(
        "profile_id", "slot", "ability_profile__ability__canonical_id"
    ):
        if ability_relation["slot"] not in _ABILITY_SLOT_ORDER:
            raise DamageCalculatorUnavailable("A Pokémon ability slot is unsupported.")
        abilities_by_profile.setdefault(ability_relation["profile_id"], []).append(
            {
                "id": ability_relation["ability_profile__ability__canonical_id"],
                "slot": ability_relation["slot"],
            }
        )
    for abilities in abilities_by_profile.values():
        abilities.sort(key=lambda value: (_ABILITY_SLOT_ORDER[value["slot"]], value["id"]))

    moves_by_profile: dict[Any, list[str]] = {}
    for learnset_relation in LearnsetEntry.objects.filter(profile_id__in=profile_ids).values(
        "profile_id", "move_profile__move__canonical_id"
    ):
        moves_by_profile.setdefault(learnset_relation["profile_id"], []).append(
            learnset_relation["move_profile__move__canonical_id"]
        )
    for moves in moves_by_profile.values():
        moves.sort()

    forms = []
    for profile in profiles:
        if profile.weight_tenths_kg is None:
            raise DamageCalculatorUnavailable("A Pokémon calculation weight is unavailable.")
        forms.append(
            {
                "id": profile.form.canonical_id,
                "name": profile.form.name,
                "searchable": profile.pk in searchable_profile_ids and not profile.form.is_mega,
                "is_mega": profile.form.is_mega,
                "is_nfe": profile.form.is_nfe,
                **_gender_fields(profile.form),
                "types": types_by_profile.get(profile.pk, []),
                "base_stats": _stats(profile),
                "weight_tenths_kg": profile.weight_tenths_kg,
                "abilities": abilities_by_profile.get(profile.pk, []),
                "move_ids": moves_by_profile.get(profile.pk, []),
                "sprite_form_id": profile.form.canonical_id,
            }
        )

    ability_profiles = list(
        AbilityProfile.objects.filter(regulation=snapshot.regulation)
        .select_related("ability")
        .order_by("ability__name", "ability__canonical_id")
    )
    item_profiles = list(
        ItemProfile.objects.filter(regulation=snapshot.regulation)
        .select_related("item")
        .order_by("item__name", "item__canonical_id")
    )
    move_profiles = list(
        MoveProfile.objects.filter(regulation=snapshot.regulation)
        .select_related("move", "type")
        .order_by("move__name", "move__canonical_id")
    )
    move_profile_ids = [profile.pk for profile in move_profiles]
    flags_by_move: dict[Any, list[str]] = {}
    for flag_relation in (
        MoveFlagRelation.objects.filter(move_profile_id__in=move_profile_ids)
        .values("move_profile_id", "flag__canonical_id")
        .order_by("move_profile_id", "flag__canonical_id")
    ):
        flags_by_move.setdefault(flag_relation["move_profile_id"], []).append(
            flag_relation["flag__canonical_id"]
        )

    target_profiles = {profile.form.pk: profile for profile in profiles}
    mega_item_relations = []
    for relation in mega_rows:
        target = target_profiles.get(relation.mega_form.pk)
        if target is None:
            raise DamageCalculatorUnavailable("A Mega target profile is unavailable.")
        target_abilities = abilities_by_profile.get(target.pk, [])
        if len(target_abilities) != 1:
            raise DamageCalculatorUnavailable("A Mega target must have one locked ability.")
        mega_item_relations.append(
            {
                "item_id": relation.item_profile.item.canonical_id,
                "base_form_id": relation.base_form.canonical_id,
                "mega_form_id": relation.mega_form.canonical_id,
                "locked_ability_id": target_abilities[0]["id"],
            }
        )

    nature_rows = Nature.objects.filter(version=snapshot.version).order_by("name", "canonical_id")
    type_rows = Type.objects.filter(version=snapshot.version).order_by("name", "canonical_id")
    effectiveness_rows = TypeEffectiveness.objects.filter(version=snapshot.version).values(
        "attacking_type__canonical_id",
        "defending_type__canonical_id",
        "multiplier_percent",
    )
    contract = capability.contract
    if not isinstance(contract, dict):
        raise DamageCalculatorUnavailable("The calculator capability is invalid.")
    state_input_policy = contract.get("state_input_policy")
    if not isinstance(state_input_policy, dict):
        raise DamageCalculatorUnavailable("The calculator state-input policy is unavailable.")
    capability_payload = {
        "id": capability.canonical_id,
        **{
            key: value for key, value in contract.items() if key not in {"id", "state_input_policy"}
        },
    }
    return {
        "schema_version": DATA_SCHEMA,
        "data_version": snapshot.version.pk,
        "regulation": {
            "id": snapshot.regulation.canonical_id,
            "name": snapshot.regulation.name,
        },
        "mechanics": {
            "id": mechanics.canonical_id,
            "level": mechanics.level,
            "sp_minimum": mechanics.sp_minimum,
            "sp_maximum": mechanics.sp_maximum,
            "sp_total_max": mechanics.sp_total_max,
            "hp_formula": mechanics.hp_formula,
            "other_formula": mechanics.other_formula,
            "nature_percentages": mechanics.nature_percentages,
        },
        "sprite_url_template": reverse(
            "pokedex-sprite",
            kwargs={
                "version": snapshot.version.pk,
                "form": "__FORM__",
                "variant": "normal",
            },
        ),
        "state_input_policy": state_input_policy,
        "capability": capability_payload,
        "natures": [
            {
                "id": nature.canonical_id,
                "name": nature.name,
                "increased_stat": nature.increased_stat,
                "decreased_stat": nature.decreased_stat,
            }
            for nature in nature_rows
        ],
        "types": [
            {"id": type_identity.canonical_id, "name": type_identity.name}
            for type_identity in type_rows
        ],
        "forms": forms,
        "abilities": [
            {
                "id": profile.ability.canonical_id,
                "name": profile.ability.name,
                "contextual_inputs": profile.contextual_inputs,
            }
            for profile in ability_profiles
        ],
        "items": [
            {
                "id": profile.item.canonical_id,
                "name": profile.item.name,
                "calculation": profile.calculation,
                "contextual_inputs": profile.contextual_inputs,
            }
            for profile in item_profiles
        ],
        "moves": [
            {
                "id": profile.move.canonical_id,
                "name": profile.move.name,
                "description": _move_description(profile),
                "type_id": profile.type.canonical_id,
                "category": profile.category,
                "base_power": profile.base_power,
                "accuracy": profile.accuracy,
                "pp": profile.pp,
                "priority": profile.priority,
                "target": profile.target,
                "flags": flags_by_move.get(profile.pk, []),
                "calculation": profile.calculation,
                "contextual_inputs": profile.contextual_inputs,
            }
            for profile in move_profiles
        ],
        "mega_item_relations": mega_item_relations,
        "type_effectiveness": [
            {
                "attacking_type_id": effectiveness_relation["attacking_type__canonical_id"],
                "defending_type_id": effectiveness_relation["defending_type__canonical_id"],
                "multiplier_percent": effectiveness_relation["multiplier_percent"],
            }
            for effectiveness_relation in effectiveness_rows.order_by(
                "attacking_type__canonical_id", "defending_type__canonical_id"
            )
        ],
    }

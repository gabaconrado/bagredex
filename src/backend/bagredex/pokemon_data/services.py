"""Transactional loading, semantic comparison, and activation services."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

from django.db import transaction

from .bundles import BundleReadError, JsonObject, PokemonDataBundle, read_bundle
from .models import (
    Ability,
    AbilityProfile,
    ActiveDataVersion,
    CalculatorCapability,
    DataActivation,
    DataVersion,
    Item,
    ItemProfile,
    LearnsetEntry,
    MechanicsProfile,
    MegaItemRelation,
    MegaRelation,
    Move,
    MoveFlag,
    MoveFlagRelation,
    MoveProfile,
    Nature,
    PokemonForm,
    PokemonProfile,
    PokemonProfileAbility,
    PokemonProfileType,
    Regulation,
    RegulationMembership,
    Sprite,
    SpriteMapping,
    Type,
    TypeEffectiveness,
)


class PokemonDataServiceError(RuntimeError):
    """A canonical load or activation request could not be completed."""


@dataclass(frozen=True)
class LoadResult:
    """Observable outcome from an idempotent load request."""

    version: DataVersion
    created: bool


@dataclass(frozen=True)
class ActivationResult:
    """Observable outcome from an activation request."""

    previous_identifier: str | None
    new_identifier: str
    changed: bool
    skipped_if_none: bool = False


def _before_pointer_lock(operation: str) -> None:
    """Test seam immediately before taking the singleton serialization lock."""


def _ensure_active_pointer() -> None:
    """Idempotently create the durable singleton before an operation transaction."""
    ActiveDataVersion.objects.get_or_create(singleton_key=1)


def _lock_active_pointer() -> ActiveDataVersion:
    """Lock the singleton's latest state for the current transaction."""
    return ActiveDataVersion.objects.select_for_update().get(singleton_key=1)


def _string(record: JsonObject, key: str) -> str:
    return cast(str, record[key])


def _integer(record: JsonObject, key: str) -> int:
    value = record[key]
    if not isinstance(value, int) or isinstance(value, bool):
        raise BundleReadError(f"{key}: expected an integer")
    return value


def semantic_diff(
    before: dict[str, dict[str, str]] | None,
    after: dict[str, dict[str, str]],
    *,
    before_identifier: str | None = None,
) -> dict[str, Any]:
    """Compare canonical per-record hashes, retaining reviewable stable keys."""
    result: dict[str, Any] = {"before": before_identifier, "files": {}}
    for name in sorted(after.keys() | (before or {}).keys()):
        old = (before or {}).get(name, {})
        new = after.get(name, {})
        added = sorted(new.keys() - old.keys())
        removed = sorted(old.keys() - new.keys())
        changed = sorted(key for key in new.keys() & old.keys() if new[key] != old[key])
        result["files"][name] = {
            "added": len(added),
            "removed": len(removed),
            "changed": len(changed),
            "added_keys": added,
            "removed_keys": removed,
            "changed_keys": changed,
        }
    return result


def _persist_bundle(bundle: PokemonDataBundle, diff: dict[str, Any]) -> DataVersion:
    manifest = bundle.manifest
    version = DataVersion.objects.create(
        id=bundle.identifier,
        bundle_hash=bundle.bundle_hash,
        bundle_schema_version=_string(manifest, "bundle_schema_version"),
        importer_version=_string(manifest, "importer_version"),
        source_shape_version=_string(manifest, "source_shape_version"),
        provenance=bundle.provenance,
        validation_summary=bundle.validation,
        semantic_inventory=bundle.semantic_inventory,
        semantic_diff=diff,
        manifest=manifest,
        status=DataVersion.Status.LOADING,
    )
    mechanics = {
        _string(record, "id"): MechanicsProfile(
            version=version,
            canonical_id=_string(record, "id"),
            level=_integer(record, "level"),
            sp_minimum=_integer(record, "sp_minimum"),
            sp_maximum=_integer(record, "sp_maximum"),
            sp_total_max=record.get("sp_total_max"),
            hp_formula=_string(record, "hp_formula"),
            other_formula=_string(record, "other_formula"),
            nature_percentages=record["nature_percentages"],
        )
        for record in bundle.records["mechanics_profiles.json"]
    }
    MechanicsProfile.objects.bulk_create(mechanics.values())
    regulations = {
        _string(record, "id"): Regulation(
            version=version,
            canonical_id=_string(record, "id"),
            name=_string(record, "name"),
            showdown_format_id=_string(record, "showdown_format_id"),
            mod=_string(record, "mod"),
            ruleset=record["ruleset"],
            mechanics_profile=mechanics[_string(record, "mechanics_profile_id")],
        )
        for record in bundle.records["regulations.json"]
    }
    Regulation.objects.bulk_create(regulations.values())
    forms: dict[str, PokemonForm] = {}
    for record in bundle.records["forms.json"]:
        canonical_id = _string(record, "id")
        forms[canonical_id] = PokemonForm(
            version=version,
            canonical_id=canonical_id,
            name=_string(record, "name"),
            national_dex_number=_integer(record, "national_dex_number"),
            form_label=cast(str, record["form_label"]),
            is_mega=cast(bool, record["is_mega"]),
            is_nfe=cast(bool, record.get("is_nfe", False)),
            gender=cast(str, record.get("gender", "variable")),
            gender_options=record.get("gender_options", []),
            default_gender=cast(str, record.get("default_gender", "M")),
            sprite_id=_string(record, "sprite_id"),
        )
    for record in bundle.records["forms.json"]:
        forms[_string(record, "id")].base_form = forms[_string(record, "base_form_id")]
    PokemonForm.objects.bulk_create(forms.values())

    def named_identities(
        model: type[Ability] | type[Item] | type[Move] | type[Type], name: str
    ) -> dict[str, Any]:
        values = {
            _string(record, "id"): model(
                version=version,
                canonical_id=_string(record, "id"),
                name=_string(record, "name"),
            )
            for record in bundle.records[name]
        }
        model.objects.bulk_create(cast(Any, values.values()))
        return values

    types: dict[str, Type] = named_identities(Type, "types.json")
    abilities: dict[str, Ability] = named_identities(Ability, "abilities.json")
    moves: dict[str, Move] = named_identities(Move, "moves.json")
    items: dict[str, Item] = (
        named_identities(Item, "items.json") if "items.json" in bundle.records else {}
    )
    TypeEffectiveness.objects.bulk_create(
        [
            TypeEffectiveness(
                version=version,
                attacking_type=types[_string(record, "attacking_type_id")],
                defending_type=types[_string(record, "defending_type_id")],
                multiplier_percent=_integer(record, "multiplier_percent"),
            )
            for record in bundle.records.get("type_effectiveness.json", [])
        ]
    )
    CalculatorCapability.objects.bulk_create(
        [
            CalculatorCapability(
                version=version,
                canonical_id=_string(record, "id"),
                contract={key: value for key, value in record.items() if key != "id"},
            )
            for record in bundle.records.get("calculator_capabilities.json", [])
        ]
    )
    if "natures.json" in bundle.records:
        Nature.objects.bulk_create(
            [
                Nature(
                    version=version,
                    canonical_id=_string(record, "id"),
                    name=_string(record, "name"),
                    increased_stat=record["increased_stat"],
                    decreased_stat=record["decreased_stat"],
                )
                for record in bundle.records["natures.json"]
            ]
        )
    flags = {
        _string(record, "id"): MoveFlag(version=version, canonical_id=_string(record, "id"))
        for record in bundle.records["move_flags.json"]
    }
    MoveFlag.objects.bulk_create(flags.values())
    ability_profiles = {
        (_string(record, "regulation_id"), _string(record, "id")): AbilityProfile(
            version=version,
            regulation=regulations[_string(record, "regulation_id")],
            ability=abilities[_string(record, "id")],
            short_description=_string(record, "short_description"),
            description=_string(record, "description"),
            contextual_inputs=record.get("contextual_inputs", []),
            suppresses_held_item=record.get("suppresses_held_item", False),
        )
        for record in bundle.records["ability_profiles.json"]
    }
    AbilityProfile.objects.bulk_create(ability_profiles.values())
    item_profiles = {
        (_string(record, "regulation_id"), _string(record, "id")): ItemProfile(
            version=version,
            regulation=regulations[_string(record, "regulation_id")],
            item=items[_string(record, "id")],
            source_status=_string(record, "source_status"),
            short_description=record.get("short_description"),
            description=record.get("description"),
            description_source=record.get("description_source"),
            contextual_inputs=record.get("contextual_inputs", []),
            calculation=record.get("calculation", {}),
            stat_modifiers=record.get("stat_modifiers", []),
        )
        for record in bundle.records.get("item_profiles.json", [])
    }
    ItemProfile.objects.bulk_create(item_profiles.values())
    move_profiles: dict[tuple[str, str], MoveProfile] = {}
    for record in bundle.records["move_profiles.json"]:
        regulation_id = _string(record, "regulation_id")
        move_id = _string(record, "id")
        accuracy = record["accuracy"]
        type_id = re.sub(r"[^a-z0-9]+", "", _string(record, "type").lower())
        move_profiles[(regulation_id, move_id)] = MoveProfile(
            version=version,
            regulation=regulations[regulation_id],
            move=moves[move_id],
            type=types[type_id],
            category=_string(record, "category"),
            base_power=_integer(record, "base_power"),
            accuracy=None if accuracy == "always" else cast(int, accuracy),
            always_hits=accuracy == "always",
            pp=_integer(record, "pp"),
            priority=_integer(record, "priority"),
            target=_string(record, "target"),
            short_description=_string(record, "short_description"),
            description=_string(record, "description"),
            calculation=record.get("calculation", {}),
            contextual_inputs=record.get("contextual_inputs", []),
        )
    MoveProfile.objects.bulk_create(move_profiles.values())
    profiles: dict[tuple[str, str], PokemonProfile] = {}
    for record in bundle.records["profiles.json"]:
        regulation_id = _string(record, "regulation_id")
        form_id = _string(record, "form_id")
        stats = cast(JsonObject, record["stats"])
        profiles[(regulation_id, form_id)] = PokemonProfile(
            version=version,
            regulation=regulations[regulation_id],
            form=forms[form_id],
            hp=_integer(stats, "hp"),
            attack=_integer(stats, "atk"),
            defense=_integer(stats, "def"),
            special_attack=_integer(stats, "spa"),
            special_defense=_integer(stats, "spd"),
            speed=_integer(stats, "spe"),
            bst=_integer(record, "bst"),
            weight_tenths_kg=record.get("weight_tenths_kg"),
        )
    PokemonProfile.objects.bulk_create(profiles.values())
    profile_types: list[PokemonProfileType] = []
    profile_abilities: list[PokemonProfileAbility] = []
    for record in bundle.records["profiles.json"]:
        regulation_id = _string(record, "regulation_id")
        form_id = _string(record, "form_id")
        profile = profiles[(regulation_id, form_id)]
        for position, type_name in enumerate(cast(list[str], record["types"])):
            type_id = re.sub(r"[^a-z0-9]+", "", type_name.lower())
            profile_types.append(
                PokemonProfileType(profile=profile, type=types[type_id], position=position)
            )
        for ability_record in cast(list[JsonObject], record["abilities"]):
            ability_id = _string(ability_record, "ability_id")
            profile_abilities.append(
                PokemonProfileAbility(
                    profile=profile,
                    ability_profile=ability_profiles[(regulation_id, ability_id)],
                    slot=_string(ability_record, "slot"),
                )
            )
    PokemonProfileType.objects.bulk_create(profile_types)
    PokemonProfileAbility.objects.bulk_create(profile_abilities)
    RegulationMembership.objects.bulk_create(
        [
            RegulationMembership(
                profile=profiles[(_string(record, "regulation_id"), _string(record, "form_id"))],
                resolution=cast(str, record.get("resolution", "direct")),
                source_form_id=cast(str, record.get("source_form_id", record["form_id"])),
            )
            for record in bundle.records["regulation_memberships.json"]
        ]
    )
    MoveFlagRelation.objects.bulk_create(
        [
            MoveFlagRelation(
                move_profile=move_profiles[
                    (_string(record, "regulation_id"), _string(record, "move_id"))
                ],
                flag=flags[_string(record, "flag_id")],
            )
            for record in bundle.records["move_flag_relations.json"]
        ]
    )
    MegaRelation.objects.bulk_create(
        [
            MegaRelation(
                version=version,
                base_form=forms[_string(record, "base_form_id")],
                mega_form=forms[_string(record, "mega_form_id")],
            )
            for record in bundle.records["mega_relations.json"]
        ]
    )
    MegaItemRelation.objects.bulk_create(
        [
            MegaItemRelation(
                version=version,
                regulation=regulations[_string(record, "regulation_id")],
                item_profile=item_profiles[
                    (_string(record, "regulation_id"), _string(record, "item_id"))
                ],
                base_form=forms[_string(record, "base_form_id")],
                mega_form=forms[_string(record, "mega_form_id")],
            )
            for record in bundle.records.get("mega_item_relations.json", [])
        ]
    )
    LearnsetEntry.objects.bulk_create(
        [
            LearnsetEntry(
                profile=profiles[(_string(record, "regulation_id"), _string(record, "form_id"))],
                move_profile=move_profiles[
                    (_string(record, "regulation_id"), _string(record, "move_id"))
                ],
                form_resolution=_string(record, "form_resolution"),
                source_form=forms[_string(record, "source_form_id")],
                source_mod=_string(record, "source_mod"),
                source_kind=_string(record, "source_kind"),
            )
            for record in bundle.records["learnsets.json"]
        ],
        batch_size=5000,
    )
    common_sprite_fields = {
        "form_id",
        "variant",
        "path",
        "source_path",
        "sha256",
        "width",
        "height",
    }
    sprite_mappings = {
        _string(record, "form_id"): SpriteMapping(
            version=version,
            form=forms[_string(record, "form_id")],
            pokeapi_pokemon_id=_integer(record, "pokeapi_pokemon_id"),
            pokeapi_identifier=_string(record, "pokeapi_identifier"),
            mapping_rule=_string(record, "mapping_rule"),
        )
        for record in bundle.records["sprite_mappings.json"]
    }
    SpriteMapping.objects.bulk_create(sprite_mappings.values())
    Sprite.objects.bulk_create(
        [
            Sprite(
                version=version,
                mapping=sprite_mappings[_string(record, "form_id")],
                variant=_string(record, "variant"),
                path=_string(record, "path"),
                source_path=_string(record, "source_path"),
                sha256=_string(record, "sha256"),
                width=_integer(record, "width"),
                height=_integer(record, "height"),
                provenance={
                    key: value for key, value in record.items() if key not in common_sprite_fields
                },
            )
            for record in bundle.records["sprites.json"]
        ]
    )
    DataVersion.objects.filter(pk=version.pk).update(status=DataVersion.Status.LOADED)
    version.status = DataVersion.Status.LOADED
    return version


def load_pokemon_data(directory: Path) -> LoadResult:
    """Validate then atomically and idempotently load one immutable bundle."""
    try:
        bundle = read_bundle(directory)
    except (BundleReadError, OSError) as error:
        raise PokemonDataServiceError(str(error)) from error
    _ensure_active_pointer()
    with transaction.atomic():
        _before_pointer_lock("load")
        pointer = _lock_active_pointer()
        existing = DataVersion.objects.filter(pk=bundle.identifier).first()
        if existing is not None:
            if existing.status != DataVersion.Status.LOADED:
                raise PokemonDataServiceError(
                    f"version {bundle.identifier} exists but is not completely loaded"
                )
            if existing.bundle_hash != bundle.bundle_hash or existing.manifest != bundle.manifest:
                raise PokemonDataServiceError(
                    f"version {bundle.identifier} already exists with different content"
                )
            return LoadResult(existing, created=False)
        active_version = (
            None
            if pointer.version_id is None
            else DataVersion.objects.only("id", "semantic_inventory").get(pk=pointer.version_id)
        )
        active_inventory = (
            None
            if active_version is None
            else cast(dict[str, dict[str, str]], active_version.semantic_inventory)
        )
        diff = semantic_diff(
            active_inventory,
            bundle.semantic_inventory,
            before_identifier=None if active_version is None else active_version.pk,
        )
        version = _persist_bundle(bundle, diff)
        return LoadResult(version, created=True)


def activate_pokemon_data(identifier: str, *, if_none: bool = False) -> ActivationResult:
    """Atomically activate or roll back to one completely loaded version."""
    _ensure_active_pointer()
    with transaction.atomic():
        try:
            target = DataVersion.objects.get(pk=identifier, status=DataVersion.Status.LOADED)
        except DataVersion.DoesNotExist as error:
            raise PokemonDataServiceError(
                f"loaded data version does not exist: {identifier}"
            ) from error
        _before_pointer_lock("activate-if-none" if if_none else "activate")
        pointer = _lock_active_pointer()
        previous_id = pointer.version_id
        if previous_id == identifier:
            return ActivationResult(previous_id, identifier, changed=False)
        if if_none and previous_id is not None:
            return ActivationResult(previous_id, identifier, changed=False, skipped_if_none=True)
        pointer.version = target
        pointer.save(update_fields=("version",))
        DataActivation.objects.create(previous_version_id=previous_id, new_version=target)
        return ActivationResult(previous_id, identifier, changed=True)

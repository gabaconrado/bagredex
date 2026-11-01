"""Team aggregate validation, replacement, and serialization."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, cast

from django.db import IntegrityError, transaction
from django.urls import reverse

from bagredex.pokemon_data.models import (
    AbilityProfile,
    ItemProfile,
    MegaItemRelation,
    MoveProfile,
    Nature,
    PokemonProfile,
    Regulation,
)
from bagredex.pokemon_data.stats import Nature as StatNature
from bagredex.pokemon_data.stats import level_50_stat

from .models import Team, TeamMember, TeamMemberMove

API_SCHEMA = "team-api-v1"
DRAFT_SCHEMA = "team-draft-v1"
DATA_SCHEMA = "team-builder-data-v5"
BOOTSTRAP_SCHEMA = "team-builder-bootstrap-v2"
STAT_IDS = ("hp", "attack", "defense", "special_attack", "special_defense", "speed")


def mechanics_supported(regulation: Regulation) -> bool:
    """Return whether exact Champions arithmetic is supported for this pinned row."""
    mechanics = regulation.mechanics_profile
    return (
        mechanics.level == 50
        and mechanics.sp_minimum == 0
        and mechanics.sp_maximum == 32
        and mechanics.sp_total_max == 66
        and mechanics.hp_formula == "base + sp + 75"
        and mechanics.other_formula == "truncate((base + sp + 20) * nature_percent / 100)"
        and mechanics.nature_percentages == {"hindering": 90, "neutral": 100, "increasing": 110}
    )


class TeamValidationError(ValueError):
    """A stable collection of client-correctable field errors."""

    def __init__(self, fields: dict[str, list[str]], code: str = "validation-error") -> None:
        super().__init__("The team draft is invalid.")
        self.code = code
        self.fields = fields


@dataclass(frozen=True)
class ResolvedMember:
    position: int
    profile: PokemonProfile
    nickname: str
    ability: AbilityProfile | None
    item: ItemProfile | None
    moves: list[tuple[int, MoveProfile]]
    nature: Nature
    sp: dict[str, int]
    shiny: bool
    mega_preview: bool


def _field(errors: dict[str, list[str]], path: str, message: str) -> None:
    errors.setdefault(path, []).append(message)


def _canonical(value: object, path: str, errors: dict[str, list[str]]) -> str | None:
    if not isinstance(value, str) or not value or len(value) > 100:
        _field(errors, path, "Enter a valid canonical identifier.")
        return None
    return value


def _resolve_member(
    raw: object, index: int, regulation: Regulation, errors: dict[str, list[str]]
) -> ResolvedMember | None:
    prefix = f"members.{index}"
    if not isinstance(raw, Mapping):
        _field(errors, prefix, "Enter a member object.")
        return None
    position = raw.get("position")
    if type(position) is not int or not 0 <= position <= 5:
        _field(errors, f"{prefix}.position", "Enter a position from 0 through 5.")
    pokemon_id = _canonical(raw.get("pokemon"), f"{prefix}.pokemon", errors)
    profile = None
    if pokemon_id:
        profile = (
            PokemonProfile.objects.select_related("form__base_form")
            .filter(
                regulation=regulation,
                form__canonical_id=pokemon_id,
                form__is_mega=False,
                membership__isnull=False,
            )
            .first()
        )
        if profile is None:
            _field(errors, f"{prefix}.pokemon", "Choose a legal non-Mega Pokémon.")
    nickname = raw.get("nickname", "")
    if not isinstance(nickname, str) or len(nickname) > 10:
        _field(errors, f"{prefix}.nickname", "Use at most 10 characters.")
        nickname = ""

    ability: AbilityProfile | None = None
    ability_id = raw.get("ability")
    if ability_id is not None:
        canonical = _canonical(ability_id, f"{prefix}.ability", errors)
        if canonical and profile:
            ability = AbilityProfile.objects.filter(
                regulation=regulation,
                ability__canonical_id=canonical,
                pokemonprofileability__profile=profile,
            ).first()
            if ability is None:
                _field(errors, f"{prefix}.ability", "Choose an ability for this Pokémon.")

    item: ItemProfile | None = None
    item_id = raw.get("item")
    if item_id is not None:
        canonical = _canonical(item_id, f"{prefix}.item", errors)
        if canonical:
            item = ItemProfile.objects.filter(
                regulation=regulation, item__canonical_id=canonical
            ).first()
            if item is None:
                _field(errors, f"{prefix}.item", "Choose a legal item.")

    raw_moves = raw.get("moves")
    moves: list[tuple[int, MoveProfile]] = []
    if not isinstance(raw_moves, list) or len(raw_moves) != 4:
        _field(errors, f"{prefix}.moves", "Enter exactly four move slots.")
    else:
        seen_moves: set[str] = set()
        for move_index, raw_move in enumerate(raw_moves):
            path = f"{prefix}.moves.{move_index}"
            if raw_move is None:
                continue
            canonical = _canonical(raw_move, path, errors)
            if canonical is None:
                continue
            if canonical in seen_moves:
                _field(errors, path, "A move can be selected only once.")
                continue
            seen_moves.add(canonical)
            move = None
            if profile:
                move = MoveProfile.objects.filter(
                    regulation=regulation,
                    move__canonical_id=canonical,
                    learnsetentry__profile=profile,
                ).first()
            if move is None:
                _field(errors, path, "Choose a move this Pokémon can learn.")
            else:
                moves.append((move_index, move))

    nature_id = _canonical(raw.get("nature"), f"{prefix}.nature", errors)
    nature = Nature.objects.filter(version=regulation.version, canonical_id=nature_id).first()
    if nature is None or (
        nature.increased_stat is None
        and nature.decreased_stat is None
        and nature.canonical_id != "serious"
    ):
        _field(errors, f"{prefix}.nature", "Choose Serious or a stat-changing nature.")

    raw_sp = raw.get("sp")
    sp: dict[str, int] = {}
    if not isinstance(raw_sp, Mapping):
        _field(errors, f"{prefix}.sp", "Enter all six SP values.")
    else:
        for stat in STAT_IDS:
            value = raw_sp.get(stat)
            if type(value) is not int or not 0 <= value <= 32:
                _field(errors, f"{prefix}.sp.{stat}", "Enter a whole number from 0 through 32.")
            else:
                sp[stat] = value
        total_max = regulation.mechanics_profile.sp_total_max
        if len(sp) == 6 and (total_max is None or sum(sp.values()) > total_max):
            _field(errors, f"{prefix}.sp", f"Allocate no more than {total_max or 0} SP total.")

    shiny = raw.get("shiny", False)
    mega_preview = raw.get("mega_preview", False)
    if type(shiny) is not bool:
        _field(errors, f"{prefix}.shiny", "Enter true or false.")
    if type(mega_preview) is not bool:
        _field(errors, f"{prefix}.mega_preview", "Enter true or false.")
    if mega_preview is True and profile and item:
        if not MegaItemRelation.objects.filter(
            regulation=regulation, item_profile=item, base_form=profile.form
        ).exists():
            _field(errors, f"{prefix}.mega_preview", "This item cannot Mega Evolve this form.")
    elif mega_preview is True:
        _field(errors, f"{prefix}.mega_preview", "Select this Pokémon's Mega Stone first.")

    if errors and any(path == prefix or path.startswith(f"{prefix}.") for path in errors):
        return None
    assert isinstance(position, int) and profile is not None and nature is not None
    return ResolvedMember(
        position, profile, nickname, ability, item, moves, nature, sp, shiny, mega_preview
    )


def validate_draft(payload: object, regulation: Regulation) -> tuple[str, list[ResolvedMember]]:
    """Resolve a complete untrusted draft against one exact regulation."""
    if not mechanics_supported(regulation):
        raise TeamValidationError(
            {"regulation": ["This pinned regulation has unsupported mechanics."]},
            "data-unavailable",
        )
    errors: dict[str, list[str]] = {}
    if not isinstance(payload, Mapping):
        raise TeamValidationError({"": ["Enter a JSON object."]}, "invalid-request")
    if payload.get("schema_version") != DRAFT_SCHEMA:
        _field(errors, "schema_version", f"Use {DRAFT_SCHEMA}.")
    name = payload.get("name")
    if isinstance(name, str):
        name = name.strip()
    if not isinstance(name, str) or not name or len(name) > 80:
        _field(errors, "name", "Enter a name from 1 through 80 characters.")
        name = ""
    raw_members = payload.get("members")
    if not isinstance(raw_members, list) or len(raw_members) > 6:
        _field(errors, "members", "Enter no more than six members.")
        raw_members = []
    members = [
        member
        for index, raw in enumerate(raw_members)
        if (member := _resolve_member(raw, index, regulation, errors)) is not None
    ]
    positions: set[int] = set()
    species: set[object] = set()
    items: set[object] = set()
    for index, member in enumerate(members):
        if member.position in positions:
            _field(errors, f"members.{index}.position", "Each slot position must be unique.")
        positions.add(member.position)
        species_id = member.profile.form.base_form_id
        if species_id in species:
            _field(errors, f"members.{index}.pokemon", "Only one Pokémon per species is allowed.")
        species.add(species_id)
        if member.item and member.item.id in items:
            _field(errors, f"members.{index}.item", "Each held item must be unique.")
        if member.item:
            items.add(member.item.id)
    if errors:
        raise TeamValidationError(errors)
    return name, members


def _replace_members(team: Team, members: list[ResolvedMember]) -> None:
    team.members.all().delete()
    for resolved in members:
        member = TeamMember.objects.create(
            team=team,
            position=resolved.position,
            profile=resolved.profile,
            species_form=resolved.profile.form.base_form,
            nickname=resolved.nickname,
            ability_profile=resolved.ability,
            item_profile=resolved.item,
            nature=resolved.nature,
            sp_hp=resolved.sp["hp"],
            sp_attack=resolved.sp["attack"],
            sp_defense=resolved.sp["defense"],
            sp_special_attack=resolved.sp["special_attack"],
            sp_special_defense=resolved.sp["special_defense"],
            sp_speed=resolved.sp["speed"],
            shiny=resolved.shiny,
            mega_preview=resolved.mega_preview,
        )
        TeamMemberMove.objects.bulk_create(
            [
                TeamMemberMove(member=member, position=position, move_profile=move)
                for position, move in resolved.moves
            ]
        )


def create_team(owner: Any, regulation: Regulation, payload: object) -> Team:
    """Atomically create one complete aggregate."""
    name, members = validate_draft(payload, regulation)
    if Team.objects.filter(owner=owner, name__iexact=name).exists():
        raise TeamValidationError({"name": ["You already have a team with this name."]})
    try:
        with transaction.atomic():
            team = Team.objects.create(owner=owner, regulation=regulation, name=name)
            _replace_members(team, members)
    except IntegrityError as error:
        raise TeamValidationError({"name": ["You already have a team with this name."]}) from error
    return team


def replace_team(team: Team, payload: object) -> Team:
    """Lock and atomically replace one complete owned aggregate."""
    name, members = validate_draft(payload, team.regulation)
    if Team.objects.filter(owner=team.owner, name__iexact=name).exclude(pk=team.pk).exists():
        raise TeamValidationError({"name": ["You already have a team with this name."]})
    try:
        with transaction.atomic():
            locked = Team.objects.select_for_update().select_related("regulation").get(pk=team.pk)
            locked.name = name
            locked.save(update_fields=("name", "updated_at"))
            _replace_members(locked, members)
    except IntegrityError as error:
        raise TeamValidationError({"name": ["You already have a team with this name."]}) from error
    return locked


def team_queryset() -> Any:
    """Return aggregates with all serialization relations prefetched."""
    return Team.objects.select_related("regulation__version").prefetch_related(
        "members__profile__form__base_form",
        "members__ability_profile__ability",
        "members__item_profile__item",
        "members__nature",
        "members__moves__move_profile__move",
    )


def _stats(member: TeamMember, profile: PokemonProfile) -> dict[str, int]:
    increased = member.nature.increased_stat
    decreased = member.nature.decreased_stat
    values: dict[str, int] = {}
    for stat in STAT_IDS:
        short = {
            "attack": "atk",
            "defense": "def",
            "special_attack": "spa",
            "special_defense": "spd",
            "speed": "spe",
        }.get(stat, stat)
        nature = (
            "increasing" if increased == short else "hindering" if decreased == short else "neutral"
        )
        values[stat] = level_50_stat(
            base=getattr(profile, stat),
            sp=getattr(member, f"sp_{stat}"),
            hp=stat == "hp",
            nature=cast(StatNature, nature),
        )
    return values


def _serialize_moves(member: TeamMember) -> list[str | None]:
    moves: list[str | None] = [None, None, None, None]
    for move in member.moves.all():
        moves[move.position] = move.move_profile.move.canonical_id
    return moves


def serialize_team(team: Team) -> dict[str, Any]:
    """Serialize a canonical saved aggregate."""
    if not mechanics_supported(team.regulation):
        raise ValueError("The pinned regulation has unsupported mechanics.")
    members = []
    for member in sorted(team.members.all(), key=lambda value: value.position):
        mega = None
        if member.item_profile_id:
            mega = (
                MegaItemRelation.objects.select_related("mega_form")
                .filter(
                    regulation=team.regulation,
                    item_profile=member.item_profile,
                    base_form=member.profile.form,
                )
                .first()
            )
        display_profile = member.profile
        if member.mega_preview and mega:
            display_profile = PokemonProfile.objects.get(
                regulation=team.regulation, form=mega.mega_form
            )
        members.append(
            {
                "position": member.position,
                "pokemon": member.profile.form.canonical_id,
                "nickname": member.nickname,
                "ability": member.ability_profile.ability.canonical_id
                if member.ability_profile
                else None,
                "item": member.item_profile.item.canonical_id if member.item_profile else None,
                "moves": _serialize_moves(member),
                "nature": member.nature.canonical_id,
                "sp": {stat: getattr(member, f"sp_{stat}") for stat in STAT_IDS},
                "shiny": member.shiny,
                "mega_preview": member.mega_preview,
                "mega_target": mega.mega_form.canonical_id if mega else None,
                "stats": _stats(member, display_profile),
            }
        )
    return {
        "id": str(team.pk),
        "name": team.name,
        "pinned": {
            "version": team.regulation.version_id,
            "regulation": {"id": team.regulation.canonical_id, "name": team.regulation.name},
        },
        "members": members,
        "created_at": team.created_at.isoformat(),
        "updated_at": team.updated_at.isoformat(),
    }


def summary(team: Team) -> dict[str, Any]:
    return {
        "id": str(team.pk),
        "name": team.name,
        "pinned_version": team.regulation.version_id,
        "regulation": {"id": team.regulation.canonical_id, "name": team.regulation.name},
        "members": [
            {
                "position": member.position,
                "sprite_url": reverse(
                    "pokedex-sprite",
                    kwargs={
                        "version": team.regulation.version_id,
                        "form": member.profile.form.canonical_id,
                        "variant": "shiny" if member.shiny else "normal",
                    },
                ),
            }
            for member in sorted(team.members.all(), key=lambda value: value.position)
        ],
        "updated_at": team.updated_at.isoformat(),
    }

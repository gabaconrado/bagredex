"""Serialize the private Battle Mode page bootstrap."""

from __future__ import annotations

from typing import Any, cast
from uuid import UUID

from django.db.models import Prefetch
from django.urls import reverse

from bagredex.pokedex import Snapshot
from bagredex.pokemon_data.models import LearnsetEntry, MegaItemRelation, PokemonProfile
from bagredex.regulations import regulation_page_url
from bagredex.teams.models import Team, TeamMember, TeamMemberMove

BOOTSTRAP_SCHEMA = "battle-mode-bootstrap-v2"

EMPTY_TEAM_REASON = "Add at least one Pokémon."
ABILITY_REASON = "Choose an ability for every Pokémon."
INVALID_TEAM_REASON = "Update invalid Pokémon details in Team Builder."


def _member_is_exact_and_legal(member: TeamMember, team: Team) -> bool:
    """Validate persisted calculator facts using only prefetched relations."""
    row = cast(Any, member)
    exact_team = cast(Any, team)
    regulation = team.regulation
    profile = member.profile
    exact_profile = cast(Any, profile)
    mechanics = regulation.mechanics_profile
    if (
        row.team_id != team.pk
        or not 0 <= member.position <= 5
        or profile.regulation_id != regulation.pk
        or profile.version_id != regulation.version_id
        or profile.form.is_mega
        or profile.form.version_id != regulation.version_id
        or row.species_form_id != profile.form.base_form_id
        or not hasattr(profile, "membership")
        or member.nature.version_id != regulation.version_id
        or (
            member.nature.increased_stat is None
            and member.nature.decreased_stat is None
            and member.nature.canonical_id != "serious"
        )
        or not 0 <= member.sp_hp <= mechanics.sp_maximum
        or not 0 <= member.sp_attack <= mechanics.sp_maximum
        or not 0 <= member.sp_defense <= mechanics.sp_maximum
        or not 0 <= member.sp_special_attack <= mechanics.sp_maximum
        or not 0 <= member.sp_special_defense <= mechanics.sp_maximum
        or not 0 <= member.sp_speed <= mechanics.sp_maximum
    ):
        return False
    sp_total = sum(
        (
            member.sp_hp,
            member.sp_attack,
            member.sp_defense,
            member.sp_special_attack,
            member.sp_special_defense,
            member.sp_speed,
        )
    )
    if mechanics.sp_total_max is not None and sp_total > mechanics.sp_total_max:
        return False
    if (
        row.item_profile_id is not None
        and cast(Any, member.item_profile).regulation_id != regulation.pk
    ):
        return False
    if member.mega_preview and (
        row.item_profile_id is None
        or not any(
            relation.regulation_id == regulation.pk
            and relation.base_form_id == exact_profile.form_id
            for relation in cast(Any, member.item_profile)._battle_mega_relations
        )
    ):
        return False

    positions: set[int] = set()
    move_ids: set[UUID] = set()
    for member_move in row._battle_moves:
        move_profile = member_move.move_profile
        if (
            not 0 <= member_move.position <= 3
            or member_move.position in positions
            or move_profile.pk in move_ids
            or move_profile.regulation_id != exact_team.regulation_id
            or not any(
                entry.profile_id == profile.pk
                for entry in cast(Any, move_profile)._battle_learnset_entries
            )
        ):
            return False
        positions.add(member_move.position)
        move_ids.add(move_profile.pk)
    return True


def _battle_readiness(team: Team, members: list[TeamMember]) -> tuple[bool, str | None]:
    """Return Battle Mode readiness without exposing member-level private facts."""
    if not members:
        return False, EMPTY_TEAM_REASON
    if any(cast(Any, member).ability_profile_id is None for member in members):
        return False, ABILITY_REASON
    if any(
        cast(Any, member.ability_profile).regulation_id != cast(Any, team).regulation_id
        or not any(
            relation.ability_profile_id == cast(Any, member).ability_profile_id
            for relation in cast(Any, member.profile)._battle_abilities
        )
        for member in members
    ):
        return False, ABILITY_REASON
    if len({member.position for member in members}) != len(members):
        return False, INVALID_TEAM_REASON
    if len({cast(Any, member).species_form_id for member in members}) != len(members):
        return False, INVALID_TEAM_REASON
    item_ids = [
        cast(Any, member).item_profile_id
        for member in members
        if cast(Any, member).item_profile_id is not None
    ]
    if len(set(item_ids)) != len(item_ids):
        return False, INVALID_TEAM_REASON
    if any(not _member_is_exact_and_legal(member, team) for member in members):
        return False, INVALID_TEAM_REASON
    return True, None


def _team_summaries(user: Any, snapshot: Snapshot) -> list[dict[str, Any]]:
    """Serialize private previews and readiness with a bounded query shape."""
    regulation = snapshot.regulation
    teams = list(
        Team.objects.select_related("regulation__version", "regulation__mechanics_profile")
        .filter(owner=user, regulation=regulation)
        .order_by("-updated_at", "pk")
    )
    members_by_team: dict[UUID, list[TeamMember]] = {}
    members = (
        TeamMember.objects.select_related(
            "team__regulation__version",
            "team__regulation__mechanics_profile",
            "profile__form__base_form",
            "profile__membership",
            "ability_profile",
            "item_profile",
            "nature",
            "species_form",
        )
        .prefetch_related(
            Prefetch("profile__abilities", to_attr="_battle_abilities"),
            Prefetch(
                "moves",
                queryset=TeamMemberMove.objects.select_related("move_profile").prefetch_related(
                    Prefetch(
                        "move_profile__learnsetentry_set",
                        queryset=LearnsetEntry.objects.only("profile_id", "move_profile_id"),
                        to_attr="_battle_learnset_entries",
                    )
                ),
                to_attr="_battle_moves",
            ),
            Prefetch(
                "item_profile__megaitemrelation_set",
                queryset=MegaItemRelation.objects.only(
                    "item_profile_id", "regulation_id", "base_form_id"
                ),
                to_attr="_battle_mega_relations",
            ),
        )
        .filter(team__owner=user, team__regulation=regulation)
        .order_by("team_id", "position")
    )
    for member in members:
        members_by_team.setdefault(cast(Any, member).team_id, []).append(member)
    summaries = []
    for team in teams:
        team_members = members_by_team.get(team.pk, [])
        battle_ready, unavailable_reason = _battle_readiness(team, team_members)
        summaries.append(
            {
                "id": str(team.pk),
                "name": team.name,
                "pinned_version": team.regulation.version_id,
                "regulation": {
                    "id": team.regulation.canonical_id,
                    "name": team.regulation.name,
                },
                "members": [
                    {
                        "position": member.position,
                        "sprite_url": reverse(
                            "pokedex-sprite",
                            kwargs={
                                "version": member.team.regulation.version_id,
                                "form": member.profile.form.canonical_id,
                                "variant": "shiny" if member.shiny else "normal",
                            },
                        ),
                    }
                    for member in team_members
                ],
                "battle_ready": battle_ready,
                "battle_unavailable_reason": unavailable_reason,
                "updated_at": team.updated_at.isoformat(),
            }
        )
    return summaries


def battle_mode_bootstrap(user: Any, snapshot: Snapshot) -> dict[str, Any]:
    """Return exact-context private teams and normalized-data references."""
    version_id = snapshot.version.pk
    regulation = snapshot.regulation
    form_species = PokemonProfile.objects.filter(
        regulation=regulation,
        membership__isnull=False,
        form__is_mega=False,
    ).values_list("form__canonical_id", "form__base_form__canonical_id")
    zero_uuid = UUID(int=0)
    return {
        "schema_version": BOOTSTRAP_SCHEMA,
        "active_version": version_id,
        "regulation": {"id": regulation.canonical_id, "name": regulation.name},
        "teams": _team_summaries(user, snapshot),
        "dataset_url": reverse(
            "damage-calculator-data",
            kwargs={"version": version_id, "regulation": regulation.canonical_id},
        ),
        "team_url_template": reverse("teams-detail", kwargs={"team_id": zero_uuid}).replace(
            str(zero_uuid), "__TEAM__"
        ),
        "team_builder_url": regulation_page_url(reverse("teams-page"), regulation.canonical_id),
        "base_species_by_form": dict(sorted(form_species)),
    }

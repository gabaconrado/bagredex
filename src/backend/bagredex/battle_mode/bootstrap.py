"""Serialize the private Battle Mode page bootstrap."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from django.urls import reverse

from bagredex.pokedex import Snapshot
from bagredex.pokemon_data.models import PokemonProfile
from bagredex.teams.models import Team, TeamMember

BOOTSTRAP_SCHEMA = "battle-mode-bootstrap-v1"


def _team_summaries(user: Any, snapshot: Snapshot) -> list[dict[str, Any]]:
    """Serialize private preview data with a fixed two-query shape."""
    regulation = snapshot.regulation
    teams = list(
        Team.objects.select_related("regulation__version")
        .filter(owner=user, regulation=regulation)
        .order_by("-updated_at", "pk")
    )
    members_by_team: dict[UUID, list[dict[str, Any]]] = {}
    members = (
        TeamMember.objects.select_related("team__regulation__version", "profile__form")
        .filter(team__owner=user, team__regulation=regulation)
        .order_by("team_id", "position")
    )
    for member in members:
        members_by_team.setdefault(member.team_id, []).append(
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
        )
    return [
        {
            "id": str(team.pk),
            "name": team.name,
            "pinned_version": team.regulation.version_id,
            "regulation": {
                "id": team.regulation.canonical_id,
                "name": team.regulation.name,
            },
            "members": members_by_team.get(team.pk, []),
            "updated_at": team.updated_at.isoformat(),
        }
        for team in teams
    ]


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
        "team_builder_url": (f"{reverse('teams-page')}?regulation={regulation.canonical_id}"),
        "base_species_by_form": dict(sorted(form_species)),
    }

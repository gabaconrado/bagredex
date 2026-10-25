"""Request and bootstrap tests for the read-only Battle Mode backend."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from bagredex.accounts.models import User
from bagredex.pokemon_data.models import (
    CalculatorCapability,
    DataVersion,
    MechanicsProfile,
    Nature,
    PokemonForm,
    PokemonProfile,
    Regulation,
    RegulationMembership,
)
from bagredex.pokemon_data.services import activate_pokemon_data
from bagredex.teams.models import Team, TeamMember


def _version(identifier: str) -> DataVersion:
    return DataVersion.objects.create(
        id=identifier,
        bundle_hash="a" * 64,
        bundle_schema_version="5",
        importer_version="6",
        source_shape_version="test",
        provenance={},
        validation_summary={},
        semantic_inventory={},
        semantic_diff={},
        manifest={},
    )


def _load(version: DataVersion) -> None:
    DataVersion.objects.filter(pk=version.pk).update(status=DataVersion.Status.LOADED)
    version.status = DataVersion.Status.LOADED


def _regulation(version: DataVersion, name: str = "Regulation M-C") -> Regulation:
    mechanics = MechanicsProfile.objects.create(
        version=version,
        canonical_id="champions-level-50-v1",
        level=50,
        sp_minimum=0,
        sp_maximum=32,
        sp_total_max=66,
        hp_formula="base + sp + 75",
        other_formula="truncate((base + sp + 20) * nature_percent / 100)",
        nature_percentages={"hindering": 90, "neutral": 100, "increasing": 110},
    )
    regulation = Regulation.objects.create(
        version=version,
        canonical_id="m-c",
        name=name,
        showdown_format_id="gen9championsvgc2026regmc",
        mod="champions",
        ruleset=[],
        mechanics_profile=mechanics,
    )
    Nature.objects.create(
        version=version,
        canonical_id="serious",
        name="Serious",
        increased_stat=None,
        decreased_stat=None,
    )
    return regulation


def _profile(
    version: DataVersion,
    regulation: Regulation,
    canonical_id: str,
    *,
    base_form: PokemonForm | None = None,
) -> PokemonProfile:
    form_id = uuid.uuid4()
    form = PokemonForm.objects.create(
        id=form_id,
        version=version,
        canonical_id=canonical_id,
        name=canonical_id.title(),
        national_dex_number=25,
        base_form_id=base_form.pk if base_form is not None else form_id,
        form_label="" if base_form is None else "Alternate",
        is_mega=False,
        sprite_id=canonical_id,
    )
    profile = PokemonProfile.objects.create(
        version=version,
        regulation=regulation,
        form=form,
        hp=50,
        attack=50,
        defense=50,
        special_attack=50,
        special_defense=50,
        speed=50,
        bst=300,
    )
    RegulationMembership.objects.create(profile=profile)
    return profile


def _team(owner: User, regulation: Regulation, profile: PokemonProfile, name: str) -> Team:
    nature = Nature.objects.get(version=regulation.version, canonical_id="serious")
    team = Team.objects.create(owner=owner, regulation=regulation, name=name)
    TeamMember.objects.create(
        team=team,
        position=0,
        profile=profile,
        species_form=profile.form.base_form,
        nature=nature,
    )
    return team


def _add_member(team: Team, profile: PokemonProfile, position: int) -> None:
    nature = Nature.objects.get(version=team.regulation.version, canonical_id="serious")
    TeamMember.objects.create(
        team=team,
        position=position,
        profile=profile,
        species_form=profile.form.base_form,
        nature=nature,
    )


@pytest.fixture
def battle_data() -> dict[str, Any]:
    version = _version("showdown-battle-test-s5-i6-0123456789ab")
    regulation = _regulation(version)
    base_profile = _profile(version, regulation, "pikachu")
    alternate_profile = _profile(
        version,
        regulation,
        "pikachurockstar",
        base_form=base_profile.form,
    )
    CalculatorCapability.objects.create(
        version=version,
        canonical_id="damage-calculator-v1",
        contract={},
    )
    extra_profiles = [_profile(version, regulation, f"species{index}") for index in range(12)]
    _load(version)
    activate_pokemon_data(version.pk)
    return {
        "version": version,
        "regulation": regulation,
        "profile": base_profile,
        "alternate_profile": alternate_profile,
        "extra_profiles": extra_profiles,
    }


@pytest.fixture
def battle_data_without_capability() -> dict[str, Any]:
    version = _version("showdown-battle-no-capability-s5-i6-0123456789ab")
    regulation = _regulation(version)
    _profile(version, regulation, "pikachu")
    _load(version)
    activate_pokemon_data(version.pk)
    return {"version": version, "regulation": regulation}


@pytest.fixture
def authenticated_client(client: Client) -> Client:
    user = User.objects.create_user(username="battle-user", password="test-password")
    client.force_login(user)
    return client


@pytest.mark.django_db
def test_battle_mode_requires_authentication(client: Client) -> None:
    response = client.get("/battle-mode/?regulation=m-c")
    assert response.status_code == 302
    assert response.headers["Location"] == "/login/?next=/battle-mode/%3Fregulation%3Dm-c"


@pytest.mark.django_db
def test_battle_mode_rejects_invalid_regulation_and_method(
    battle_data: dict[str, Any], authenticated_client: Client
) -> None:
    invalid = authenticated_client.get("/battle-mode/?regulation=not-real")
    duplicate = authenticated_client.get("/battle-mode/?regulation=m-c&regulation=m-b")
    method = authenticated_client.post("/battle-mode/?regulation=m-c")
    assert invalid.status_code == 400
    assert duplicate.status_code == 400
    assert method.status_code == 405


@pytest.mark.django_db
def test_battle_mode_fails_closed_without_active_data(authenticated_client: Client) -> None:
    response = authenticated_client.get("/battle-mode/?regulation=m-c")
    assert response.status_code == 503
    assert "No Pokémon data version is active." in response.content.decode()


@pytest.mark.django_db
def test_battle_mode_fails_closed_without_calculator_capability(
    battle_data_without_capability: dict[str, Any], authenticated_client: Client
) -> None:
    response = authenticated_client.get("/battle-mode/?regulation=m-c")
    assert response.status_code == 503
    assert "does not support Battle Mode" in response.content.decode()


@pytest.mark.django_db
def test_battle_mode_fails_closed_when_requested_regulation_is_absent(
    battle_data: dict[str, Any], authenticated_client: Client
) -> None:
    response = authenticated_client.get("/battle-mode/?regulation=m-b")
    assert response.status_code == 503
    assert "does not support Battle Mode" in response.content.decode()


@pytest.mark.django_db
def test_battle_bootstrap_is_exact_private_and_species_aware(
    battle_data: dict[str, Any], authenticated_client: Client
) -> None:
    user = User.objects.get(username="battle-user")
    eligible = _team(user, battle_data["regulation"], battle_data["profile"], "Current team")
    other_user = User.objects.create_user(username="other-user", password="test-password")
    _team(other_user, battle_data["regulation"], battle_data["profile"], "Private team")

    old_version = _version("showdown-battle-test-old-s5-i6-0123456789ab")
    old_regulation = _regulation(old_version, "Old Regulation M-C")
    old_profile = _profile(old_version, old_regulation, "oldpikachu")
    _load(old_version)
    _team(user, old_regulation, old_profile, "Historical team")

    response = authenticated_client.get("/battle-mode/?regulation=m-c")
    assert response.status_code == 200
    bootstrap = response.context["battle_mode_bootstrap"]
    assert bootstrap == {
        "schema_version": "battle-mode-bootstrap-v1",
        "active_version": battle_data["version"].pk,
        "regulation": {"id": "m-c", "name": "Regulation M-C"},
        "teams": [
            {
                "id": str(eligible.pk),
                "name": "Current team",
                "pinned_version": battle_data["version"].pk,
                "regulation": {"id": "m-c", "name": "Regulation M-C"},
                "members": [
                    {
                        "position": 0,
                        "sprite_url": (
                            f"/pokedex/sprites/{battle_data['version'].pk}/pikachu/normal.webp"
                        ),
                    }
                ],
                "updated_at": eligible.updated_at.isoformat(),
            }
        ],
        "dataset_url": (f"/damage-calculator/data/{battle_data['version'].pk}/m-c/"),
        "team_url_template": "/teams/__TEAM__/",
        "team_builder_url": "/teams/?regulation=m-c",
        "base_species_by_form": {
            "pikachu": "pikachu",
            "pikachurockstar": "pikachu",
            **{f"species{index}": f"species{index}" for index in range(12)},
        },
    }
    assert response.context["regulation_selector"]["selected_id"] == "m-c"
    assert "Private team" not in response.content.decode()
    assert "Historical team" not in response.content.decode()


@pytest.mark.django_db
def test_battle_mode_queries_are_bounded_by_team_and_member_count(
    battle_data: dict[str, Any], authenticated_client: Client
) -> None:
    user = User.objects.get(username="battle-user")
    with CaptureQueriesContext(connection) as empty_queries:
        empty_response = authenticated_client.get("/battle-mode/?regulation=m-c")
    assert empty_response.status_code == 200
    assert empty_response.context["battle_mode_bootstrap"]["teams"] == []

    profiles = battle_data["extra_profiles"][:6]
    full_team = _team(user, battle_data["regulation"], profiles[0], "Full team")
    for position, profile in enumerate(profiles[1:], start=1):
        _add_member(full_team, profile, position)
    with CaptureQueriesContext(connection) as full_team_queries:
        full_team_response = authenticated_client.get("/battle-mode/?regulation=m-c")
    assert full_team_response.status_code == 200
    assert len(full_team_response.context["battle_mode_bootstrap"]["teams"][0]["members"]) == 6

    for index, profile in enumerate(battle_data["extra_profiles"][6:]):
        _team(user, battle_data["regulation"], profile, f"Team {index}")
    with CaptureQueriesContext(connection) as populated_queries:
        assert authenticated_client.get("/battle-mode/?regulation=m-c").status_code == 200
    assert len(empty_queries) <= 15
    assert len(full_team_queries) == len(empty_queries)
    assert len(populated_queries) == len(empty_queries)

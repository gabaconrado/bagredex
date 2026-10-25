"""Request and bootstrap tests for the read-only Battle Mode backend."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any, cast

import pytest
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from bagredex.accounts.models import User
from bagredex.battle_mode.bootstrap import INVALID_TEAM_REASON, _battle_readiness
from bagredex.pokemon_data.models import (
    Ability,
    AbilityProfile,
    CalculatorCapability,
    DataVersion,
    Item,
    ItemProfile,
    LearnsetEntry,
    MechanicsProfile,
    Move,
    MoveProfile,
    Nature,
    PokemonForm,
    PokemonProfile,
    PokemonProfileAbility,
    Regulation,
    RegulationMembership,
    Type,
)
from bagredex.pokemon_data.services import activate_pokemon_data
from bagredex.teams.models import Team, TeamMember, TeamMemberMove


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
    ability = Ability.objects.create(
        version=version,
        canonical_id=f"{canonical_id}-ability",
        name=f"{canonical_id.title()} Ability",
    )
    ability_profile = AbilityProfile.objects.create(
        version=version,
        regulation=regulation,
        ability=ability,
        short_description="Test ability.",
        description="Test ability.",
    )
    PokemonProfileAbility.objects.create(
        profile=profile,
        ability_profile=ability_profile,
        slot="0",
    )
    return profile


def _ability_for(profile: PokemonProfile) -> AbilityProfile:
    return AbilityProfile.objects.get(pokemonprofileability__profile=profile)


def _team(owner: User, regulation: Regulation, profile: PokemonProfile, name: str) -> Team:
    nature = Nature.objects.get(version=regulation.version, canonical_id="serious")
    team = Team.objects.create(owner=owner, regulation=regulation, name=name)
    TeamMember.objects.create(
        team=team,
        position=0,
        profile=profile,
        species_form=profile.form.base_form,
        ability_profile=_ability_for(profile),
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
        ability_profile=_ability_for(profile),
        nature=nature,
    )


def _item_profile(regulation: Regulation, identifier: str) -> ItemProfile:
    item = Item.objects.create(
        version=regulation.version,
        canonical_id=identifier,
        name=identifier.title(),
    )
    return ItemProfile.objects.create(
        version=regulation.version,
        regulation=regulation,
        item=item,
        source_status="standard",
    )


def _move_profile(
    regulation: Regulation,
    identifier: str,
    learned_by: PokemonProfile,
) -> MoveProfile:
    move_type, _ = Type.objects.get_or_create(
        version=regulation.version,
        canonical_id="normal",
        defaults={"name": "Normal"},
    )
    move = Move.objects.create(
        version=regulation.version,
        canonical_id=identifier,
        name=identifier.title(),
    )
    profile = MoveProfile.objects.create(
        version=regulation.version,
        regulation=regulation,
        move=move,
        type=move_type,
        category=MoveProfile.Category.PHYSICAL,
        base_power=40,
        accuracy=100,
        pp=20,
        priority=0,
        target="normal",
        short_description="Test move.",
        description="Test move.",
    )
    LearnsetEntry.objects.create(
        profile=learned_by,
        move_profile=profile,
        form_resolution=LearnsetEntry.FormResolution.DIRECT,
        source_form=learned_by.form,
        source_mod=LearnsetEntry.SourceMod.CHAMPIONS,
        source_kind=LearnsetEntry.SourceKind.DIRECT,
    )
    return profile


def _summary(response: Any, team: Team) -> dict[str, Any]:
    summaries = response.context["battle_mode_bootstrap"]["teams"]
    return next(summary for summary in summaries if summary["id"] == str(team.pk))


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
    invalid_neutral_nature = Nature.objects.create(
        version=version,
        canonical_id="invalid-neutral",
        name="Invalid Neutral",
        increased_stat=None,
        decreased_stat=None,
    )
    item_profiles = {
        identifier: _item_profile(regulation, identifier)
        for identifier in ("duplicate-item", "query-item")
    }
    move_profiles = {
        "unlearned-move": _move_profile(
            regulation,
            "unlearned-move",
            extra_profiles[2],
        ),
        "duplicate-move": _move_profile(
            regulation,
            "duplicate-move",
            extra_profiles[0],
        ),
        "query-move": _move_profile(
            regulation,
            "query-move",
            extra_profiles[0],
        ),
    }
    _load(version)
    activate_pokemon_data(version.pk)
    return {
        "version": version,
        "regulation": regulation,
        "profile": base_profile,
        "alternate_profile": alternate_profile,
        "extra_profiles": extra_profiles,
        "invalid_neutral_nature": invalid_neutral_nature,
        "item_profiles": item_profiles,
        "move_profiles": move_profiles,
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
        "schema_version": "battle-mode-bootstrap-v2",
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
                "battle_ready": True,
                "battle_unavailable_reason": None,
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
def test_battle_bootstrap_reports_authoritative_team_readiness(
    battle_data: dict[str, Any], authenticated_client: Client
) -> None:
    user = User.objects.get(username="battle-user")
    ready = _team(user, battle_data["regulation"], battle_data["profile"], "Ready team")
    empty = Team.objects.create(
        owner=user,
        regulation=battle_data["regulation"],
        name="Empty team",
    )
    missing_ability = _team(
        user,
        battle_data["regulation"],
        battle_data["extra_profiles"][0],
        "Missing ability",
    )
    TeamMember.objects.filter(team=missing_ability).update(ability_profile=None)

    response = authenticated_client.get("/battle-mode/?regulation=m-c")

    assert response.status_code == 200
    summaries = {
        summary["id"]: summary for summary in response.context["battle_mode_bootstrap"]["teams"]
    }
    assert summaries[str(ready.pk)]["battle_ready"] is True
    assert summaries[str(ready.pk)]["battle_unavailable_reason"] is None
    assert summaries[str(empty.pk)]["battle_ready"] is False
    assert summaries[str(empty.pk)]["battle_unavailable_reason"] == "Add at least one Pokémon."
    assert summaries[str(missing_ability.pk)]["battle_ready"] is False
    assert summaries[str(missing_ability.pk)]["battle_unavailable_reason"] == (
        "Choose an ability for every Pokémon."
    )


@pytest.mark.django_db
def test_battle_readiness_allows_missing_optional_item_and_moves(
    battle_data: dict[str, Any], authenticated_client: Client
) -> None:
    user = User.objects.get(username="battle-user")
    team = _team(user, battle_data["regulation"], battle_data["profile"], "Unknown details")
    member = TeamMember.objects.get(team=team)
    assert member.item_profile_id is None
    assert not member.moves.exists()

    response = authenticated_client.get("/battle-mode/?regulation=m-c")

    assert response.status_code == 200
    assert _summary(response, team)["battle_ready"] is True
    assert _summary(response, team)["battle_unavailable_reason"] is None


@pytest.mark.django_db
def test_battle_readiness_rejects_stale_and_illegal_member_contexts(
    battle_data: dict[str, Any], authenticated_client: Client
) -> None:
    user = User.objects.get(username="battle-user")
    regulation = battle_data["regulation"]
    profile = battle_data["profile"]

    old_version = _version("showdown-battle-invalid-old-s5-i6-0123456789ab")
    old_regulation = _regulation(old_version, "Old Regulation M-C")
    old_profile = _profile(old_version, old_regulation, "oldspecies")
    old_item = _item_profile(old_regulation, "old-item")
    old_move = _move_profile(old_regulation, "old-move", old_profile)

    stale_profile = _team(user, regulation, profile, "Stale profile")
    TeamMember.objects.filter(team=stale_profile).update(
        profile=old_profile,
        species_form=old_profile.form,
        ability_profile=_ability_for(old_profile),
        nature=Nature.objects.get(version=old_version, canonical_id="serious"),
    )
    wrong_form = _team(user, regulation, profile, "Wrong form")
    TeamMember.objects.filter(team=wrong_form).update(
        species_form=battle_data["extra_profiles"][0].form
    )
    wrong_nature = _team(user, regulation, profile, "Wrong nature")
    TeamMember.objects.filter(team=wrong_nature).update(
        nature=battle_data["invalid_neutral_nature"]
    )
    wrong_ability = _team(user, regulation, profile, "Wrong ability")
    TeamMember.objects.filter(team=wrong_ability).update(
        ability_profile=_ability_for(battle_data["extra_profiles"][1])
    )
    wrong_item = _team(user, regulation, profile, "Wrong item")
    TeamMember.objects.filter(team=wrong_item).update(item_profile=old_item)
    wrong_move = _team(user, regulation, profile, "Wrong move regulation")
    TeamMemberMove.objects.create(
        member=TeamMember.objects.get(team=wrong_move),
        position=0,
        move_profile=old_move,
    )
    learnset_mismatch = _team(user, regulation, profile, "Move not learned")
    TeamMemberMove.objects.create(
        member=TeamMember.objects.get(team=learnset_mismatch),
        position=0,
        move_profile=battle_data["move_profiles"]["unlearned-move"],
    )
    excessive_sp = _team(user, regulation, profile, "Too many stat points")
    TeamMember.objects.filter(team=excessive_sp).update(sp_hp=32, sp_attack=32, sp_defense=32)
    invalid_mega = _team(user, regulation, profile, "Invalid Mega")
    TeamMember.objects.filter(team=invalid_mega).update(mega_preview=True)

    response = authenticated_client.get("/battle-mode/?regulation=m-c")

    assert response.status_code == 200
    expectations = (
        (stale_profile, "Choose an ability for every Pokémon."),
        (wrong_ability, "Choose an ability for every Pokémon."),
        (wrong_form, "Update invalid Pokémon details in Team Builder."),
        (wrong_nature, "Update invalid Pokémon details in Team Builder."),
        (wrong_item, "Update invalid Pokémon details in Team Builder."),
        (wrong_move, "Update invalid Pokémon details in Team Builder."),
        (learnset_mismatch, "Update invalid Pokémon details in Team Builder."),
        (excessive_sp, "Update invalid Pokémon details in Team Builder."),
        (invalid_mega, "Update invalid Pokémon details in Team Builder."),
    )
    for team, reason in expectations:
        assert _summary(response, team)["battle_ready"] is False
        assert _summary(response, team)["battle_unavailable_reason"] == reason


@pytest.mark.django_db
def test_battle_readiness_defensively_rejects_duplicate_species_items_and_moves(
    battle_data: dict[str, Any], django_user_model: Any
) -> None:
    user = django_user_model.objects.create_user(username="duplicate-readiness")
    regulation = battle_data["regulation"]
    profiles = battle_data["extra_profiles"][:2]
    team = _team(user, regulation, profiles[0], "Duplicate defensive checks")
    _add_member(team, profiles[1], 1)
    members = list(TeamMember.objects.filter(team=team).order_by("position"))
    for member in members:
        cast_profile = cast(Any, member.profile)
        cast_member = cast(Any, member)
        cast_profile._battle_abilities = list(member.profile.abilities.all())
        cast_member._battle_moves = []

    members[1].species_form_id = members[0].species_form_id
    assert _battle_readiness(team, members) == (False, INVALID_TEAM_REASON)
    members[1].species_form_id = members[1].profile.form.base_form_id

    item = battle_data["item_profiles"]["duplicate-item"]
    cast(Any, item)._battle_mega_relations = []
    for member in members:
        member.item_profile = item
        member.item_profile_id = item.pk
    assert _battle_readiness(team, members) == (False, INVALID_TEAM_REASON)
    for member in members:
        member.item_profile = None
        member.item_profile_id = None

    move = battle_data["move_profiles"]["duplicate-move"]
    entry = LearnsetEntry.objects.get(move_profile=move)
    cast(Any, move)._battle_learnset_entries = [entry]
    cast(Any, members[0])._battle_moves = [
        SimpleNamespace(position=0, move_profile=move),
        SimpleNamespace(position=1, move_profile=move),
    ]
    assert _battle_readiness(team, members) == (False, INVALID_TEAM_REASON)


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
    populated_member = TeamMember.objects.get(team=full_team, position=0)
    populated_member.item_profile = battle_data["item_profiles"]["query-item"]
    populated_member.save(update_fields=("item_profile",))
    TeamMemberMove.objects.create(
        member=populated_member,
        position=0,
        move_profile=battle_data["move_profiles"]["query-move"],
    )
    with CaptureQueriesContext(connection) as full_team_queries:
        full_team_response = authenticated_client.get("/battle-mode/?regulation=m-c")
    assert full_team_response.status_code == 200
    assert len(full_team_response.context["battle_mode_bootstrap"]["teams"][0]["members"]) == 6
    assert full_team_response.context["battle_mode_bootstrap"]["teams"][0]["battle_ready"] is True

    for index, profile in enumerate(battle_data["extra_profiles"][6:]):
        _team(user, battle_data["regulation"], profile, f"Team {index}")
    with CaptureQueriesContext(connection) as populated_queries:
        assert authenticated_client.get("/battle-mode/?regulation=m-c").status_code == 200
    assert len(empty_queries) <= 15
    assert len(full_team_queries) <= 20
    assert len(populated_queries) == len(full_team_queries)

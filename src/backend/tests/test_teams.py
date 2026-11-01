"""Observable behavior tests for private team aggregates."""

from __future__ import annotations

import json
import uuid
from datetime import timedelta
from typing import Any

import pytest
from django.conf import settings
from django.db import IntegrityError, connection, transaction
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from bagredex.accounts.models import User
from bagredex.pokedex import Snapshot
from bagredex.pokemon_data.models import (
    Ability,
    AbilityProfile,
    DataVersion,
    Item,
    ItemProfile,
    LearnsetEntry,
    MechanicsProfile,
    MegaItemRelation,
    Move,
    MoveFlag,
    MoveFlagRelation,
    MoveProfile,
    Nature,
    PokemonForm,
    PokemonProfile,
    PokemonProfileAbility,
    Regulation,
    RegulationMembership,
    Type,
)
from bagredex.pokemon_data.services import activate_pokemon_data, load_pokemon_data
from bagredex.teams.datasets import builder_dataset
from bagredex.teams.models import Team, TeamMember, TeamMemberMove
from bagredex.teams.services import replace_team


@pytest.fixture
def team_data() -> dict[str, Any]:
    version = DataVersion.objects.create(
        id="showdown-team-test-s4-i5-0123456789ab",
        bundle_hash="a" * 64,
        bundle_schema_version="4",
        importer_version="5",
        source_shape_version="test",
        provenance={},
        validation_summary={},
        semantic_inventory={},
        semantic_diff={},
        manifest={},
    )
    mechanics = MechanicsProfile.objects.create(
        version=version,
        canonical_id="champions",
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
        name="Regulation M-C",
        showdown_format_id="gen9vgc2026regc",
        mod="champions",
        ruleset=[],
        mechanics_profile=mechanics,
    )
    historical_regulation = Regulation.objects.create(
        version=version,
        canonical_id="m-b",
        name="Regulation M-B",
        showdown_format_id="gen9vgc2026regb",
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
    Nature.objects.create(
        version=version,
        canonical_id="adamant",
        name="Adamant",
        increased_stat="atk",
        decreased_stat="spa",
    )
    form_id = uuid.uuid4()
    form = PokemonForm.objects.create(
        id=form_id,
        version=version,
        canonical_id="pikachu",
        name="Pikachu",
        national_dex_number=25,
        base_form_id=form_id,
        form_label="",
        is_mega=False,
        sprite_id="pikachu",
    )
    profile = PokemonProfile.objects.create(
        version=version,
        regulation=regulation,
        form=form,
        hp=35,
        attack=55,
        defense=40,
        special_attack=50,
        special_defense=50,
        speed=90,
        bst=320,
    )
    RegulationMembership.objects.create(profile=profile)
    electric = Type.objects.create(version=version, canonical_id="electric", name="Electric")
    ability = Ability.objects.create(version=version, canonical_id="static", name="Static")
    ability_profile = AbilityProfile.objects.create(
        version=version,
        regulation=regulation,
        ability=ability,
        short_description="May paralyze.",
        description="May paralyze on contact.",
    )
    PokemonProfileAbility.objects.create(profile=profile, ability_profile=ability_profile, slot="0")
    move = Move.objects.create(version=version, canonical_id="thunderbolt", name="Thunderbolt")
    move_profile = MoveProfile.objects.create(
        version=version,
        regulation=regulation,
        move=move,
        type=electric,
        category=MoveProfile.Category.SPECIAL,
        base_power=90,
        accuracy=100,
        always_hits=False,
        pp=15,
        priority=0,
        target="normal",
        short_description="May paralyze.",
        description="May paralyze the target.",
    )
    protect_flag = MoveFlag.objects.create(
        version=version,
        canonical_id="protect",
    )
    contact_flag = MoveFlag.objects.create(
        version=version,
        canonical_id="contact",
    )
    MoveFlagRelation.objects.create(move_profile=move_profile, flag=protect_flag)
    MoveFlagRelation.objects.create(move_profile=move_profile, flag=contact_flag)
    LearnsetEntry.objects.create(
        profile=profile,
        move_profile=move_profile,
        form_resolution=LearnsetEntry.FormResolution.DIRECT,
        source_form=form,
        source_mod=LearnsetEntry.SourceMod.CHAMPIONS,
        source_kind=LearnsetEntry.SourceKind.DIRECT,
    )
    stone = Item.objects.create(version=version, canonical_id="pikachunite", name="Pikachunite")
    stone_profile = ItemProfile.objects.create(
        version=version,
        regulation=regulation,
        item=stone,
        source_status="standard",
        short_description="Enables Mega Evolution.",
        description="Enables Pikachu to Mega Evolve.",
        description_source=ItemProfile.DescriptionSource.DESC,
    )
    ordinary_item = Item.objects.create(
        version=version, canonical_id="oranberry", name="Oran Berry"
    )
    ItemProfile.objects.create(
        version=version,
        regulation=regulation,
        item=ordinary_item,
        source_status="standard",
        short_description="Restores HP.",
        description="Restores HP.",
        description_source=ItemProfile.DescriptionSource.SHORT_DESC,
    )
    mega = PokemonForm.objects.create(
        version=version,
        canonical_id="pikachumega",
        name="Pikachu-Mega",
        national_dex_number=25,
        base_form=form,
        form_label="Mega",
        is_mega=True,
        sprite_id="pikachumega",
    )
    mega_profile = PokemonProfile.objects.create(
        version=version,
        regulation=regulation,
        form=mega,
        hp=45,
        attack=75,
        defense=50,
        special_attack=80,
        special_defense=60,
        speed=110,
        bst=420,
    )
    PokemonProfileAbility.objects.create(
        profile=mega_profile, ability_profile=ability_profile, slot="0"
    )
    MegaItemRelation.objects.create(
        version=version,
        regulation=regulation,
        item_profile=stone_profile,
        base_form=form,
        mega_form=mega,
    )
    alternate = PokemonForm.objects.create(
        version=version,
        canonical_id="pikachurockstar",
        name="Pikachu-Rock-Star",
        national_dex_number=25,
        base_form=form,
        form_label="Rock Star",
        is_mega=False,
        sprite_id="pikachurockstar",
    )
    alternate_profile = PokemonProfile.objects.create(
        version=version,
        regulation=regulation,
        form=alternate,
        hp=35,
        attack=55,
        defense=40,
        special_attack=50,
        special_defense=50,
        speed=90,
        bst=320,
    )
    RegulationMembership.objects.create(profile=alternate_profile)
    extra_profiles: list[PokemonProfile] = []
    for index in range(1, 6):
        extra_form_id = uuid.uuid4()
        extra_form = PokemonForm.objects.create(
            id=extra_form_id,
            version=version,
            canonical_id=f"species{index}",
            name=f"Species {index}",
            national_dex_number=100 + index,
            base_form_id=extra_form_id,
            form_label="",
            is_mega=False,
            sprite_id=f"species{index}",
        )
        extra_profile = PokemonProfile.objects.create(
            version=version,
            regulation=regulation,
            form=extra_form,
            hp=50,
            attack=50,
            defense=50,
            special_attack=50,
            special_defense=50,
            speed=50,
            bst=300,
        )
        RegulationMembership.objects.create(profile=extra_profile)
        extra_profiles.append(extra_profile)
    DataVersion.objects.filter(pk=version.pk).update(status=DataVersion.Status.LOADED)
    version.status = DataVersion.Status.LOADED
    activate_pokemon_data(version.pk)
    return {
        "version": version,
        "regulation": regulation,
        "historical_regulation": historical_regulation,
        "profile": profile,
        "nature": Nature.objects.get(canonical_id="serious"),
        "alternate_profile": alternate_profile,
        "extra_profiles": extra_profiles,
    }


def _draft(team_data: dict[str, Any], name: str = "Rain") -> dict[str, Any]:
    return {
        "schema_version": "team-draft-v1",
        "version": team_data["version"].pk,
        "regulation": "m-c",
        "name": name,
        "members": [],
    }


def _member(**overrides: Any) -> dict[str, Any]:
    member = {
        "position": 0,
        "pokemon": "pikachu",
        "nickname": "Sparky",
        "ability": "static",
        "item": "pikachunite",
        "moves": [None, "thunderbolt", None, None],
        "nature": "serious",
        "sp": {
            "hp": 1,
            "attack": 2,
            "defense": 3,
            "special_attack": 4,
            "special_defense": 5,
            "speed": 6,
        },
        "shiny": True,
        "mega_preview": False,
    }
    member.update(overrides)
    return member


def _retained_snapshot(
    identifier: str, regulation_id: str = "m-c", *, supported_mechanics: bool = True
) -> Regulation:
    version = DataVersion.objects.create(
        id=identifier,
        bundle_hash="b" * 64,
        bundle_schema_version="3",
        importer_version="4",
        source_shape_version="test",
        provenance={},
        validation_summary={},
        semantic_inventory={},
        semantic_diff={},
        manifest={},
    )
    mechanics = MechanicsProfile.objects.create(
        version=version,
        canonical_id="champions",
        level=50,
        sp_minimum=0,
        sp_maximum=32,
        sp_total_max=66,
        hp_formula="base + sp + 75",
        other_formula="truncate((base + sp + 20) * nature_percent / 100)",
        nature_percentages=(
            {"hindering": 90, "neutral": 100, "increasing": 110}
            if supported_mechanics
            else {"hindering": 80, "neutral": 100, "increasing": 120}
        ),
    )
    regulation = Regulation.objects.create(
        version=version,
        canonical_id=regulation_id,
        name=f"Regulation {regulation_id.upper()}",
        showdown_format_id=f"retained-{regulation_id}",
        mod="champions",
        ruleset=[],
        mechanics_profile=mechanics,
    )
    Nature.objects.create(
        version=version,
        canonical_id="foreignnature",
        name="Foreign Nature",
        increased_stat="atk",
        decreased_stat="def",
    )
    form_id = uuid.uuid4()
    form = PokemonForm.objects.create(
        id=form_id,
        version=version,
        canonical_id="foreignmon",
        name="Foreignmon",
        national_dex_number=999,
        base_form_id=form_id,
        form_label="",
        is_mega=False,
        sprite_id="foreignmon",
    )
    foreign_profile = PokemonProfile.objects.create(
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
    RegulationMembership.objects.create(profile=foreign_profile)
    ability = Ability.objects.create(
        version=version, canonical_id="foreignability", name="Foreign Ability"
    )
    AbilityProfile.objects.create(
        version=version,
        regulation=regulation,
        ability=ability,
        short_description="Foreign.",
        description="Foreign.",
    )
    item = Item.objects.create(version=version, canonical_id="foreignitem", name="Foreign Item")
    ItemProfile.objects.create(
        version=version, regulation=regulation, item=item, source_status="standard"
    )
    move = Move.objects.create(version=version, canonical_id="foreignmove", name="Foreign Move")
    foreign_type = Type.objects.create(version=version, canonical_id="foreign", name="Foreign")
    MoveProfile.objects.create(
        version=version,
        regulation=regulation,
        move=move,
        type=foreign_type,
        category=MoveProfile.Category.STATUS,
        base_power=0,
        accuracy=100,
        always_hits=False,
        pp=10,
        priority=0,
        target="normal",
        short_description="Foreign.",
        description="Foreign.",
    )
    DataVersion.objects.filter(pk=version.pk).update(status=DataVersion.Status.LOADED)
    version.status = DataVersion.Status.LOADED
    return regulation


@pytest.mark.django_db
def test_create_read_replace_and_delete_private_team(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="owner", password="password")
    other = User.objects.create_user(username="other", password="password")
    client = Client()
    client.force_login(owner)

    created = client.post(
        "/teams/", data=json.dumps(_draft(team_data)), content_type="application/json"
    )
    assert created.status_code == 201
    aggregate = created.json()["data"]
    assert aggregate["pinned"]["version"] == team_data["version"].pk
    assert aggregate["members"] == []

    team_url = f"/teams/{aggregate['id']}/"
    assert client.get(team_url).json()["data"]["name"] == "Rain"
    changed = _draft(team_data, "Sun")
    assert (
        client.put(team_url, data=json.dumps(changed), content_type="application/json").status_code
        == 200
    )

    client.force_login(other)
    concealed = client.get(team_url)
    assert concealed.status_code == 404
    assert concealed.json()["error"]["code"] == "team-not-found"

    client.force_login(owner)
    assert client.delete(team_url).status_code == 204
    assert not Team.objects.exists()


@pytest.mark.django_db
def test_duplicate_names_are_case_insensitive_per_owner(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="owner")
    client = Client()
    client.force_login(owner)
    assert (
        client.post(
            "/teams/", data=json.dumps(_draft(team_data, "Rain")), content_type="application/json"
        ).status_code
        == 201
    )
    response = client.post(
        "/teams/", data=json.dumps(_draft(team_data, "rain")), content_type="application/json"
    )
    assert response.status_code == 400
    assert response.json()["error"]["fields"]["name"]


@pytest.mark.django_db
def test_member_validation_reports_stable_field_paths(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="owner")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [
        {
            "position": 0,
            "pokemon": "pikachu",
            "nickname": "",
            "ability": None,
            "item": None,
            "moves": [None, None, None, None],
            "nature": "serious",
            "sp": {
                "hp": 32,
                "attack": 32,
                "defense": 3,
                "special_attack": 0,
                "special_defense": 0,
                "speed": 0,
            },
            "shiny": False,
            "mega_preview": False,
        }
    ]
    response = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert response.status_code == 400
    assert response.json()["error"]["fields"]["members.0.sp"] == [
        "Allocate no more than 66 SP total."
    ]


@pytest.mark.django_db
def test_member_round_trips_move_slots_and_exact_base_and_mega_stats(
    team_data: dict[str, Any],
) -> None:
    owner = User.objects.create_user(username="golden")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [_member()]
    base = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert base.status_code == 201
    member = base.json()["data"]["members"][0]
    assert member["moves"] == [None, "thunderbolt", None, None]
    assert member["stats"] == {
        "hp": 111,
        "attack": 77,
        "defense": 63,
        "special_attack": 74,
        "special_defense": 75,
        "speed": 116,
    }
    draft["members"] = [_member(mega_preview=True)]
    mega = client.put(
        f"/teams/{base.json()['data']['id']}/",
        data=json.dumps(draft),
        content_type="application/json",
    )
    assert mega.status_code == 200
    mega_member = mega.json()["data"]["members"][0]
    assert mega_member["mega_target"] == "pikachumega"
    assert mega_member["stats"] == {
        "hp": 121,
        "attack": 97,
        "defense": 73,
        "special_attack": 104,
        "special_defense": 85,
        "speed": 136,
    }


@pytest.mark.django_db
def test_nature_increasing_and_hindering_stats_truncate(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="nature-golden")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [_member(nature="adamant")]
    response = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert response.status_code == 201
    stats = response.json()["data"]["members"][0]["stats"]
    assert stats["attack"] == 84
    assert stats["special_attack"] == 66


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("change", "path"),
    [
        ({"ability": "missing"}, "members.0.ability"),
        ({"item": "missing"}, "members.0.item"),
        ({"moves": ["missing", None, None, None]}, "members.0.moves.0"),
        ({"moves": ["thunderbolt", "thunderbolt", None, None]}, "members.0.moves.1"),
        ({"nickname": "x" * 11}, "members.0.nickname"),
        ({"nature": "missing"}, "members.0.nature"),
        ({"mega_preview": True, "item": None}, "members.0.mega_preview"),
    ],
)
def test_member_legality_errors_have_stable_paths(
    team_data: dict[str, Any], change: dict[str, Any], path: str
) -> None:
    owner = User.objects.create_user(username=f"invalid-{path}-{len(str(change))}")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [_member(**change)]
    response = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert response.status_code == 400
    assert path in response.json()["error"]["fields"]


@pytest.mark.django_db
@pytest.mark.parametrize("nickname", ["", "x" * 10])
def test_nickname_write_limit_accepts_up_to_ten_characters(
    team_data: dict[str, Any], nickname: str
) -> None:
    owner = User.objects.create_user(username=f"nickname-valid-{len(nickname)}")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [_member(nickname=nickname)]

    response = client.post("/teams/", data=json.dumps(draft), content_type="application/json")

    assert response.status_code == 201
    assert response.json()["data"]["members"][0]["nickname"] == nickname


@pytest.mark.django_db
def test_nickname_write_limit_rejects_eleven_and_preserves_legacy_values(
    team_data: dict[str, Any],
) -> None:
    owner = User.objects.create_user(username="nickname-limit")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [_member(nickname="x" * 11)]

    rejected_create = client.post(
        "/teams/", data=json.dumps(draft), content_type="application/json"
    )

    assert rejected_create.status_code == 400
    assert rejected_create.json()["error"]["fields"]["members.0.nickname"] == [
        "Use at most 10 characters."
    ]
    assert not Team.objects.filter(owner=owner).exists()

    draft["members"] = [_member(nickname="before")]
    created = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert created.status_code == 201
    team_id = created.json()["data"]["id"]
    draft["members"] = [_member(nickname="y" * 11)]

    rejected_update = client.put(
        f"/teams/{team_id}/", data=json.dumps(draft), content_type="application/json"
    )

    assert rejected_update.status_code == 400
    assert rejected_update.json()["error"]["fields"]["members.0.nickname"] == [
        "Use at most 10 characters."
    ]
    member = TeamMember.objects.get(team_id=team_id)
    assert member.nickname == "before"

    TeamMember.objects.filter(pk=member.pk).update(nickname="legacy-value")
    legacy = client.get(f"/teams/{team_id}/")
    assert legacy.status_code == 200
    assert legacy.json()["data"]["members"][0]["nickname"] == "legacy-value"


@pytest.mark.django_db
def test_anonymous_team_requests_redirect_to_login(team_data: dict[str, Any]) -> None:
    response = Client().get("/teams/?regulation=m-c")
    assert response.status_code == 302
    assert response.headers["Location"].startswith("/login/")


@pytest.mark.django_db
def test_team_page_canonicalizes_latest_and_keeps_historical_selection_explicit(
    team_data: dict[str, Any],
) -> None:
    owner = User.objects.create_user(username="team-regulation-urls")
    client = Client()
    client.force_login(owner)

    canonical = client.get("/teams/?tag=first&tag=second&regulation=m-c")

    assert canonical.status_code == 302
    assert canonical.headers["Location"] == "/teams/?tag=first&tag=second"
    historical = client.get("/teams/?tag=first&regulation=m-b")
    assert historical.status_code == 200
    assert historical.context["team_builder_bootstrap"]["regulation"]["id"] == "m-b"
    selector = historical.context["regulation_selector"]
    assert selector["navigation_suffix"] == "?regulation=m-b"
    assert next(choice for choice in selector["choices"] if choice["id"] == "m-c")["url"] == (
        "/teams/?tag=first"
    )
    assert next(choice for choice in selector["choices"] if choice["id"] == "m-b")["url"] == (
        "/teams/?tag=first&regulation=m-b"
    )
    assert client.get("/teams/?regulation=m-a").status_code == 400


@pytest.mark.django_db
def test_team_page_validates_latest_mechanics_before_canonical_redirect(
    team_data: dict[str, Any],
) -> None:
    unsupported = _retained_snapshot(
        "showdown-unsupported-active-s3-i4-666666666666",
        supported_mechanics=False,
    )
    activate_pokemon_data(unsupported.version_id)
    owner = User.objects.create_user(username="team-unsupported-latest")
    client = Client()
    client.force_login(owner)

    implicit = client.get("/teams/")
    explicit = client.get("/teams/?regulation=m-c")

    assert implicit.status_code == 503
    assert explicit.status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("name", "status", "stored"),
    [
        ("   ", 400, None),
        (f"  {'x' * 80}  ", 201, "x" * 80),
        (f"  {'x' * 81}  ", 400, None),
    ],
)
def test_create_name_is_trimmed_before_length_validation(
    team_data: dict[str, Any], name: str, status: int, stored: str | None
) -> None:
    owner = User.objects.create_user(username=f"owner-{status}-{len(name)}")
    client = Client()
    client.force_login(owner)
    response = client.post(
        "/teams/", data=json.dumps(_draft(team_data, name)), content_type="application/json"
    )
    assert response.status_code == status
    if stored is not None:
        assert response.json()["data"]["name"] == stored
    else:
        assert "name" in response.json()["error"]["fields"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("name", "status", "stored"),
    [
        ("   ", 400, "Original"),
        (f"  {'x' * 80}  ", 200, "x" * 80),
        (f"  {'x' * 81}  ", 400, "Original"),
    ],
)
def test_update_name_is_trimmed_before_length_validation(
    team_data: dict[str, Any], name: str, status: int, stored: str
) -> None:
    owner = User.objects.create_user(username=f"editor-{status}-{len(name)}")
    team = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="Original")
    client = Client()
    client.force_login(owner)
    response = client.put(
        f"/teams/{team.pk}/",
        data=json.dumps(_draft(team_data, name)),
        content_type="application/json",
    )
    assert response.status_code == status
    team.refresh_from_db()
    assert team.name == stored


@pytest.mark.django_db
def test_json_boundary_and_method_errors_are_stable(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="boundary")
    client = Client()
    client.force_login(owner)
    wrong_type = client.post("/teams/", data="{}", content_type="text/plain")
    malformed = client.post("/teams/", data="{", content_type="application/json")
    wrong_schema = _draft(team_data)
    wrong_schema["schema_version"] = "future"
    unsupported = client.post(
        "/teams/", data=json.dumps(wrong_schema), content_type="application/json"
    )
    oversized = client.post(
        "/teams/",
        data=json.dumps({"padding": "x" * 66_000}),
        content_type="application/json",
    )
    method = client.patch("/teams/", data="{}", content_type="application/json")

    assert wrong_type.json()["error"]["code"] == "invalid-request"
    assert malformed.json()["error"]["code"] == "invalid-json"
    assert unsupported.json()["error"]["fields"]["schema_version"]
    assert oversized.status_code == 413
    assert oversized.json()["error"]["code"] == "payload-too-large"
    assert method.status_code == 405
    assert method.json()["error"]["code"] == "method-not-allowed"


@pytest.mark.django_db
def test_csrf_is_required_for_mutations(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="csrf")
    client = Client(enforce_csrf_checks=True)
    client.force_login(owner)
    response = client.post(
        "/teams/", data=json.dumps(_draft(team_data)), content_type="application/json"
    )
    assert response.status_code == 403
    assert not Team.objects.exists()


@pytest.mark.django_db
def test_failed_replacement_rolls_back_and_later_valid_save_wins(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="atomic")
    team = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="First")
    client = Client()
    client.force_login(owner)
    invalid = _draft(team_data, "Invalid")
    invalid["members"] = [{"position": 0, "pokemon": "missing"}]
    failed = client.put(
        f"/teams/{team.pk}/", data=json.dumps(invalid), content_type="application/json"
    )
    assert failed.status_code == 400
    team.refresh_from_db()
    assert team.name == "First"
    assert team.members.count() == 0

    first = _draft(team_data, "Second")
    second = _draft(team_data, "Third")
    assert (
        client.put(
            f"/teams/{team.pk}/", data=json.dumps(first), content_type="application/json"
        ).status_code
        == 200
    )
    assert (
        client.put(
            f"/teams/{team.pk}/", data=json.dumps(second), content_type="application/json"
        ).status_code
        == 200
    )
    team.refresh_from_db()
    assert team.name == "Third"


@pytest.mark.django_db
def test_transaction_rolls_back_after_members_were_deleted(
    team_data: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = User.objects.create_user(username="rollback-after-delete")
    team = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="Before")
    TeamMember.objects.create(
        team=team,
        position=0,
        profile=team_data["profile"],
        species_form=team_data["profile"].form.base_form,
        nature=team_data["nature"],
    )
    draft = _draft(team_data, "After")
    draft["members"] = [_member()]

    def fail_create(**kwargs: object) -> None:
        raise RuntimeError("simulated persistence failure")

    monkeypatch.setattr(TeamMember.objects, "create", fail_create)
    with pytest.raises(RuntimeError, match="simulated persistence failure"):
        replace_team(team, draft)
    team.refresh_from_db()
    assert team.name == "Before"
    assert list(team.members.values_list("position", flat=True)) == [0]


@pytest.mark.django_db(transaction=True)
def test_database_rejects_duplicate_positions(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="constraints")
    team = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="Team")
    profile = PokemonProfile.objects.get(form__canonical_id="pikachu")
    nature = Nature.objects.get(canonical_id="serious")
    TeamMember.objects.create(
        team=team,
        position=0,
        profile=profile,
        species_form=profile.form.base_form,
        nature=nature,
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        TeamMember.objects.create(
            team=team,
            position=0,
            profile=profile,
            species_form=profile.form.base_form,
            nature=nature,
        )


@pytest.mark.django_db
def test_put_and_delete_require_csrf(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="csrf-detail")
    team = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="Team")
    client = Client(enforce_csrf_checks=True)
    client.force_login(owner)
    url = f"/teams/{team.pk}/"
    assert (
        client.put(
            url, data=json.dumps(_draft(team_data)), content_type="application/json"
        ).status_code
        == 403
    )
    assert client.delete(url).status_code == 403
    assert Team.objects.filter(pk=team.pk).exists()


@pytest.mark.django_db
def test_cross_user_put_and_delete_are_concealed(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="private-owner")
    other = User.objects.create_user(username="private-other")
    team = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="Secret")
    client = Client()
    client.force_login(other)
    url = f"/teams/{team.pk}/"
    replaced = client.put(url, data=json.dumps(_draft(team_data)), content_type="application/json")
    deleted = client.delete(url)
    assert replaced.status_code == deleted.status_code == 404
    assert replaced.json()["error"]["code"] == "team-not-found"
    assert Team.objects.filter(pk=team.pk, name="Secret").exists()


@pytest.mark.django_db
def test_rename_collision_preserves_saved_aggregate(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="rename")
    first = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="First")
    Team.objects.create(owner=owner, regulation=team_data["regulation"], name="Second")
    client = Client()
    client.force_login(owner)
    response = client.put(
        f"/teams/{first.pk}/",
        data=json.dumps(_draft(team_data, " second ")),
        content_type="application/json",
    )
    assert response.status_code == 400
    assert "name" in response.json()["error"]["fields"]
    first.refresh_from_db()
    assert first.name == "First"


@pytest.mark.django_db
@pytest.mark.parametrize("stat_value", [-1, 33, 1.5, "1", True])
def test_sp_values_reject_ranges_and_non_integers(
    team_data: dict[str, Any], stat_value: object
) -> None:
    owner = User.objects.create_user(username=f"sp-{str(stat_value).replace('.', '-')}")
    client = Client()
    client.force_login(owner)
    member = _member()
    member["sp"] = {**member["sp"], "attack": stat_value}
    draft = _draft(team_data)
    draft["members"] = [member]
    response = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert response.status_code == 400
    assert "members.0.sp.attack" in response.json()["error"]["fields"]


@pytest.mark.django_db
def test_direct_mega_selection_is_rejected(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="direct-mega")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [_member(pokemon="pikachumega")]
    response = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert response.status_code == 400
    assert "members.0.pokemon" in response.json()["error"]["fields"]


@pytest.mark.django_db
def test_wrong_mega_item_and_duplicate_species_item_are_rejected(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="aggregate-legality")
    client = Client()
    client.force_login(owner)
    wrong = _draft(team_data, "Wrong stone")
    wrong["members"] = [_member(item="oranberry", mega_preview=True)]
    wrong_response = client.post("/teams/", data=json.dumps(wrong), content_type="application/json")
    assert "members.0.mega_preview" in wrong_response.json()["error"]["fields"]

    duplicate = _draft(team_data, "Duplicates")
    duplicate["members"] = [_member(position=0), _member(position=1)]
    duplicate_response = client.post(
        "/teams/", data=json.dumps(duplicate), content_type="application/json"
    )
    fields = duplicate_response.json()["error"]["fields"]
    assert "members.1.pokemon" in fields
    assert "members.1.item" in fields


@pytest.mark.django_db
def test_species_clause_treats_alternate_forms_as_one_species(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="alternate-species")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [
        _member(position=0, item=None),
        _member(
            position=1,
            pokemon="pikachurockstar",
            ability=None,
            item=None,
            moves=[None, None, None, None],
        ),
    ]
    response = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert response.status_code == 400
    assert "members.1.pokemon" in response.json()["error"]["fields"]


@pytest.mark.django_db
def test_six_positions_can_be_saved_and_reordered(team_data: dict[str, Any]) -> None:
    species = ["pikachu"] + [profile.form.canonical_id for profile in team_data["extra_profiles"]]
    owner = User.objects.create_user(username="six-slots")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [
        _member(
            position=position,
            pokemon=pokemon,
            nickname="",
            ability=None,
            item=None,
            moves=[None, None, None, None],
        )
        for position, pokemon in enumerate(species)
    ]
    created = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert created.status_code == 201
    assert [member["position"] for member in created.json()["data"]["members"]] == list(range(6))
    draft["members"] = [
        {**member, "position": 5 - member["position"]} for member in draft["members"]
    ]
    replaced = client.put(
        f"/teams/{created.json()['data']['id']}/",
        data=json.dumps(draft),
        content_type="application/json",
    )
    assert replaced.status_code == 200
    assert [member["pokemon"] for member in replaced.json()["data"]["members"]] == list(
        reversed(species)
    )


@pytest.mark.django_db
def test_unsupported_pinned_mechanics_returns_versioned_error(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="unsupported")
    unsupported = _retained_snapshot(
        "showdown-unsupported-s3-i4-555555555555", supported_mechanics=False
    )
    team = Team.objects.create(owner=owner, regulation=unsupported, name="Old")
    client = Client()
    client.force_login(owner)
    response = client.get(f"/teams/{team.pk}/")
    assert response.status_code == 503
    assert response.json() == {
        "schema_version": "team-api-v1",
        "error": {
            "code": "data-unavailable",
            "message": "The team's pinned Pokémon data is unavailable or unsupported.",
            "fields": {},
        },
    }


@pytest.mark.django_db
def test_retained_dataset_is_available_only_to_its_team_owner(team_data: dict[str, Any]) -> None:
    retained = _retained_snapshot("showdown-retained-s3-i4-111111111111")
    owner = User.objects.create_user(username="retained-owner")
    other = User.objects.create_user(username="retained-other")
    Team.objects.create(owner=owner, regulation=retained, name="Old team")
    url = f"/teams/data/{retained.version_id}/{retained.canonical_id}/"
    client = Client()
    client.force_login(owner)
    owner_response = client.get(url)
    assert owner_response.status_code == 200
    assert owner_response.json()["items"] == [
        {
            "id": "foreignitem",
            "name": "Foreign Item",
            "short_description": None,
            "description": None,
        }
    ]
    client.force_login(other)
    response = client.get(url)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "data-unavailable"


@pytest.mark.django_db
def test_builder_dataset_v4_has_pinned_ability_move_and_item_details(
    team_data: dict[str, Any],
) -> None:
    owner = User.objects.create_user(username="dataset-details")
    client = Client()
    client.force_login(owner)

    response = client.get(f"/teams/data/{team_data['version'].pk}/m-c/")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=3600"
    payload = response.json()
    assert payload["schema_version"] == "team-builder-data-v4"
    assert payload["data_version"] == team_data["version"].pk
    assert payload["regulation"]["id"] == "m-c"
    assert payload["abilities"] == [
        {
            "id": "static",
            "name": "Static",
            "short_description": "May paralyze.",
            "description": "May paralyze on contact.",
        }
    ]
    assert payload["moves"] == [
        {
            "id": "thunderbolt",
            "name": "Thunderbolt",
            "type": {"id": "electric", "name": "Electric"},
            "category": "Special",
            "base_power": 90,
            "accuracy": 100,
            "always_hits": False,
            "pp": 15,
            "priority": 0,
            "target": "normal",
            "short_description": "May paralyze.",
            "description": "May paralyze the target.",
            "flags": ["contact", "protect"],
        }
    ]
    assert payload["forms"][0]["ability_ids"] == ["static"]
    assert payload["forms"][0]["move_ids"] == ["thunderbolt"]
    assert payload["mega_relations"][0]["target"]["ability_ids"] == ["static"]
    assert payload["mega_search_entries"] == [
        {
            "id": "pikachumega",
            "name": "Pikachu-Mega",
            "base_form_id": "pikachu",
            "item_id": "pikachunite",
            "sprite_form": "pikachumega",
            "type_ids": [],
            "ability_ids": ["static"],
            "move_ids": [],
            "base_stats": {
                "hp": 45,
                "attack": 75,
                "defense": 50,
                "special_attack": 80,
                "special_defense": 60,
                "speed": 110,
            },
        }
    ]
    assert payload["items"] == [
        {
            "id": "oranberry",
            "name": "Oran Berry",
            "short_description": "Restores HP.",
            "description": "Restores HP.",
        },
        {
            "id": "pikachunite",
            "name": "Pikachunite",
            "short_description": "Enables Mega Evolution.",
            "description": "Enables Pikachu to Mega Evolve.",
        },
    ]
    assert payload["sprite_url_template"].startswith("/")
    assert team_data["version"].pk in payload["sprite_url_template"]


@pytest.mark.django_db(transaction=True)
def test_actual_release_mega_search_entries_have_no_dangling_draft_references() -> None:
    release = (
        settings.REPOSITORY_ROOT / "src" / "data" / "releases" / "showdown-multi-s5-i7-49850c617dd2"
    )
    if not release.is_dir():
        pytest.skip("the reviewed form-search release is required")
    loaded = load_pokemon_data(release).version

    for regulation in Regulation.objects.filter(version=loaded).select_related("mechanics_profile"):
        dataset = builder_dataset(Snapshot(loaded, regulation))
        form_ids = {form["id"] for form in dataset["forms"]}
        type_ids = {record["id"] for record in dataset["types"]}
        ability_ids = {record["id"] for record in dataset["abilities"]}
        move_ids = {record["id"] for record in dataset["moves"]}
        item_ids = {record["id"] for record in dataset["items"]}

        assert "meowsticf" not in form_ids
        assert all(entry["base_form_id"] in form_ids for entry in dataset["mega_search_entries"])
        assert all(entry["item_id"] in item_ids for entry in dataset["mega_search_entries"])
        assert all(
            set(entry["type_ids"]) <= type_ids
            and set(entry["ability_ids"]) <= ability_ids
            and set(entry["move_ids"]) <= move_ids
            for entry in dataset["mega_search_entries"]
        )
        assert {entry["id"] for entry in dataset["mega_search_entries"]} == {
            relation.mega_form.canonical_id
            for relation in MegaItemRelation.objects.filter(
                regulation=regulation,
                base_form__pokemonprofile__regulation=regulation,
                base_form__pokemonprofile__membership__isnull=False,
                base_form__is_mega=False,
            ).select_related("mega_form")
        }


@pytest.mark.django_db
def test_my_teams_filters_by_owner_and_canonical_regulation_in_newest_order(
    team_data: dict[str, Any],
) -> None:
    retained = _retained_snapshot("showdown-retained-s3-i4-222222222222")
    other_regulation = _retained_snapshot(
        "showdown-other-reg-s3-i4-333333333333", regulation_id="m-b"
    )
    owner = User.objects.create_user(username="list-owner")
    other = User.objects.create_user(username="list-other")
    older = Team.objects.create(owner=owner, regulation=retained, name="Older version")
    newest = Team.objects.create(
        owner=owner, regulation=team_data["regulation"], name="Newest version"
    )
    Team.objects.create(owner=owner, regulation=other_regulation, name="Other regulation")
    Team.objects.create(owner=other, regulation=retained, name="Other user")
    Team.objects.filter(pk=older.pk).update(updated_at=timezone.now() - timedelta(days=1))
    Team.objects.filter(pk=newest.pk).update(updated_at=timezone.now())

    client = Client()
    client.force_login(owner)
    response = client.get("/teams/")
    assert response.status_code == 200
    summaries = response.context["team_builder_bootstrap"]["teams"]
    bootstrap = response.context["team_builder_bootstrap"]
    assert bootstrap["schema_version"] == "team-builder-bootstrap-v2"
    assert bootstrap["next_team_number"] == 4
    assert [summary["name"] for summary in summaries] == ["Newest version", "Older version"]
    assert summaries[1]["pinned_version"] == retained.version_id


@pytest.mark.django_db
def test_team_summaries_use_ordered_pinned_form_sprite_urls(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="summary-sprites")
    team = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="Sprites")
    TeamMember.objects.create(
        team=team,
        position=4,
        profile=team_data["alternate_profile"],
        species_form=team_data["alternate_profile"].form.base_form,
        nature=team_data["nature"],
        shiny=False,
        mega_preview=True,
    )
    TeamMember.objects.create(
        team=team,
        position=1,
        profile=team_data["extra_profiles"][0],
        species_form=team_data["extra_profiles"][0].form,
        nature=team_data["nature"],
        shiny=True,
        mega_preview=True,
    )

    client = Client()
    client.force_login(owner)
    response = client.get("/teams/")

    assert response.status_code == 200
    summary = response.context["team_builder_bootstrap"]["teams"][0]
    assert "member_count" not in summary
    assert summary["pinned_version"] == team_data["version"].pk
    assert summary["members"] == [
        {
            "position": 1,
            "sprite_url": (f"/pokedex/sprites/{team_data['version'].pk}/species1/shiny.webp"),
        },
        {
            "position": 4,
            "sprite_url": (
                f"/pokedex/sprites/{team_data['version'].pk}/pikachurockstar/normal.webp"
            ),
        },
    ]
    assert all(member["sprite_url"].startswith("/") for member in summary["members"])


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("change", "path"),
    [
        ({"pokemon": "foreignmon"}, "members.0.pokemon"),
        ({"ability": "foreignability"}, "members.0.ability"),
        ({"item": "foreignitem"}, "members.0.item"),
        ({"moves": ["foreignmove", None, None, None]}, "members.0.moves.0"),
        ({"nature": "foreignnature"}, "members.0.nature"),
    ],
)
def test_cross_version_canonical_ids_cannot_be_forged(
    team_data: dict[str, Any], change: dict[str, Any], path: str
) -> None:
    _retained_snapshot("showdown-forged-s3-i4-444444444444")
    owner = User.objects.create_user(username=f"forge-{path}")
    client = Client()
    client.force_login(owner)
    draft = _draft(team_data)
    draft["members"] = [_member(**change)]
    response = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert response.status_code == 400
    assert path in response.json()["error"]["fields"]


@pytest.mark.django_db
def test_team_endpoints_have_bounded_query_counts(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="queries")
    team = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="Queries")
    for index in range(3):
        listed_team = Team.objects.create(
            owner=owner,
            regulation=team_data["regulation"],
            name=f"Listed {index}",
        )
        TeamMember.objects.create(
            team=listed_team,
            position=index,
            profile=team_data["extra_profiles"][index],
            species_form=team_data["extra_profiles"][index].form,
            nature=team_data["nature"],
        )
    client = Client()
    client.force_login(owner)
    with CaptureQueriesContext(connection) as page_queries:
        assert client.get("/teams/").status_code == 200
    with CaptureQueriesContext(connection) as detail_queries:
        assert client.get(f"/teams/{team.pk}/").status_code == 200
    with CaptureQueriesContext(connection) as dataset_queries:
        assert client.get(f"/teams/data/{team_data['version'].pk}/m-c/").status_code == 200
    assert len(page_queries) <= 16
    assert len(detail_queries) <= 15
    assert len(dataset_queries) <= 20


@pytest.mark.django_db(transaction=True)
def test_durable_team_constraints_reject_invalid_rows(team_data: dict[str, Any]) -> None:
    owner = User.objects.create_user(username="durable")
    team = Team.objects.create(owner=owner, regulation=team_data["regulation"], name="Alpha")
    with pytest.raises(IntegrityError), transaction.atomic():
        Team.objects.create(owner=owner, regulation=team_data["regulation"], name="alpha")

    profile = team_data["profile"]
    nature = team_data["nature"]
    stone = ItemProfile.objects.get(item__canonical_id="pikachunite")
    loading_version = DataVersion.objects.create(
        id="showdown-constraint-test-s4-i5-0123456789ab",
        bundle_hash="c" * 64,
        bundle_schema_version="4",
        importer_version="5",
        source_shape_version="test",
        provenance={},
        validation_summary={},
        semantic_inventory={},
        semantic_diff={},
        manifest={},
    )
    loading_mechanics = MechanicsProfile.objects.create(
        version=loading_version,
        canonical_id="constraint-test",
        level=50,
        sp_minimum=0,
        sp_maximum=32,
        sp_total_max=66,
        hp_formula="base + sp + 75",
        other_formula="truncate((base + sp + 20) * nature_percent / 100)",
        nature_percentages={"hindering": 90, "neutral": 100, "increasing": 110},
    )
    loading_regulation = Regulation.objects.create(
        version=loading_version,
        canonical_id="m-c",
        name="Constraint Regulation",
        showdown_format_id="constraint-test",
        mod="champions",
        ruleset=[],
        mechanics_profile=loading_mechanics,
    )
    incomplete_item = Item.objects.create(
        version=loading_version,
        canonical_id="incompleteitem",
        name="Incomplete Item",
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        ItemProfile.objects.create(
            version=loading_version,
            regulation=loading_regulation,
            item=incomplete_item,
            source_status="standard",
            short_description="Only one field.",
        )
    first = TeamMember.objects.create(
        team=team,
        position=0,
        profile=profile,
        species_form=profile.form.base_form,
        nature=nature,
        item_profile=stone,
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        TeamMember.objects.create(
            team=team,
            position=1,
            profile=profile,
            species_form=profile.form.base_form,
            nature=nature,
        )

    second_profile = team_data["extra_profiles"][0]
    with pytest.raises(IntegrityError), transaction.atomic():
        TeamMember.objects.create(
            team=team,
            position=1,
            profile=second_profile,
            species_form=second_profile.form,
            nature=nature,
            item_profile=stone,
        )

    move = MoveProfile.objects.get(move__canonical_id="thunderbolt")
    TeamMemberMove.objects.create(member=first, position=0, move_profile=move)
    with pytest.raises(IntegrityError), transaction.atomic():
        TeamMemberMove.objects.create(member=first, position=1, move_profile=move)
    with pytest.raises(IntegrityError), transaction.atomic():
        TeamMemberMove.objects.create(member=first, position=4, move_profile=move)
    with pytest.raises(IntegrityError), transaction.atomic():
        TeamMember.objects.filter(pk=first.pk).update(sp_attack=33)

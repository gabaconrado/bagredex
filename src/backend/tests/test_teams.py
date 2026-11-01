"""Observable behavior tests for private team aggregates."""

from __future__ import annotations

import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from email.message import Message
from http.client import HTTPException, IncompleteRead
from io import BytesIO
from threading import Barrier, Lock
from time import sleep
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request

import pytest
from django.conf import settings
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from bagredex.accounts.models import User
from bagredex.battle_mode.bootstrap import battle_mode_bootstrap
from bagredex.pokedex import Snapshot, response_etag
from bagredex.pokemon_data.form_groups import GROUPED_FORM_OPTIONS
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
from bagredex.teams import pokepaste as pokepaste_service
from bagredex.teams import views as team_views
from bagredex.teams.datasets import builder_dataset
from bagredex.teams.models import Team, TeamMember, TeamMemberMove
from bagredex.teams.pokepaste import (
    POKEPASTE_MAX_BYTES,
    POKEPASTE_TIMEOUT_SECONDS,
    PokePasteFetchError,
    fetch_pokepaste,
    parse_pokepaste_url,
    reserve_fetch_attempt,
)
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
        is_nfe=True,
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
        suppresses_held_item=True,
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
        version=version, canonical_id="choicescarf", name="Choice Scarf"
    )
    ItemProfile.objects.create(
        version=version,
        regulation=regulation,
        item=ordinary_item,
        source_status="standard",
        short_description="Boosts Speed.",
        description="Boosts Speed but locks move selection.",
        description_source=ItemProfile.DescriptionSource.SHORT_DESC,
        stat_modifiers=[
            {
                "stat": "spe",
                "numerator": 6144,
                "denominator": 4096,
                "eligibility": "always",
            }
        ],
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
    PokemonProfileAbility.objects.create(
        profile=alternate_profile, ability_profile=ability_profile, slot="0"
    )
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
        PokemonProfileAbility.objects.create(
            profile=extra_profile, ability_profile=ability_profile, slot="0"
        )
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
    ability_profile = AbilityProfile.objects.create(
        version=version,
        regulation=regulation,
        ability=ability,
        short_description="Foreign.",
        description="Foreign.",
    )
    PokemonProfileAbility.objects.create(
        profile=foreign_profile, ability_profile=ability_profile, slot="0"
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


def _ability_contract_snapshot(*, include_hidden: bool, slot_zero: bool) -> Snapshot:
    identifier = f"showdown-ability-contract-{uuid.uuid4().hex[:12]}"
    version = DataVersion.objects.create(
        id=identifier,
        bundle_hash="c" * 64,
        bundle_schema_version="7",
        importer_version="9",
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
        showdown_format_id="ability-contract",
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
    form_id = uuid.uuid4()
    form = PokemonForm.objects.create(
        id=form_id,
        version=version,
        canonical_id="raichu",
        name="Raichu",
        national_dex_number=26,
        base_form_id=form_id,
        is_mega=False,
        sprite_id="raichu",
    )
    profile = PokemonProfile.objects.create(
        version=version,
        regulation=regulation,
        form=form,
        hp=60,
        attack=90,
        defense=55,
        special_attack=90,
        special_defense=80,
        speed=110,
        bst=485,
    )
    RegulationMembership.objects.create(profile=profile)
    static = Ability.objects.create(version=version, canonical_id="static", name="Static")
    static_profile = AbilityProfile.objects.create(
        version=version,
        regulation=regulation,
        ability=static,
        short_description="May paralyze.",
        description="May paralyze on contact.",
    )
    PokemonProfileAbility.objects.create(
        profile=profile, ability_profile=static_profile, slot="0" if slot_zero else "H"
    )
    if include_hidden:
        lightning_rod = Ability.objects.create(
            version=version, canonical_id="lightningrod", name="Lightning Rod"
        )
        lightning_rod_profile = AbilityProfile.objects.create(
            version=version,
            regulation=regulation,
            ability=lightning_rod,
            short_description="Draws in Electric moves.",
            description="Draws in Electric moves to raise Special Attack.",
        )
        PokemonProfileAbility.objects.create(
            profile=profile, ability_profile=lightning_rod_profile, slot="H"
        )
    return Snapshot(version, regulation)


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
    wrong["members"] = [_member(item="choicescarf", mega_preview=True)]
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
    owner_payload = owner_response.json()
    assert owner_payload["schema_version"] == "team-builder-data-v7"
    assert owner_payload["forms"][0]["default_ability_id"] == "foreignability"
    assert owner_payload["forms"][0]["is_nfe"] is False
    assert owner_payload["items"] == [
        {
            "id": "foreignitem",
            "name": "Foreign Item",
            "short_description": None,
            "description": None,
            "stat_modifiers": [],
        }
    ]
    old_etag = response_etag(retained.version_id, retained.canonical_id, "team-builder-data-v6")
    changed_schema_response = client.get(url, headers={"If-None-Match": old_etag})
    assert changed_schema_response.status_code == 200
    assert changed_schema_response.headers["ETag"] != old_etag
    repeated = client.get(url, headers={"If-None-Match": changed_schema_response.headers["ETag"]})
    assert repeated.status_code == 304
    assert repeated.headers["Cache-Control"] == "private, max-age=3600"
    client.force_login(other)
    response = client.get(url, headers={"If-None-Match": changed_schema_response.headers["ETag"]})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "data-unavailable"


@pytest.mark.django_db
def test_builder_dataset_v7_has_pinned_held_item_mechanics(
    team_data: dict[str, Any],
) -> None:
    owner = User.objects.create_user(username="dataset-details")
    client = Client()
    client.force_login(owner)

    response = client.get(f"/teams/data/{team_data['version'].pk}/m-c/")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=3600"
    payload = response.json()
    assert payload["schema_version"] == "team-builder-data-v7"
    assert payload["data_version"] == team_data["version"].pk
    assert payload["regulation"]["id"] == "m-c"
    assert payload["abilities"] == [
        {
            "id": "static",
            "name": "Static",
            "short_description": "May paralyze.",
            "description": "May paralyze on contact.",
            "suppresses_held_item": True,
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
    assert payload["forms"][0]["default_ability_id"] == "static"
    assert payload["forms"][0]["move_ids"] == ["thunderbolt"]
    assert payload["forms"][0]["is_nfe"] is True
    assert payload["pokemon_search_entries"] == [
        {"form_id": "pikachu", "name": "Pikachu", "form_group": None},
        {
            "form_id": "pikachurockstar",
            "name": "Pikachu-Rock-Star",
            "form_group": None,
        },
        {"form_id": "species1", "name": "Species 1", "form_group": None},
        {"form_id": "species2", "name": "Species 2", "form_group": None},
        {"form_id": "species3", "name": "Species 3", "form_group": None},
        {"form_id": "species4", "name": "Species 4", "form_group": None},
        {"form_id": "species5", "name": "Species 5", "form_group": None},
    ]
    assert payload["mega_relations"][0]["target"]["ability_ids"] == ["static"]
    assert payload["mega_relations"][0]["target"]["is_nfe"] is False
    assert payload["mega_search_entries"] == [
        {
            "id": "pikachumega",
            "name": "Pikachu-Mega",
            "base_form_id": "pikachu",
            "item_id": "pikachunite",
            "sprite_form": "pikachumega",
            "is_nfe": False,
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
            "id": "choicescarf",
            "name": "Choice Scarf",
            "short_description": "Boosts Speed.",
            "description": "Boosts Speed but locks move selection.",
            "stat_modifiers": [
                {
                    "stat": "spe",
                    "numerator": 6144,
                    "denominator": 4096,
                    "eligibility": "always",
                }
            ],
        },
        {
            "id": "pikachunite",
            "name": "Pikachunite",
            "short_description": "Enables Mega Evolution.",
            "description": "Enables Pikachu to Mega Evolve.",
            "stat_modifiers": [],
        },
    ]
    assert payload["sprite_url_template"].startswith("/")
    assert team_data["version"].pk in payload["sprite_url_template"]


@pytest.mark.django_db
def test_builder_dataset_uses_showdown_slot_zero_as_default_ability() -> None:
    dataset = builder_dataset(_ability_contract_snapshot(include_hidden=True, slot_zero=True))
    raichu = dataset["forms"][0]

    assert raichu["ability_ids"] == ["lightningrod", "static"]
    assert raichu["default_ability_id"] == "static"


@pytest.mark.django_db
def test_builder_dataset_rejects_legal_profile_without_slot_zero_ability() -> None:
    snapshot = _ability_contract_snapshot(include_hidden=False, slot_zero=False)

    with pytest.raises(ValueError, match="'raichu' must have exactly one slot-0 ability"):
        builder_dataset(snapshot)


@pytest.mark.django_db(transaction=True)
def test_actual_release_mega_search_entries_have_no_dangling_draft_references() -> None:
    release = (
        settings.REPOSITORY_ROOT / "src" / "data" / "releases" / "showdown-multi-s7-i9-78b322057dd0"
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

        assert {"meowstic", "meowsticf"} <= form_ids
        assert all(form["default_ability_id"] in form["ability_ids"] for form in dataset["forms"])
        if regulation.canonical_id == "m-c":
            raichu = next(form for form in dataset["forms"] if form["id"] == "raichu")
            assert raichu["default_ability_id"] == "static"
        entries_by_form = {entry["form_id"]: entry for entry in dataset["pokemon_search_entries"]}
        assert entries_by_form["meowstic"]["name"] == "Meowstic-Male"
        assert entries_by_form["meowsticf"]["name"] == "Meowstic-Female"
        for base_id, options in GROUPED_FORM_OPTIONS.items():
            available = [
                {"id": form_id, "label": label} for form_id, label in options if form_id in form_ids
            ]
            if not available:
                assert base_id not in entries_by_form
                continue
            representative = available[0]["id"]
            assert entries_by_form[representative]["form_group"] == (
                {"label": "Form", "options": available} if len(available) > 1 else None
            )
            assert not any(option["id"] in entries_by_form for option in available[1:])
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


@pytest.mark.django_db(transaction=True)
def test_female_meowstic_round_trips_and_keeps_species_clause() -> None:
    release = (
        settings.REPOSITORY_ROOT / "src" / "data" / "releases" / "showdown-multi-s7-i9-78b322057dd0"
    )
    loaded = load_pokemon_data(release).version
    activate_pokemon_data(loaded.pk)
    regulation = Regulation.objects.get(version=loaded, canonical_id="m-c")
    female = PokemonProfile.objects.get(regulation=regulation, form__canonical_id="meowsticf")
    ability = female.abilities.select_related("ability_profile__ability").order_by("slot").first()
    relation = MegaItemRelation.objects.select_related("item_profile__item", "mega_form").get(
        regulation=regulation,
        base_form=female.form,
    )
    assert relation.mega_form.canonical_id == "meowsticfmega"
    assert ability is not None

    owner = User.objects.create_user(username="female-meowstic-owner")
    client = Client()
    client.force_login(owner)
    draft: dict[str, Any] = {
        "schema_version": "team-draft-v1",
        "version": loaded.pk,
        "regulation": "m-c",
        "name": "Female Meowstic",
        "members": [
            {
                "position": 0,
                "pokemon": "meowsticf",
                "nickname": "Oracle",
                "ability": ability.ability_profile.ability.canonical_id,
                "item": relation.item_profile.item.canonical_id,
                "moves": [None, None, None, None],
                "nature": "serious",
                "sp": {
                    stat: 0
                    for stat in (
                        "hp",
                        "attack",
                        "defense",
                        "special_attack",
                        "special_defense",
                        "speed",
                    )
                },
                "shiny": False,
                "mega_preview": True,
            }
        ],
    }
    created = client.post("/teams/", data=json.dumps(draft), content_type="application/json")
    assert created.status_code == 201
    aggregate = created.json()["data"]
    assert aggregate["members"][0]["pokemon"] == "meowsticf"
    assert aggregate["members"][0]["mega_target"] == "meowsticfmega"

    team_url = f"/teams/{aggregate['id']}/"
    draft["name"] = "Female Meowstic Updated"
    updated = client.put(team_url, data=json.dumps(draft), content_type="application/json")
    assert updated.status_code == 200
    assert client.get(team_url).json()["data"]["members"][0]["pokemon"] == "meowsticf"

    duplicate = dict(draft)
    male = PokemonProfile.objects.get(regulation=regulation, form__canonical_id="meowstic")
    male_ability = (
        male.abilities.select_related("ability_profile__ability").order_by("slot").first()
    )
    assert male_ability is not None
    duplicate["members"] = [
        draft["members"][0],
        {
            **draft["members"][0],
            "position": 1,
            "pokemon": "meowstic",
            "ability": male_ability.ability_profile.ability.canonical_id,
            "item": None,
            "mega_preview": False,
        },
    ]
    rejected = client.put(team_url, data=json.dumps(duplicate), content_type="application/json")
    assert rejected.status_code == 400
    assert rejected.json()["error"]["fields"]["members.1.pokemon"]

    bootstrap = battle_mode_bootstrap(owner, Snapshot(loaded, regulation))
    dataset = builder_dataset(Snapshot(loaded, regulation))
    reachable = {
        option["id"]
        for entry in dataset["pokemon_search_entries"]
        for option in (
            entry["form_group"]["options"]
            if entry["form_group"] is not None
            else [{"id": entry["form_id"]}]
        )
    }
    assert reachable == set(bootstrap["base_species_by_form"])

    prior = load_pokemon_data(
        settings.REPOSITORY_ROOT / "src" / "data" / "releases" / "showdown-multi-s6-i8-e712c7acc763"
    ).version
    activate_pokemon_data(prior.pk)
    retained = client.get(team_url)
    assert retained.status_code == 200
    assert retained.json()["data"]["members"][0]["pokemon"] == "meowsticf"


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
    assert bootstrap["schema_version"] == "team-builder-bootstrap-v3"
    assert bootstrap["pokepaste_import_url"] == "/teams/import/pokepaste/"
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


class _FakePokePasteResponse:
    def __init__(
        self,
        body: bytes,
        *,
        status: int = 200,
        content_type: str = "text/plain; charset=utf-8",
    ) -> None:
        self.status = status
        self.headers = {"Content-Type": content_type}
        self.body = body
        self.read_size: int | None = None

    def __enter__(self) -> _FakePokePasteResponse:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self, size: int) -> bytes:
        self.read_size = size
        return self.body[:size]


@pytest.mark.parametrize(
    "value",
    [
        "http://pokepast.es/be093acb4f35b92a",
        "https://www.pokepast.es/be093acb4f35b92a",
        "https://pokepast.es.evil.test/be093acb4f35b92a",
        "https://user@pokepast.es/be093acb4f35b92a",
        "https://pokepast.es:443/be093acb4f35b92a",
        "https://pokepast.es/be093acb4f35b92a/",
        "https://pokepast.es/be093acb4f35b92a/raw",
        "https://pokepast.es/be093acb4f35b92a?x=1",
        "https://pokepast.es/be093acb4f35b92a#x",
        "https://pokepast.es/BE093ACB4F35B92A",
        "https://pokepast.es/too-short",
        " https://pokepast.es/be093acb4f35b92a",
        "https://pokepast.es/be093acb4f35b92a\nPikachu",
        None,
    ],
)
def test_pokepaste_url_validation_rejects_every_noncanonical_shape(value: object) -> None:
    with pytest.raises(PokePasteFetchError) as caught:
        parse_pokepaste_url(value)
    assert caught.value.code == "invalid-url"
    assert caught.value.status == 400


def test_pokepaste_fetch_uses_only_fixed_request_parts_and_returns_exact_text() -> None:
    response = _FakePokePasteResponse("Flabébé @ Choice Scarf\n".encode())
    captured: dict[str, object] = {}

    def open_request(request: Request, timeout: float) -> _FakePokePasteResponse:
        captured["request"] = request
        captured["timeout"] = timeout
        return response

    text = fetch_pokepaste("https://pokepast.es/be093acb4f35b92a", open_request=open_request)

    request = captured["request"]
    assert isinstance(request, Request)
    assert request.full_url == "https://pokepast.es/be093acb4f35b92a/raw"
    assert request.method == "GET"
    assert request.get_header("Accept") == "text/plain"
    assert request.get_header("Accept-encoding") == "identity"
    assert request.get_header("User-agent") == "Bagredex/1 PokepasteImporter"
    assert captured["timeout"] == POKEPASTE_TIMEOUT_SECONDS
    assert response.read_size == POKEPASTE_MAX_BYTES + 1
    assert text == "Flabébé @ Choice Scarf\n"


@pytest.mark.parametrize(
    ("response", "code", "status"),
    [
        (_FakePokePasteResponse(b"missing", status=404), "not-found", 404),
        (_FakePokePasteResponse(b"redirect", status=302), "upstream-unavailable", 502),
        (_FakePokePasteResponse(b"error", status=500), "upstream-unavailable", 502),
        (_FakePokePasteResponse(b"<html>", content_type="text/html"), "invalid-content", 502),
        (_FakePokePasteResponse(b"text", content_type=""), "invalid-content", 502),
        (_FakePokePasteResponse(b"\xff"), "invalid-content", 502),
        (
            _FakePokePasteResponse(b"x" * (POKEPASTE_MAX_BYTES + 1)),
            "response-too-large",
            502,
        ),
    ],
)
def test_pokepaste_fetch_normalizes_invalid_responses(
    response: _FakePokePasteResponse, code: str, status: int
) -> None:
    with pytest.raises(PokePasteFetchError) as caught:
        fetch_pokepaste(
            "https://pokepast.es/be093acb4f35b92a",
            open_request=lambda request, timeout: response,
        )
    assert caught.value.code == code
    assert caught.value.status == status
    assert "be093acb4f35b92a" not in caught.value.message
    assert "https://" not in caught.value.message


@pytest.mark.parametrize(
    ("error", "code", "status"),
    [
        (TimeoutError(), "timeout", 504),
        (URLError(TimeoutError()), "timeout", 504),
        (URLError("dns failure"), "upstream-unavailable", 502),
        (HTTPException("protocol details"), "upstream-unavailable", 502),
        (IncompleteRead(b"partial private body", 50), "upstream-unavailable", 502),
        (
            HTTPError(
                "https://pokepast.es/fixed/raw",
                404,
                "upstream body",
                Message(),
                BytesIO(),
            ),
            "not-found",
            404,
        ),
        (
            HTTPError(
                "https://pokepast.es/fixed/raw",
                301,
                "redirect target",
                Message(),
                BytesIO(),
            ),
            "upstream-unavailable",
            502,
        ),
    ],
)
def test_pokepaste_fetch_normalizes_transport_failures(
    error: Exception, code: str, status: int
) -> None:
    def fail(request: Request, timeout: float) -> _FakePokePasteResponse:
        raise error

    with pytest.raises(PokePasteFetchError) as caught:
        fetch_pokepaste("https://pokepast.es/be093acb4f35b92a", open_request=fail)
    assert caught.value.code == code
    assert caught.value.status == status
    assert "fixed" not in caught.value.message
    assert "upstream body" not in caught.value.message
    assert "partial private body" not in caught.value.message
    assert "protocol details" not in caught.value.message


def test_pokepaste_http_error_body_is_closed() -> None:
    body = BytesIO(b"private upstream response")
    error = HTTPError("https://pokepast.es/fixed/raw", 500, "private reason", Message(), body)

    def fail(request: Request, timeout: float) -> _FakePokePasteResponse:
        raise error

    with pytest.raises(PokePasteFetchError):
        fetch_pokepaste("https://pokepast.es/be093acb4f35b92a", open_request=fail)
    assert body.closed


@pytest.mark.django_db(transaction=True)
def test_pokepaste_throttle_is_rolling_and_stores_only_timestamps() -> None:
    session = SessionStore()
    session.create()

    assert [reserve_fetch_attempt(session, now=100.0) for _ in range(5)] == [None] * 5
    assert reserve_fetch_attempt(session, now=100.0) == 60
    assert session["pokepaste_fetch_attempts"] == [100.0] * 5
    assert reserve_fetch_attempt(session, now=159.5) == 1
    assert reserve_fetch_attempt(session, now=160.0) is None
    assert session["pokepaste_fetch_attempts"] == [160.0]

    clock_rollback_session = SessionStore()
    clock_rollback_session.create()
    assert reserve_fetch_attempt(clock_rollback_session, now=101.0) is None
    assert [reserve_fetch_attempt(clock_rollback_session, now=100.0) for _ in range(4)] == [
        None
    ] * 4
    assert reserve_fetch_attempt(clock_rollback_session, now=100.0) == 60


@pytest.mark.django_db
def test_pokepaste_endpoint_returns_versioned_no_store_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = User.objects.create_user(username="pokepaste-success")
    client = Client()
    client.force_login(owner)
    supplied: list[object] = []

    def fake_fetch(url: object) -> str:
        supplied.append(url)
        return "Pikachu @ Choice Scarf\n"

    monkeypatch.setattr(team_views, "fetch_pokepaste", fake_fetch)
    response = client.post(
        "/teams/import/pokepaste/",
        data=json.dumps({"url": "https://pokepast.es/be093acb4f35b92a"}),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {
        "schema_version": "pokepaste-import-v1",
        "data": {"text": "Pikachu @ Choice Scarf\n"},
    }
    assert supplied == ["https://pokepast.es/be093acb4f35b92a"]


@pytest.mark.django_db
def test_pokepaste_endpoint_requires_authentication_and_csrf() -> None:
    path = "/teams/import/pokepaste/"
    anonymous = Client().post(
        path,
        data=json.dumps({"url": "https://pokepast.es/be093acb4f35b92a"}),
        content_type="application/json",
    )
    assert anonymous.status_code == 302
    assert anonymous.headers["Location"].startswith("/login/")

    owner = User.objects.create_user(username="pokepaste-csrf")
    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(owner)
    rejected = csrf_client.post(
        path,
        data=json.dumps({"url": "https://pokepast.es/be093acb4f35b92a"}),
        content_type="application/json",
    )
    assert rejected.status_code == 403


@pytest.mark.django_db
def test_pokepaste_endpoint_rejects_malformed_requests_before_fetch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = User.objects.create_user(username="pokepaste-invalid")
    client = Client()
    client.force_login(owner)

    def unexpected_fetch(url: object) -> str:
        pytest.fail("invalid requests must not reach the outbound boundary")

    monkeypatch.setattr(team_views, "fetch_pokepaste", unexpected_fetch)
    responses = [
        client.get("/teams/import/pokepaste/"),
        client.post("/teams/import/pokepaste/", data="url=x", content_type="text/plain"),
        client.post("/teams/import/pokepaste/", data="{", content_type="application/json"),
        client.post(
            "/teams/import/pokepaste/", data=json.dumps([]), content_type="application/json"
        ),
        client.post(
            "/teams/import/pokepaste/",
            data=json.dumps({"url": "https://pokepast.es/be093acb4f35b92a", "extra": 1}),
            content_type="application/json",
        ),
        client.post(
            "/teams/import/pokepaste/",
            data=json.dumps({"url": "https://evil.test/be093acb4f35b92a"}),
            content_type="application/json",
        ),
        client.post(
            "/teams/import/pokepaste/",
            data=json.dumps({"url": "x" * 600}),
            content_type="application/json",
        ),
    ]
    assert [response.status_code for response in responses] == [405, 400, 400, 400, 400, 400, 400]
    assert all(response.headers["Cache-Control"] == "no-store" for response in responses)
    assert responses[0].json()["error"]["code"] == "method-not-allowed"
    assert all(response.json()["schema_version"] == "pokepaste-import-v1" for response in responses)


@pytest.mark.django_db
def test_pokepaste_endpoint_throttles_failures_per_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = User.objects.create_user(username="pokepaste-throttle")
    client = Client()
    client.force_login(owner)
    calls = 0

    def unavailable(url: object) -> str:
        nonlocal calls
        calls += 1
        raise PokePasteFetchError(
            "upstream-unavailable", "PokéPaste is unavailable. Try again later.", 502
        )

    monkeypatch.setattr(team_views, "fetch_pokepaste", unavailable)
    payload = json.dumps({"url": "https://pokepast.es/be093acb4f35b92a"})
    failures = [
        client.post("/teams/import/pokepaste/", data=payload, content_type="application/json")
        for _ in range(5)
    ]
    limited = client.post("/teams/import/pokepaste/", data=payload, content_type="application/json")

    assert calls == 5
    assert all(response.status_code == 502 for response in failures)
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "rate-limit"
    assert 1 <= int(limited.headers["Retry-After"]) <= 60
    assert "be093acb4f35b92a" not in limited.content.decode()
    assert limited.headers["Cache-Control"] == "no-store"


@pytest.mark.django_db(transaction=True)
def test_pokepaste_endpoint_reserves_concurrent_attempts_across_workers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = User.objects.create_user(username="pokepaste-concurrent")
    authenticated = Client()
    authenticated.force_login(owner)
    session_cookie = authenticated.cookies[settings.SESSION_COOKIE_NAME].value
    barrier = Barrier(8)
    reservation_barrier = Barrier(8)
    call_lock = Lock()
    calls = 0
    lock_hook_calls = 0

    def hold_first_reservation_lock() -> None:
        nonlocal lock_hook_calls
        with call_lock:
            lock_hook_calls += 1
            first = lock_hook_calls == 1
        if first:
            sleep(0.15)

    def fetched(url: object) -> str:
        nonlocal calls
        with call_lock:
            calls += 1
        sleep(0.05)
        return "Pikachu\n"

    monkeypatch.setattr(team_views, "fetch_pokepaste", fetched)
    monkeypatch.setattr(
        pokepaste_service, "_before_attempt_lock", lambda: reservation_barrier.wait()
    )
    monkeypatch.setattr(pokepaste_service, "_attempt_lock_acquired", hold_first_reservation_lock)
    payload = json.dumps({"url": "https://pokepast.es/be093acb4f35b92a"})

    def submit() -> int:
        close_old_connections()
        client = Client()
        client.cookies[settings.SESSION_COOKIE_NAME] = session_cookie
        barrier.wait()
        try:
            return client.post(
                "/teams/import/pokepaste/",
                data=payload,
                content_type="application/json",
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=8) as executor:
        statuses = list(executor.map(lambda _: submit(), range(8)))

    assert calls == 5
    assert lock_hook_calls == 8
    assert sorted(statuses) == [200, 200, 200, 200, 200, 429, 429, 429]
    session_key = authenticated.session.session_key
    assert session_key is not None
    stored_attempts = Session.objects.get(session_key=session_key).get_decoded()[
        "pokepaste_fetch_attempts"
    ]
    assert len(stored_attempts) == 5

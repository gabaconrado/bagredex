"""Request and contract tests for the one-on-one Damage Calculator backend."""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
from django.conf import settings
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from bagredex.accounts.models import User
from bagredex.damage_calculator.datasets import (
    DamageCalculatorUnavailable,
    _gender_fields,
    _move_description,
)
from bagredex.pokemon_data.models import (
    Ability,
    AbilityProfile,
    CalculatorCapability,
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
    PokemonProfileType,
    Regulation,
    RegulationMembership,
    Type,
    TypeEffectiveness,
)
from bagredex.pokemon_data.services import activate_pokemon_data, load_pokemon_data

VERSION_ID = "showdown-calculator-test-s5-i6-0123456789ab"
STATE_INPUT_POLICY = {
    "StateMove": {
        "source": ["name"],
        "user": ["isCrit", "hits"],
        "deterministic_defaults": {"isStellarFirstUse": False},
        "unsupported": ["overrides"],
    },
    "StatePokemon": {
        "source": ["name", "ability", "item", "gender", "nature", "moves"],
        "user": ["abilityOn", "boosts", "originalCurrentHp", "status"],
        "deterministic_defaults": {},
        "unsupported": ["overrides"],
    },
}


@pytest.fixture
def calculator_data() -> dict[str, Any]:
    version = DataVersion.objects.create(
        id=VERSION_ID,
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
        name="Regulation M-C",
        showdown_format_id="gen9championsvgc2026regmc",
        mod="champions",
        ruleset=[],
        mechanics_profile=mechanics,
    )
    historical_regulation = Regulation.objects.create(
        version=version,
        canonical_id="m-b",
        name="Regulation M-B",
        showdown_format_id="gen9championsvgc2026regmb",
        mod="champions",
        ruleset=[],
        mechanics_profile=mechanics,
    )
    serious = Nature.objects.create(
        version=version,
        canonical_id="serious",
        name="Serious",
        increased_stat=None,
        decreased_stat=None,
    )
    types = {
        identifier: Type.objects.create(version=version, canonical_id=identifier, name=name)
        for identifier, name in (("fire", "Fire"), ("flying", "Flying"))
    }
    for attacking in types.values():
        for defending in types.values():
            TypeEffectiveness.objects.create(
                version=version,
                attacking_type=attacking,
                defending_type=defending,
                multiplier_percent=100,
            )

    base_id = uuid.uuid4()
    base = PokemonForm.objects.create(
        id=base_id,
        version=version,
        canonical_id="charizard",
        name="Charizard",
        national_dex_number=6,
        base_form_id=base_id,
        form_label="",
        is_mega=False,
        is_nfe=False,
        gender="variable",
        gender_options=["M", "F"],
        default_gender="M",
        sprite_id="charizard",
    )
    mega = PokemonForm.objects.create(
        version=version,
        canonical_id="charizardmegax",
        name="Charizard-Mega-X",
        national_dex_number=6,
        base_form=base,
        form_label="Mega-X",
        is_mega=True,
        is_nfe=False,
        gender="variable",
        gender_options=["M", "F"],
        default_gender="M",
        sprite_id="charizardmegax",
    )
    base_profile = PokemonProfile.objects.create(
        version=version,
        regulation=regulation,
        form=base,
        hp=78,
        attack=84,
        defense=78,
        special_attack=109,
        special_defense=85,
        speed=100,
        bst=534,
        weight_tenths_kg=905,
    )
    mega_profile = PokemonProfile.objects.create(
        version=version,
        regulation=regulation,
        form=mega,
        hp=78,
        attack=130,
        defense=111,
        special_attack=130,
        special_defense=85,
        speed=100,
        bst=634,
        weight_tenths_kg=1105,
    )
    RegulationMembership.objects.create(profile=base_profile)
    for profile, type_ids in (
        (base_profile, ("fire", "flying")),
        (mega_profile, ("fire", "flying")),
    ):
        for position, type_id in enumerate(type_ids):
            PokemonProfileType.objects.create(
                profile=profile,
                type=types[type_id],
                position=position,
            )

    abilities = {}
    for identifier, name, contextual_inputs in (
        ("blaze", "Blaze", []),
        ("solarpower", "Solar Power", []),
        ("toughclaws", "Tough Claws", [{"key": "ability_active", "kind": "boolean"}]),
    ):
        ability = Ability.objects.create(version=version, canonical_id=identifier, name=name)
        abilities[identifier] = AbilityProfile.objects.create(
            version=version,
            regulation=regulation,
            ability=ability,
            short_description=name,
            description=name,
            contextual_inputs=contextual_inputs,
        )
    PokemonProfileAbility.objects.create(
        profile=base_profile, ability_profile=abilities["solarpower"], slot="H"
    )
    PokemonProfileAbility.objects.create(
        profile=base_profile, ability_profile=abilities["blaze"], slot="0"
    )
    PokemonProfileAbility.objects.create(
        profile=mega_profile, ability_profile=abilities["toughclaws"], slot="0"
    )

    move = Move.objects.create(version=version, canonical_id="heatwave", name="Heat Wave")
    move_profile = MoveProfile.objects.create(
        version=version,
        regulation=regulation,
        move=move,
        type=types["fire"],
        category=MoveProfile.Category.SPECIAL,
        base_power=95,
        accuracy=90,
        always_hits=False,
        pp=10,
        priority=0,
        target="allAdjacentFoes",
        short_description="May burn.",
        description="May burn adjacent foes.",
        calculation={"always_crit": False, "multihit": None},
        contextual_inputs=[],
    )
    flag = MoveFlag.objects.create(version=version, canonical_id="protect")
    MoveFlagRelation.objects.create(move_profile=move_profile, flag=flag)
    for profile, resolution in (
        (base_profile, LearnsetEntry.FormResolution.DIRECT),
        (mega_profile, LearnsetEntry.FormResolution.BASE_TO_MEGA),
    ):
        LearnsetEntry.objects.create(
            profile=profile,
            move_profile=move_profile,
            form_resolution=resolution,
            source_form=base,
            source_mod=LearnsetEntry.SourceMod.CHAMPIONS,
            source_kind=LearnsetEntry.SourceKind.DIRECT,
        )

    item = Item.objects.create(version=version, canonical_id="charizarditex", name="Charizardite X")
    item_profile = ItemProfile.objects.create(
        version=version,
        regulation=regulation,
        item=item,
        source_status="standard",
        calculation={"mega_stone": True, "fling_base_power": 0},
        contextual_inputs=[],
    )
    MegaItemRelation.objects.create(
        version=version,
        regulation=regulation,
        item_profile=item_profile,
        base_form=base,
        mega_form=mega,
    )
    capability = CalculatorCapability.objects.create(
        version=version,
        canonical_id="damage-calculator-v1",
        contract={
            "context_schema_version": "damage-context-v1",
            "formula_reference": "vgcmulticalc@test",
            "game_type": "Doubles",
            "level": 50,
            "stat_stage_minimum": -6,
            "stat_stage_maximum": 6,
            "status_values": ["", "brn"],
            "state_input_policy": STATE_INPUT_POLICY,
        },
    )
    DataVersion.objects.filter(pk=version.pk).update(status=DataVersion.Status.LOADED)
    version.status = DataVersion.Status.LOADED
    activate_pokemon_data(version.pk)
    return {
        "version": version,
        "regulation": regulation,
        "historical_regulation": historical_regulation,
        "capability": capability,
        "nature": serious,
    }


@pytest.fixture
def authenticated_client(client: Client) -> Client:
    user = User.objects.create_user(username="calculator-user", password="test-password")
    client.force_login(user)
    return client


@pytest.mark.parametrize(
    ("gender", "options", "default"),
    (
        ("variable", ["M", "F"], "M"),
        ("M", ["M"], "M"),
        ("F", ["F"], "F"),
        ("N", ["N"], "N"),
    ),
)
def test_gender_contract_is_exact(gender: str, options: list[str], default: str) -> None:
    form = PokemonForm(
        gender=gender,
        gender_options=options,
        default_gender=default,
    )
    assert _gender_fields(form) == {
        "gender": gender,
        "gender_options": options,
        "default_gender": default,
    }


def test_gender_contract_fails_closed_on_invalid_default() -> None:
    form = PokemonForm(
        gender="variable",
        gender_options=["M", "F"],
        default_gender="N",
    )
    with pytest.raises(DamageCalculatorUnavailable, match="gender contract"):
        _gender_fields(form)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url",
    (
        "/damage-calculator/?regulation=m-c",
        f"/damage-calculator/data/{VERSION_ID}/m-c/",
    ),
)
def test_calculator_requires_authentication(calculator_data: dict[str, Any], url: str) -> None:
    response = Client().get(url)
    assert response.status_code == 302
    location = urlsplit(response.headers["Location"])
    assert location.path == "/login/"
    assert parse_qs(location.query) == {"next": [url]}


@pytest.mark.django_db
def test_page_exposes_exact_active_bootstrap(
    calculator_data: dict[str, Any], authenticated_client: Client
) -> None:
    response = authenticated_client.get("/damage-calculator/")
    assert response.status_code == 200
    assert response.context["damage_calculator_bootstrap"] == {
        "schema_version": "damage-calculator-bootstrap-v1",
        "active_version": VERSION_ID,
        "regulation": {"id": "m-c", "name": "Regulation M-C"},
        "dataset_url": f"/damage-calculator/data/{VERSION_ID}/m-c/",
    }


@pytest.mark.django_db
def test_page_canonicalizes_latest_and_keeps_historical_selection_explicit(
    calculator_data: dict[str, Any], authenticated_client: Client
) -> None:
    canonical = authenticated_client.get("/damage-calculator/?tag=first&tag=second&regulation=m-c")

    assert canonical.status_code == 302
    assert canonical.headers["Location"] == "/damage-calculator/?tag=first&tag=second"
    historical = authenticated_client.get("/damage-calculator/?tag=first&regulation=m-b")
    assert historical.status_code == 200
    assert historical.context["damage_calculator_bootstrap"]["regulation"]["id"] == "m-b"
    assert historical.context["regulation_selector"]["navigation_suffix"] == "?regulation=m-b"
    stale = authenticated_client.get("/damage-calculator/data/old/m-b/")
    assert stale.status_code == 409
    assert stale.json()["error"]["reload_url"] == "/damage-calculator/?regulation=m-b"
    assert authenticated_client.get("/damage-calculator/?regulation=m-a").status_code == 400


@pytest.mark.django_db
def test_dataset_is_closed_normalized_and_deterministic(
    calculator_data: dict[str, Any], authenticated_client: Client
) -> None:
    response = authenticated_client.get(f"/damage-calculator/data/{VERSION_ID}/m-c/")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, max-age=3600"
    payload = response.json()
    assert set(payload) == {
        "schema_version",
        "data_version",
        "regulation",
        "mechanics",
        "sprite_url_template",
        "state_input_policy",
        "capability",
        "natures",
        "types",
        "forms",
        "abilities",
        "items",
        "moves",
        "mega_item_relations",
        "type_effectiveness",
    }
    assert payload["mechanics"]["hp_formula"] == "base + sp + 75"
    assert payload["schema_version"] == "damage-calculator-data-v2"
    assert payload["state_input_policy"] == STATE_INPUT_POLICY
    assert payload["capability"] == {
        "id": "damage-calculator-v1",
        "context_schema_version": "damage-context-v1",
        "formula_reference": "vgcmulticalc@test",
        "game_type": "Doubles",
        "level": 50,
        "stat_stage_minimum": -6,
        "stat_stage_maximum": 6,
        "status_values": ["", "brn"],
    }
    assert payload["sprite_url_template"].endswith(
        f"/pokedex/sprites/{VERSION_ID}/__FORM__/normal.webp"
    )
    forms = {form["id"]: form for form in payload["forms"]}
    assert forms["charizard"]["searchable"] is True
    assert forms["charizard"]["gender_options"] == ["M", "F"]
    assert forms["charizard"]["default_gender"] == "M"
    assert forms["charizard"]["abilities"] == [
        {"id": "blaze", "slot": "0"},
        {"id": "solarpower", "slot": "H"},
    ]
    assert forms["charizardmegax"]["searchable"] is False
    assert payload["mega_item_relations"] == [
        {
            "item_id": "charizarditex",
            "base_form_id": "charizard",
            "mega_form_id": "charizardmegax",
            "locked_ability_id": "toughclaws",
        }
    ]
    assert payload["moves"][0]["description"] == "May burn adjacent foes."
    assert payload["moves"][0]["flags"] == ["protect"]


@pytest.mark.django_db(transaction=True)
def test_current_release_relations_are_closed_across_all_regulations(
    authenticated_client: Client,
) -> None:
    release = Path(settings.POKEMON_DATA_RELEASES_ROOT) / "showdown-multi-s5-i7-49850c617dd2"
    if not release.is_dir():
        pytest.skip("the reviewed form-search release is required")
    version = load_pokemon_data(release).version
    activate_pokemon_data(version.pk)

    for regulation_id in ("m-a", "m-b", "m-c"):
        response = authenticated_client.get(
            f"/damage-calculator/data/{version.pk}/{regulation_id}/"
        )
        assert response.status_code == 200
        payload = response.json()
        form_ids = {form["id"] for form in payload["forms"]}
        item_ids = {item["id"] for item in payload["items"]}
        ability_ids = {ability["id"] for ability in payload["abilities"]}
        relations = payload["mega_item_relations"]

        assert relations
        assert all(
            relation["base_form_id"] in form_ids
            and relation["mega_form_id"] in form_ids
            and relation["item_id"] in item_ids
            and relation["locked_ability_id"] in ability_ids
            for relation in relations
        )
        assert not any(relation["base_form_id"] == "meowsticf" for relation in relations)


def test_dataset_fails_closed_when_full_move_description_is_empty() -> None:
    profile = MoveProfile(description="")

    with pytest.raises(DamageCalculatorUnavailable, match="move description"):
        _move_description(profile)


@pytest.mark.django_db
def test_dataset_honors_private_etag(
    calculator_data: dict[str, Any], authenticated_client: Client
) -> None:
    first = authenticated_client.get(f"/damage-calculator/data/{VERSION_ID}/m-c/")
    repeated = authenticated_client.get(
        f"/damage-calculator/data/{VERSION_ID}/m-c/",
        headers={"If-None-Match": first.headers["ETag"]},
    )
    assert repeated.status_code == 304
    assert repeated.headers["Cache-Control"] == "private, max-age=3600"


@pytest.mark.django_db
def test_dataset_rejects_stale_malformed_and_non_get_requests(
    calculator_data: dict[str, Any], authenticated_client: Client
) -> None:
    stale = authenticated_client.get("/damage-calculator/data/old/m-c/")
    query = authenticated_client.get(
        f"/damage-calculator/data/{VERSION_ID}/m-c/?regulation=m-c&regulation=m-b"
    )
    regulation = authenticated_client.get(f"/damage-calculator/data/{VERSION_ID}/not-real/")
    method = authenticated_client.post(f"/damage-calculator/data/{VERSION_ID}/m-c/")
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "data-version-changed"
    assert query.status_code == 400
    assert query.json()["error"]["code"] == "invalid-request"
    assert regulation.status_code == 400
    assert regulation.json()["error"]["code"] == "invalid-request"
    assert method.status_code == 405


@pytest.mark.django_db
def test_missing_capability_fails_closed(
    calculator_data: dict[str, Any], authenticated_client: Client
) -> None:
    calculator_data["capability"].delete()
    page = authenticated_client.get("/damage-calculator/")
    explicit = authenticated_client.get("/damage-calculator/?regulation=m-c")
    dataset = authenticated_client.get(f"/damage-calculator/data/{VERSION_ID}/m-c/")
    assert page.status_code == 503
    assert explicit.status_code == 400
    assert dataset.status_code == 503
    assert dataset.json()["error"]["code"] == "data-unavailable"


@pytest.mark.django_db
def test_calculator_requests_have_bounded_query_counts(
    calculator_data: dict[str, Any], authenticated_client: Client
) -> None:
    with CaptureQueriesContext(connection) as page_queries:
        assert authenticated_client.get("/damage-calculator/").status_code == 200
    with CaptureQueriesContext(connection) as dataset_queries:
        assert (
            authenticated_client.get(f"/damage-calculator/data/{VERSION_ID}/m-c/").status_code
            == 200
        )
    assert len(page_queries) <= 9
    assert len(dataset_queries) <= 24

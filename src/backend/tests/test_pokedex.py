"""Request and contract tests for the regulation-aware Pokédex backend."""

from __future__ import annotations

import gzip
import json
import uuid
from collections.abc import Iterable
from pathlib import Path
from typing import Any, cast
from urllib.parse import parse_qs, urlsplit

import pytest
from django.db import connection
from django.http import StreamingHttpResponse
from django.test import Client
from django.test.utils import CaptureQueriesContext

from bagredex import views
from bagredex.accounts.models import User
from bagredex.pokedex import (
    PokedexUnavailable,
    Snapshot,
    form_detail,
    regulation_details,
)
from bagredex.pokemon_data.form_groups import (
    FORM_DISPLAY_NAMES,
    GROUPED_FORM_OPTIONS,
    available_form_group,
    group_representatives,
    pokemon_search_entries,
)
from bagredex.pokemon_data.models import (
    Ability,
    AbilityProfile,
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
    PokemonForm,
    PokemonProfile,
    PokemonProfileAbility,
    PokemonProfileType,
    Regulation,
    RegulationMembership,
    Sprite,
    SpriteMapping,
    Type,
)
from bagredex.pokemon_data.services import activate_pokemon_data, load_pokemon_data

VERSION_ID = "showdown-test-s1-i1-0123456789ab"


def test_grouped_form_metadata_is_explicit_ordered_and_fail_closed() -> None:
    expected = {
        "castform": ["castform", "castformrainy", "castformsnowy", "castformsunny"],
        "aegislash": ["aegislash", "aegislashblade"],
        "gourgeist": ["gourgeist", "gourgeistlarge", "gourgeistsmall", "gourgeistsuper"],
        "squawkabilly": [
            "squawkabilly",
            "squawkabillyblue",
            "squawkabillywhite",
            "squawkabillyyellow",
        ],
    }
    assert {
        base_id: [form_id for form_id, _ in options]
        for base_id, options in GROUPED_FORM_OPTIONS.items()
    } == expected
    assert FORM_DISPLAY_NAMES == {
        "meowstic": "Meowstic-Male",
        "meowsticf": "Meowstic-Female",
    }

    available = set(expected["gourgeist"])
    assert available_form_group("gourgeistsmall", available) == {
        "label": "Form",
        "options": [
            {"id": "gourgeist", "label": "Average"},
            {"id": "gourgeistlarge", "label": "Large"},
            {"id": "gourgeistsmall", "label": "Small"},
            {"id": "gourgeistsuper", "label": "Super"},
        ],
    }
    assert available_form_group("gourgeistsmall", available - {"gourgeist"}) == {
        "label": "Form",
        "options": [
            {"id": "gourgeistlarge", "label": "Large"},
            {"id": "gourgeistsmall", "label": "Small"},
            {"id": "gourgeistsuper", "label": "Super"},
        ],
    }
    assert group_representatives(available - {"gourgeist"}) == {"gourgeist": "gourgeistlarge"}


def test_shared_search_entries_group_only_reviewed_families() -> None:
    entries = pokemon_search_entries(
        iter(
            [
                ("castformrainy", "Castform-Rainy"),
                ("castformsunny", "Castform-Sunny"),
                ("meowstic", "Meowstic"),
                ("meowsticf", "Meowstic-F"),
            ]
        )
    )

    assert entries == [
        {
            "form_id": "castformrainy",
            "name": "Castform",
            "form_group": {
                "label": "Form",
                "options": [
                    {"id": "castformrainy", "label": "Rainy"},
                    {"id": "castformsunny", "label": "Sunny"},
                ],
            },
        },
        {"form_id": "meowstic", "name": "Meowstic-Male", "form_group": None},
        {"form_id": "meowsticf", "name": "Meowstic-Female", "form_group": None},
    ]


def _version(identifier: str = VERSION_ID) -> DataVersion:
    return DataVersion.objects.create(
        id=identifier,
        bundle_hash="a" * 64,
        bundle_schema_version="1",
        importer_version="1",
        source_shape_version="test",
        provenance={},
        validation_summary={},
        semantic_inventory={},
        semantic_diff={},
        manifest={},
    )


def _seal(version: DataVersion) -> None:
    DataVersion.objects.filter(pk=version.pk).update(status=DataVersion.Status.LOADED)
    version.status = DataVersion.Status.LOADED


@pytest.fixture
def pokedex_data(tmp_path: Path, settings: Any) -> dict[str, Any]:
    """Create a small but relation-complete immutable snapshot."""
    settings.POKEMON_DATA_RELEASES_ROOT = tmp_path
    version = _version()
    mechanics = MechanicsProfile.objects.create(
        version=version,
        canonical_id="champions",
        level=50,
        sp_minimum=0,
        sp_maximum=32,
        hp_formula="base + sp + 75",
        other_formula="truncate((base + sp + 20) * nature_percent / 100)",
        nature_percentages={"hindering": 90, "neutral": 100, "increasing": 110},
    )
    regulations = {
        identifier: Regulation.objects.create(
            version=version,
            canonical_id=identifier,
            name=name,
            showdown_format_id=identifier,
            mod="champions",
            ruleset=[],
            mechanics_profile=mechanics,
        )
        for identifier, name in (
            ("m-c", "Regulation M-C"),
            ("m-b", "Regulation M-B"),
            ("m-a", "Regulation M-A"),
        )
    }
    fire = Type.objects.create(version=version, canonical_id="fire", name="Fire")
    flying = Type.objects.create(version=version, canonical_id="flying", name="Flying")
    ability = Ability.objects.create(version=version, canonical_id="blaze", name="Blaze")
    hidden_ability = Ability.objects.create(
        version=version, canonical_id="solarpower", name="Solar Power"
    )
    move = Move.objects.create(version=version, canonical_id="airslash", name="Air Slash")
    early_move = Move.objects.create(version=version, canonical_id="acrobatics", name="acrobatics")
    flag = MoveFlag.objects.create(version=version, canonical_id="protect")
    contact = MoveFlag.objects.create(version=version, canonical_id="contact")
    mega_x_item = Item.objects.create(
        version=version, canonical_id="charizarditex", name="Charizardite X"
    )
    mega_y_item = Item.objects.create(
        version=version, canonical_id="charizarditey", name="Charizardite Y"
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
        sprite_id="charizardmegax",
    )
    mega_y = PokemonForm.objects.create(
        version=version,
        canonical_id="charizardmegay",
        name="Charizard-Mega-Y",
        national_dex_number=6,
        base_form=base,
        form_label="Mega-Y",
        is_mega=True,
        sprite_id="charizardmegay",
    )
    MegaRelation.objects.create(version=version, base_form=base, mega_form=mega)
    MegaRelation.objects.create(version=version, base_form=base, mega_form=mega_y)
    profiles: dict[tuple[str, str], PokemonProfile] = {}
    for regulation_id, regulation in regulations.items():
        ability_profile = AbilityProfile.objects.create(
            version=version,
            regulation=regulation,
            ability=ability,
            short_description="Boosts Fire moves.",
            description="Boosts Fire-type moves when HP is low.",
        )
        hidden_ability_profile = AbilityProfile.objects.create(
            version=version,
            regulation=regulation,
            ability=hidden_ability,
            short_description="Boosts Special Attack.",
            description="Boosts Special Attack in sunshine.",
        )
        mega_x_item_profile = ItemProfile.objects.create(
            version=version,
            regulation=regulation,
            item=mega_x_item,
            source_status="standard",
        )
        mega_y_item_profile = ItemProfile.objects.create(
            version=version,
            regulation=regulation,
            item=mega_y_item,
            source_status="standard",
        )
        move_profile = MoveProfile.objects.create(
            version=version,
            regulation=regulation,
            move=move,
            type=flying,
            category=MoveProfile.Category.SPECIAL,
            base_power=0,
            accuracy=None,
            always_hits=True,
            pp=15,
            priority=0,
            target="normal",
            short_description="Never misses.",
            description="This move never misses.",
        )
        MoveFlagRelation.objects.create(move_profile=move_profile, flag=flag)
        early_move_profile = MoveProfile.objects.create(
            version=version,
            regulation=regulation,
            move=early_move,
            type=flying,
            category=MoveProfile.Category.PHYSICAL,
            base_power=55,
            accuracy=100,
            always_hits=False,
            pp=15,
            priority=0,
            target="normal",
            short_description="Deals damage.",
            description="Deals damage.",
        )
        MoveFlagRelation.objects.create(move_profile=early_move_profile, flag=flag)
        MoveFlagRelation.objects.create(move_profile=early_move_profile, flag=contact)
        for form, stats in (
            (base, (78, 84, 78, 109, 85, 100)),
            (mega, (78, 130, 111, 130, 85, 100)),
            (mega_y, (78, 104, 78, 159, 115, 100)),
        ):
            profile = PokemonProfile.objects.create(
                version=version,
                regulation=regulation,
                form=form,
                hp=stats[0],
                attack=stats[1],
                defense=stats[2],
                special_attack=stats[3],
                special_defense=stats[4],
                speed=stats[5],
                bst=sum(stats),
            )
            profiles[(regulation_id, form.canonical_id)] = profile
            PokemonProfileType.objects.create(profile=profile, type=fire, position=0)
            PokemonProfileAbility.objects.create(
                profile=profile, ability_profile=ability_profile, slot="0"
            )
            PokemonProfileAbility.objects.create(
                profile=profile, ability_profile=hidden_ability_profile, slot="H"
            )
            for learned_move in (early_move_profile, move_profile):
                LearnsetEntry.objects.create(
                    profile=profile,
                    move_profile=learned_move,
                    form_resolution=LearnsetEntry.FormResolution.DIRECT,
                    source_form=form,
                    source_mod=LearnsetEntry.SourceMod.CHAMPIONS,
                    source_kind=LearnsetEntry.SourceKind.DIRECT,
                )
        RegulationMembership.objects.create(profile=profiles[(regulation_id, mega.canonical_id)])
        MegaItemRelation.objects.create(
            version=version,
            regulation=regulation,
            item_profile=mega_x_item_profile,
            base_form=base,
            mega_form=mega,
        )
        MegaItemRelation.objects.create(
            version=version,
            regulation=regulation,
            item_profile=mega_y_item_profile,
            base_form=base,
            mega_form=mega_y,
        )
    # Base is deliberately toggle-only in M-C and legal in M-B.
    RegulationMembership.objects.create(profile=profiles[("m-b", base.canonical_id)])
    large_profile = profiles[("m-c", base.canonical_id)]
    for number in range(30):
        extra_move = Move.objects.create(
            version=version,
            canonical_id=f"testmove{number}",
            name=f"Test Move {number:02}",
        )
        extra_profile = MoveProfile.objects.create(
            version=version,
            regulation=regulations["m-c"],
            move=extra_move,
            type=flying,
            category=MoveProfile.Category.STATUS,
            base_power=0,
            accuracy=100,
            always_hits=False,
            pp=10,
            priority=0,
            target="normal",
            short_description="Test.",
            description="Test.",
        )
        LearnsetEntry.objects.create(
            profile=large_profile,
            move_profile=extra_profile,
            form_resolution=LearnsetEntry.FormResolution.DIRECT,
            source_form=base,
            source_mod=LearnsetEntry.SourceMod.CHAMPIONS,
            source_kind=LearnsetEntry.SourceKind.DIRECT,
        )
    for form in (base, mega, mega_y):
        mapping = SpriteMapping.objects.create(
            version=version,
            form=form,
            pokeapi_pokemon_id=6,
            pokeapi_identifier=form.canonical_id,
            mapping_rule=SpriteMapping.Rule.NORMALIZED_IDENTIFIER,
        )
        for variant in Sprite.Variant.values:
            relative = f"sprites/{variant}/{form.canonical_id}.webp"
            path = tmp_path / VERSION_ID / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"RIFF-test-WEBP")
            Sprite.objects.create(
                version=version,
                mapping=mapping,
                variant=variant,
                path=relative,
                source_path="source.png",
                sha256=("b" if variant == "normal" else "c") * 64,
                width=384,
                height=384,
                provenance={},
            )
    _seal(version)
    activate_pokemon_data(version.pk)
    return {"version": version, "profiles": profiles, "release_root": tmp_path}


@pytest.fixture
def authenticated_client(client: Client) -> Client:
    user = User.objects.create_user(username="leaf", password="test-password")
    client.force_login(user)
    return client


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url",
    (
        "/pokedex/data/m-c/index/?version=x",
        "/pokedex/data/m-c/details/?version=x",
        "/pokedex/data/m-c/pokemon/charizard/details/?version=x",
        "/pokedex/sprites/x/charizard/normal.webp",
    ),
)
def test_pokedex_endpoints_require_authentication(client: Client, url: str) -> None:
    response = client.get(url)
    assert response.status_code == 302
    location = urlsplit(response.headers["Location"])
    assert location.path == "/login/"
    assert parse_qs(location.query) == {"next": [url]}


@pytest.mark.django_db
def test_home_bootstrap_and_regulation_validation(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    response = authenticated_client.get("/?regulation=m-b")
    assert response.status_code == 200
    bootstrap = response.context["pokedex_bootstrap"]
    assert "bagredex_version_label" not in bootstrap
    assert bootstrap["schema_version"] == "pokedex-bootstrap-v2"
    assert bootstrap["active_version"] == VERSION_ID
    assert bootstrap["regulation"] == {
        "id": "m-b",
        "name": "Regulation M-B",
    }
    assert "regulations" not in bootstrap
    assert bootstrap["index_url"].endswith(f"/pokedex/data/m-b/index/?version={VERSION_ID}")
    assert "__FORM__" in bootstrap["detail_url_template"]
    assert bootstrap["details_url"].endswith(f"/pokedex/data/m-b/details/?version={VERSION_ID}")
    assert bootstrap["sprite_url_template"].endswith(
        f"/pokedex/sprites/{VERSION_ID}/__FORM__/__VARIANT__.webp"
    )
    default_response = authenticated_client.get("/")
    assert default_response.status_code == 200
    assert default_response.context["pokedex_bootstrap"]["regulation"]["id"] == "m-c"
    assert default_response.context["regulation_selector"] == {
        "selected_id": "m-c",
        "navigation_suffix": "",
        "choices": [
            {"id": "m-c", "label": "Regulation M-C", "url": "/"},
            {"id": "m-b", "label": "Regulation M-B", "url": "/?regulation=m-b"},
            {"id": "m-a", "label": "Regulation M-A", "url": "/?regulation=m-a"},
        ],
        "preserved_query": [],
    }

    canonical = authenticated_client.get("/?view=grid&tag=first&tag=second&regulation=m-c")
    assert canonical.status_code == 302
    assert canonical.headers["Location"] == "/?view=grid&tag=first&tag=second"
    preserved_response = authenticated_client.get("/?view=grid&tag=first&tag=second")
    preserved_selector = preserved_response.context["regulation_selector"]
    assert preserved_selector["preserved_query"] == [
        {"name": "view", "value": "grid"},
        {"name": "tag", "value": "first"},
        {"name": "tag", "value": "second"},
    ]
    for choice in preserved_selector["choices"]:
        choice_url = urlsplit(choice["url"])
        expected_query = {
            "view": ["grid"],
            "tag": ["first", "second"],
        }
        if choice["id"] != "m-c":
            expected_query["regulation"] = [choice["id"]]
        assert parse_qs(choice_url.query) == expected_query

    ma_response = authenticated_client.get("/?view=grid&regulation=m-a")
    assert ma_response.status_code == 200
    assert ma_response.context["pokedex_bootstrap"]["regulation"]["id"] == "m-a"
    selector = ma_response.context["regulation_selector"]
    assert selector["selected_id"] == "m-a"
    assert selector["navigation_suffix"] == "?regulation=m-a"
    assert selector["preserved_query"] == [{"name": "view", "value": "grid"}]
    assert [choice["id"] for choice in selector["choices"]] == ["m-c", "m-b", "m-a"]
    for choice in selector["choices"]:
        choice_url = urlsplit(choice["url"])
        assert choice_url.path == "/"
        expected_query = {"view": ["grid"]}
        if choice["id"] != "m-c":
            expected_query["regulation"] = [choice["id"]]
        assert parse_qs(choice_url.query) == expected_query

    assert authenticated_client.get("/?regulation=m-c&regulation=m-b").status_code == 400
    assert authenticated_client.get("/?regulation=").status_code == 400
    assert authenticated_client.get("/?regulation=anything").status_code == 400


@pytest.mark.django_db
def test_home_and_index_report_missing_active_data(
    authenticated_client: Client, settings: Any, tmp_path: Path
) -> None:
    settings.VITE_MANIFEST_PATH = tmp_path / "missing-manifest.json"
    response = authenticated_client.get("/")
    assert response.status_code == 503
    assert response.context["pokedex_unavailable"]
    assert response.context.get("regulation_selector") is None
    rendered = response.content.decode()
    assert "data-regulation-selector" not in rendered
    assert 'name="regulation"' not in rendered
    response = authenticated_client.get("/pokedex/data/m-c/index/?version=missing")
    assert response.status_code == 503
    assert response.json()["code"] == "data-unavailable"
    response = authenticated_client.get("/pokedex/data/m-c/details/?version=missing")
    assert response.status_code == 503
    assert response.json()["code"] == "data-unavailable"


@pytest.mark.django_db
def test_index_contract_scoping_order_etag_and_query_bound(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    url = f"/pokedex/data/m-b/index/?version={VERSION_ID}"
    with CaptureQueriesContext(connection) as queries:
        response = authenticated_client.get(url)
    # Two authentication/session queries plus six Pokédex queries, independent of row count.
    assert len(queries) <= 8
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private, no-cache"
    payload = response.json()
    assert payload["schema_version"] == "pokedex-index-v2"
    assert [form["id"] for form in payload["forms"]] == ["charizard", "charizardmegax"]
    assert payload["forms"][0]["types"] == [{"id": "fire", "name": "Fire"}]
    assert payload["forms"][0]["ability_ids"] == ["blaze", "solarpower"]
    assert payload["forms"][0]["move_ids"] == ["acrobatics", "airslash"]
    assert payload["moves"] == [
        {"id": "acrobatics", "name": "acrobatics"},
        {"id": "airslash", "name": "Air Slash"},
    ]
    assert payload["abilities"] == [
        {"id": "blaze", "name": "Blaze"},
        {"id": "solarpower", "name": "Solar Power"},
    ]
    assert payload["types"] == [{"id": "fire", "name": "Fire"}]
    cached = authenticated_client.get(url, HTTP_IF_NONE_MATCH=response.headers["ETag"])
    assert cached.status_code == 304
    assert cached.content == b""
    other = authenticated_client.get(f"/pokedex/data/m-c/index/?version={VERSION_ID}").json()
    assert [form["id"] for form in other["forms"]] == ["charizardmegax"]


@pytest.mark.django_db(transaction=True)
def test_reviewed_release_excludes_nonstandard_magearna_forms_from_both_indexes(
    authenticated_client: Client, settings: Any
) -> None:
    release = (
        settings.REPOSITORY_ROOT
        / "src"
        / "data"
        / "releases"
        / "showdown-3a766f2c-s1-i2-4bedbf1eb44d"
    )
    if not release.is_dir():
        pytest.skip("the data owner has not published the reviewed release yet")
    settings.POKEMON_DATA_RELEASES_ROOT = release.parent
    loaded = load_pokemon_data(release)
    activate_pokemon_data(loaded.version.pk)

    # The canonical legality counts collapse approved variants into one searchable family row.
    for regulation_id, expected_count in (("m-b", 308), ("m-c", 339)):
        response = authenticated_client.get(
            f"/pokedex/data/{regulation_id}/index/?version={loaded.version.pk}"
        )
        assert response.status_code == 200
        form_ids = {form["id"] for form in response.json()["forms"]}
        assert len(form_ids) == expected_count
        assert "charizard" in form_ids
        assert "magearnamega" not in form_ids
        assert "magearnaoriginalmega" not in form_ids


@pytest.mark.django_db(transaction=True)
def test_form_search_release_serializes_groups_and_exact_meowstic_mega_relations(
    authenticated_client: Client, settings: Any
) -> None:
    release = (
        settings.REPOSITORY_ROOT / "src" / "data" / "releases" / "showdown-multi-s5-i7-49850c617dd2"
    )
    if not release.is_dir():
        pytest.skip("the reviewed form-search release is required")
    settings.POKEMON_DATA_RELEASES_ROOT = release.parent
    loaded = load_pokemon_data(release)
    activate_pokemon_data(loaded.version.pk)

    # The retained release above remains 308/339 for M-B/M-C. This release adds the
    # effective, independently searchable female Meowstic profile in every regulation;
    # M-A and M-B also retain Squawkabilly as their effective grouped representative.
    expected_index_counts = {"m-a": 271, "m-b": 309, "m-c": 340}
    for regulation_id in ("m-a", "m-b", "m-c"):
        index_url = f"/pokedex/data/{regulation_id}/index/?version={loaded.version.pk}"
        details_url = f"/pokedex/data/{regulation_id}/details/?version={loaded.version.pk}"
        with CaptureQueriesContext(connection) as index_queries:
            index_response = authenticated_client.get(index_url)
        with CaptureQueriesContext(connection) as detail_queries:
            details_response = authenticated_client.get(details_url)
        assert index_response.status_code == details_response.status_code == 200
        assert len(index_queries) <= 8
        assert len(detail_queries) <= 12

        index_forms = {form["id"]: form for form in index_response.json()["forms"]}
        assert len(index_forms) == expected_index_counts[regulation_id]
        details = details_response.json()
        detail_forms = {form["id"]: form for form in details["forms"]}
        ability_ids = {ability["id"] for ability in details["abilities"]}
        move_ids = {move["id"] for move in details["moves"]}

        for base_id, configured_options in GROUPED_FORM_OPTIONS.items():
            assert base_id in index_forms
            assert not ({form_id for form_id, _ in configured_options[1:]} & index_forms.keys())
            expected_options = [
                {"id": form_id, "label": label}
                for form_id, label in configured_options
                if form_id in detail_forms
            ]
            assert index_forms[base_id]["form_group"] == {
                "label": "Form",
                "options": expected_options,
            }
            assert all(option["id"] in detail_forms for option in expected_options)
            variant_signatures = {
                (
                    tuple(type_["id"] for type_ in detail_forms[option["id"]]["types"]),
                    tuple(stat["base"] for stat in detail_forms[option["id"]]["stats"]),
                    tuple(slot["id"] for slot in detail_forms[option["id"]]["ability_slots"]),
                    tuple(detail_forms[option["id"]]["move_ids"]),
                )
                for option in expected_options
            }
            assert len(variant_signatures) > 1

        if regulation_id in {"m-a", "m-b"}:
            # Squawkabilly is effective but has no list-legal colour in these regulations.
            assert index_forms["squawkabilly"]["name"] == "Squawkabilly"
            assert index_forms["squawkabilly"]["form_group"]["options"] == [
                {"id": form_id, "label": label}
                for form_id, label in GROUPED_FORM_OPTIONS["squawkabilly"]
            ]

        male = index_forms["meowstic"]
        female = index_forms["meowsticf"]
        assert male["name"] == "Meowstic-Male"
        assert female["name"] == "Meowstic-Female"
        assert male["stats"] != female["stats"] or male["ability_ids"] != female["ability_ids"]
        assert detail_forms["meowstic"]["mega_ids"] == ["meowsticmmega"]
        assert detail_forms["meowsticf"]["mega_ids"] == ["meowsticfmega"]
        for target_id in ("meowsticmmega", "meowsticfmega"):
            target = detail_forms[target_id]
            assert target["types"]
            assert set(slot["id"] for slot in target["ability_slots"]) <= ability_ids
            assert target["move_ids"]
            assert set(target["move_ids"]) <= move_ids

        for form_id, expected_target in (
            ("meowstic", "meowsticmmega"),
            ("meowsticf", "meowsticfmega"),
        ):
            response = authenticated_client.get(
                f"/pokedex/data/{regulation_id}/pokemon/{form_id}/details/"
                f"?version={loaded.version.pk}"
            )
            assert response.status_code == 200
            switches = response.json()["form"]["form_switches"]
            assert switches["base"]["id"] == form_id
            assert [mega["id"] for mega in switches["megas"]] == [expected_target]

        castform_response = authenticated_client.get(
            f"/pokedex/data/{regulation_id}/pokemon/castform/details/?version={loaded.version.pk}"
        )
        assert castform_response.status_code == 200
        assert castform_response.json()["form"]["form_group"] == {
            "label": "Form",
            "options": [
                {"id": form_id, "label": label}
                for form_id, label in GROUPED_FORM_OPTIONS["castform"]
            ],
        }


@pytest.mark.django_db
def test_detail_contract_toggle_only_stats_moves_and_query_bound(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    url = f"/pokedex/data/m-c/pokemon/charizard/details/?version={VERSION_ID}"
    with CaptureQueriesContext(connection) as queries:
        response = authenticated_client.get(url)
    # Two authentication/session queries plus ten detail queries, independent of learnset size.
    assert len(queries) <= 12
    form = response.json()["form"]
    assert form["is_list_legal"] is False
    assert form["form_group"] is None
    assert form["form_switches"] == {
        "base": {"id": "charizard", "name": "Charizard"},
        "megas": [
            {"id": "charizardmegax", "name": "Charizard-Mega-X"},
            {"id": "charizardmegay", "name": "Charizard-Mega-Y"},
        ],
    }
    assert form["sprites"]["normal"].endswith(
        f"/pokedex/sprites/{VERSION_ID}/charizard/normal.webp"
    )
    assert form["stats"][0] == {
        "id": "hp",
        "name": "HP",
        "base": 78,
        "real": 153,
        "minimum": 153,
        "maximum": 185,
    }
    assert form["stats"][1] == {
        "id": "atk",
        "name": "Attack",
        "base": 84,
        "real": 104,
        "minimum": 93,
        "maximum": 149,
    }
    assert [ability["slot"] for ability in form["abilities"]] == ["0", "H"]
    assert [move["id"] for move in form["moves"]] == [
        "acrobatics",
        "airslash",
        *(f"testmove{number}" for number in range(30)),
    ]
    assert form["moves"][0]["flags"] == ["contact", "protect"]
    assert form["moves"][1]["base_power"] == 0
    assert form["moves"][1]["accuracy"] is None
    assert form["moves"][1]["always_hits"] is True
    assert form["moves"][0]["priority"] == 0
    assert form["moves"][1]["flags"] == ["protect"]


@pytest.mark.django_db
def test_bulk_details_contract_is_normalized_complete_and_bounded(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    url = f"/pokedex/data/m-c/details/?version={VERSION_ID}"
    with CaptureQueriesContext(connection) as queries:
        response = authenticated_client.get(url)
    assert response.status_code == 200
    assert len(queries) <= 12
    assert response.headers["Cache-Control"] == "private, no-cache"
    payload = response.json()
    assert payload["schema_version"] == "pokedex-details-v2"
    assert payload["data_version"] == VERSION_ID
    assert payload["regulation_id"] == "m-c"
    assert [form["id"] for form in payload["forms"]] == [
        "charizard",
        "charizardmegax",
        "charizardmegay",
    ]
    base, mega_x, mega_y = payload["forms"]
    assert base["name"] == "Charizard"
    assert base["types"] == [{"id": "fire", "name": "Fire"}]
    assert base["is_list_legal"] is False
    assert mega_x["is_list_legal"] is True
    assert mega_y["is_list_legal"] is False
    assert base["form_label"] == ""
    assert mega_x["form_label"] == "Mega-X"
    assert base["base_id"] == "charizard"
    assert base["mega_ids"] == ["charizardmegax", "charizardmegay"]
    assert mega_x["mega_ids"] == base["mega_ids"]
    assert base["stats"][0] == {
        "id": "hp",
        "name": "HP",
        "base": 78,
        "real": 153,
        "minimum": 153,
        "maximum": 185,
    }
    assert base["ability_slots"] == [
        {"id": "blaze", "slot": "0"},
        {"id": "solarpower", "slot": "H"},
    ]
    assert base["move_ids"] == [
        "acrobatics",
        "airslash",
        *(f"testmove{number}" for number in range(30)),
    ]
    assert [ability["id"] for ability in payload["abilities"]] == ["blaze", "solarpower"]
    assert len({ability["id"] for ability in payload["abilities"]}) == 2
    assert len(payload["moves"]) == 32
    assert len({move["id"] for move in payload["moves"]}) == 32
    assert payload["moves"][0]["id"] == "acrobatics"
    assert payload["moves"][0]["flags"] == ["contact", "protect"]
    assert payload["moves"][1]["accuracy"] is None
    assert payload["moves"][1]["always_hits"] is True
    referenced_abilities = {
        slot["id"] for form in payload["forms"] for slot in form["ability_slots"]
    }
    referenced_moves = {move_id for form in payload["forms"] for move_id in form["move_ids"]}
    assert referenced_abilities == {ability["id"] for ability in payload["abilities"]}
    assert referenced_moves == {move["id"] for move in payload["moves"]}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    assert len(raw) > len(gzip.compress(raw))


@pytest.mark.django_db
def test_bulk_details_etag_errors_methods_and_other_regulation(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    url = f"/pokedex/data/m-c/details/?version={VERSION_ID}"
    response = authenticated_client.get(url)
    cached = authenticated_client.get(url, HTTP_IF_NONE_MATCH=response.headers["ETag"])
    assert cached.status_code == 304
    assert cached.content == b""
    assert authenticated_client.post(url).status_code == 405
    assert authenticated_client.get("/pokedex/data/nope/details/?version=old").status_code == 400
    assert authenticated_client.get("/pokedex/data/m-c/details/").status_code == 400
    assert (
        authenticated_client.get(
            f"/pokedex/data/m-c/details/?version={VERSION_ID}&version={VERSION_ID}"
        ).status_code
        == 400
    )
    stale = authenticated_client.get("/pokedex/data/m-c/details/?version=old")
    assert stale.status_code == 409
    assert stale.json()["code"] == "data-version-changed"
    other = authenticated_client.get(f"/pokedex/data/m-b/details/?version={VERSION_ID}")
    assert other.status_code == 200
    assert other.json()["regulation_id"] == "m-b"


@pytest.mark.django_db
def test_detail_query_bound_is_independent_of_large_learnset(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    with CaptureQueriesContext(connection) as queries:
        response = authenticated_client.get(
            f"/pokedex/data/m-c/pokemon/charizard/details/?version={VERSION_ID}"
        )
    assert response.status_code == 200
    assert len(response.json()["form"]["moves"]) == 32
    assert len(queries) <= 12


@pytest.mark.django_db
def test_stale_version_and_boundary_errors(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    stale = authenticated_client.get("/pokedex/data/m-c/index/?version=old")
    assert stale.status_code == 409
    assert stale.json() == {
        "code": "data-version-changed",
        "message": "The active Pokémon data changed. Reload the Pokédex.",
        "active_version": VERSION_ID,
        "url": "/",
    }
    assert authenticated_client.get("/pokedex/data/m-c/index/").status_code == 400
    assert (
        authenticated_client.get(
            f"/pokedex/data/m-c/index/?version={VERSION_ID}&version={VERSION_ID}"
        ).status_code
        == 400
    )
    assert authenticated_client.get("/pokedex/data/not-real/index/?version=old").status_code == 400
    assert (
        authenticated_client.get(
            f"/pokedex/data/m-c/pokemon/Bad-ID/details/?version={VERSION_ID}"
        ).status_code
        == 400
    )
    assert (
        authenticated_client.get(
            f"/pokedex/data/m-c/pokemon/missing/details/?version={VERSION_ID}"
        ).status_code
        == 404
    )
    assert (
        authenticated_client.post(f"/pokedex/data/m-c/index/?version={VERSION_ID}").status_code
        == 405
    )


@pytest.mark.django_db
def test_missing_detail_ignores_conditional_etag(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    url = f"/pokedex/data/m-c/pokemon/missing/details/?version={VERSION_ID}"
    assert authenticated_client.get(url, HTTP_IF_NONE_MATCH="*").status_code == 404


@pytest.mark.django_db
def test_incompatible_mechanics_fail_closed(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    version = pokedex_data["version"]
    regulation = Regulation.objects.select_related("mechanics_profile").get(
        version=version, canonical_id="m-c"
    )
    regulation.mechanics_profile.sp_maximum = 31
    with pytest.raises(PokedexUnavailable, match="unsupported stat mechanics"):
        form_detail(Snapshot(version=version, regulation=regulation), "charizard")
    with pytest.raises(PokedexUnavailable, match="unsupported stat mechanics"):
        regulation_details(Snapshot(version=version, regulation=regulation))


@pytest.mark.django_db
def test_bulk_details_maps_unsupported_mechanics_to_503(
    authenticated_client: Client,
    pokedex_data: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def incompatible(_snapshot: Snapshot) -> dict[str, Any]:
        raise PokedexUnavailable("The active regulation has unsupported stat mechanics.")

    monkeypatch.setattr(views, "regulation_details", incompatible)
    response = authenticated_client.get(f"/pokedex/data/m-c/details/?version={VERSION_ID}")
    assert response.status_code == 503
    assert response.json() == {
        "code": "data-unavailable",
        "message": "The active regulation has unsupported stat mechanics.",
    }


@pytest.mark.django_db
def test_activation_changes_etag_and_rejects_old_page_version(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    old_url = f"/pokedex/data/m-c/index/?version={VERSION_ID}"
    old_response = authenticated_client.get(old_url)
    new_version = _version("showdown-next-s1-i1-fedcba987654")
    mechanics = MechanicsProfile.objects.create(
        version=new_version,
        canonical_id="champions",
        level=50,
        sp_minimum=0,
        sp_maximum=32,
        hp_formula="base + sp + 75",
        other_formula="truncate((base + sp + 20) * nature_percent / 100)",
        nature_percentages={"hindering": 90, "neutral": 100, "increasing": 110},
    )
    Regulation.objects.create(
        version=new_version,
        canonical_id="m-c",
        name="New M-C",
        showdown_format_id="m-c",
        mod="champions",
        ruleset=[],
        mechanics_profile=mechanics,
    )
    _seal(new_version)
    activate_pokemon_data(new_version.pk)
    stale = authenticated_client.get(old_url, HTTP_IF_NONE_MATCH=old_response.headers["ETag"])
    assert stale.status_code == 409
    assert authenticated_client.get("/pokedex/data/m-b/index/?version=old").status_code == 409
    assert (
        authenticated_client.get(f"/pokedex/data/m-b/index/?version={new_version.pk}").status_code
        == 404
    )
    current = authenticated_client.get(
        f"/pokedex/data/m-c/index/?version={new_version.pk}",
        HTTP_IF_NONE_MATCH=old_response.headers["ETag"],
    )
    assert current.status_code == 200
    assert current.headers["ETag"] != old_response.headers["ETag"]


@pytest.mark.django_db
@pytest.mark.parametrize("endpoint", ("index", "detail", "sprite"))
def test_pokedex_read_routes_reject_non_get(
    authenticated_client: Client, pokedex_data: dict[str, Any], endpoint: str
) -> None:
    urls = {
        "index": f"/pokedex/data/m-c/index/?version={VERSION_ID}",
        "detail": f"/pokedex/data/m-c/pokemon/charizard/details/?version={VERSION_ID}",
        "sprite": f"/pokedex/sprites/{VERSION_ID}/charizard/normal.webp",
    }
    response = authenticated_client.post(urls[endpoint])
    assert response.status_code == 405
    assert response.headers["Allow"] == "GET"


@pytest.mark.django_db
def test_sprite_response_is_exact_private_and_path_safe(
    authenticated_client: Client, pokedex_data: dict[str, Any], tmp_path: Path
) -> None:
    url = f"/pokedex/sprites/{VERSION_ID}/charizard/normal.webp"
    response = authenticated_client.get(url)
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "image/webp"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Cache-Control"] == "private, max-age=31536000, immutable"
    content = cast(Iterable[bytes], cast(StreamingHttpResponse, response).streaming_content)
    assert b"".join(content) == b"RIFF-test-WEBP"
    cached = authenticated_client.get(url, HTTP_IF_NONE_MATCH='"' + "b" * 64 + '"')
    assert cached.status_code == 304
    shiny = authenticated_client.get(f"/pokedex/sprites/{VERSION_ID}/charizard/shiny.webp")
    assert shiny.status_code == 200
    assert shiny.headers["ETag"] == '"' + "c" * 64 + '"'
    assert (
        authenticated_client.get(
            f"/pokedex/sprites/{VERSION_ID}/charizard/invalid.webp"
        ).status_code
        == 400
    )
    assert (
        authenticated_client.get(f"/pokedex/sprites/{VERSION_ID}/Bad-ID/normal.webp").status_code
        == 400
    )
    assert (
        authenticated_client.get("/pokedex/sprites/missing/charizard/normal.webp").status_code
        == 404
    )
    sprite = Sprite.objects.get(mapping__form__canonical_id="charizard", variant="normal")
    sprite_file = tmp_path / VERSION_ID / sprite.path
    sprite_file.unlink()
    assert authenticated_client.get(url).status_code == 404


@pytest.mark.django_db
def test_retained_version_sprite_is_served(
    authenticated_client: Client, pokedex_data: dict[str, Any]
) -> None:
    retained = _version("retained-version")
    retained_id = uuid.uuid4()
    form = PokemonForm.objects.create(
        id=retained_id,
        version=retained,
        canonical_id="charizard",
        name="Charizard",
        national_dex_number=6,
        base_form_id=retained_id,
        form_label="",
        is_mega=False,
        sprite_id="charizard",
    )
    mapping = SpriteMapping.objects.create(
        version=retained,
        form=form,
        pokeapi_pokemon_id=6,
        pokeapi_identifier="charizard",
        mapping_rule=SpriteMapping.Rule.NORMALIZED_IDENTIFIER,
    )
    relative = "sprites/normal/charizard.webp"
    sprite_path = pokedex_data["release_root"] / retained.pk / relative
    sprite_path.parent.mkdir(parents=True)
    sprite_path.write_bytes(b"retained")
    Sprite.objects.create(
        version=retained,
        mapping=mapping,
        variant="normal",
        path=relative,
        source_path="source.png",
        sha256="d" * 64,
        width=384,
        height=384,
        provenance={},
    )
    outside = pokedex_data["release_root"] / "outside.webp"
    outside.write_bytes(b"secret")
    symlink = pokedex_data["release_root"] / retained.pk / "sprites" / "normal" / "escape.webp"
    symlink.symlink_to(outside)
    unsafe_paths = {
        "absoluteform": str(outside),
        "traversalform": "../../outside.webp",
        "symlinkform": "sprites/normal/escape.webp",
    }
    for form_id, declared_path in unsafe_paths.items():
        unsafe_id = uuid.uuid4()
        unsafe_form = PokemonForm.objects.create(
            id=unsafe_id,
            version=retained,
            canonical_id=form_id,
            name=form_id,
            national_dex_number=1,
            base_form_id=unsafe_id,
            form_label="",
            is_mega=False,
            sprite_id=form_id,
        )
        unsafe_mapping = SpriteMapping.objects.create(
            version=retained,
            form=unsafe_form,
            pokeapi_pokemon_id=1,
            pokeapi_identifier=form_id,
            mapping_rule=SpriteMapping.Rule.NORMALIZED_IDENTIFIER,
        )
        Sprite.objects.create(
            version=retained,
            mapping=unsafe_mapping,
            variant="normal",
            path=declared_path,
            source_path="source.png",
            sha256="e" * 64,
            width=384,
            height=384,
            provenance={},
        )
    _seal(retained)
    response = authenticated_client.get("/pokedex/sprites/retained-version/charizard/normal.webp")
    assert response.status_code == 200
    assert (
        authenticated_client.get(
            "/pokedex/sprites/retained-version/charizard/shiny.webp"
        ).status_code
        == 404
    )
    for form_id in unsafe_paths:
        assert (
            authenticated_client.get(
                f"/pokedex/sprites/retained-version/{form_id}/normal.webp"
            ).status_code
            == 404
        )

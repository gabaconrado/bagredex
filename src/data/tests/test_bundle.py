from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from src.data.importer.bundle import (
    BundleError,
    EXPECTED_REVISION,
    _apply_overlays,
    _canonical_bytes,
    _extract,
    _load_sprite_mapping,
    _parse_png,
    _parse_webp,
    _sprite_records,
    _unique,
    validate_bundle,
)


class CanonicalEncodingTests(unittest.TestCase):
    def test_encoding_is_sorted_compact_utf8_with_final_newline(self) -> None:
        self.assertEqual(_canonical_bytes({"z": 1, "a": "Flabébé"}), b'{"a":"Flab\xc3\xa9b\xc3\xa9","z":1}\n')

    def test_duplicate_composite_key_is_rejected(self) -> None:
        records = [{"regulation_id": "m-c", "id": "move"}] * 2
        with self.assertRaisesRegex(BundleError, "duplicate key"):
            _unique(records, ("regulation_id", "id"), "moves.json")


class SpriteSelectionTests(unittest.TestCase):
    def test_both_home_variants_are_converted_and_hashed(self) -> None:
        repository = Path(__file__).parents[3]
        source = repository / "references" / "sprites" / "sprites" / "pokemon" / "other" / "home"
        if not source.is_dir() or shutil.which("cwebp") is None:
            self.skipTest("local PokeAPI sprites or cwebp are unavailable")
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            sprites = root / "sprites-repository"
            pokeapi = root / "pokeapi"
            output = root / "output"
            normal = sprites / "sprites" / "pokemon" / "other" / "home"
            shiny = normal / "shiny"
            shiny.mkdir(parents=True)
            shutil.copyfile(source / "25.png", normal / "25.png")
            shutil.copyfile(source / "shiny" / "25.png", shiny / "25.png")
            csv_path = pokeapi / "data" / "v2" / "csv"
            csv_path.mkdir(parents=True)
            (csv_path / "pokemon.csv").write_text(
                "id,identifier,species_id,height,weight,base_experience,order,is_default\n"
                "25,pikachu,25,4,60,112,35,1\n",
                encoding="utf-8",
            )
            output.mkdir()
            records = _sprite_records(
                [{"id": "pikachu", "national_dex_number": 25}], sprites, pokeapi, output
            )
            self.assertEqual([record["variant"] for record in records], ["normal", "shiny"])
            self.assertTrue(all(len(record["sha256"]) == 64 for record in records))
            self.assertEqual({(record["width"], record["height"]) for record in records}, {(384, 384)})
            self.assertTrue(all(_parse_webp(output / record["path"])["has_alpha"] for record in records))
            normal_record = next(record for record in records if record["variant"] == "normal")
            self.assertEqual(
                normal_record["sha256"],
                "a9d1ab2ab66a1be440143caedbef08f3a0d373a1c0d936a715d6a8fdff40db92",
            )

    def test_missing_shiny_sprite_fails_closed(self) -> None:
        repository = Path(__file__).parents[3]
        source = repository / "references" / "sprites" / "sprites" / "pokemon" / "other" / "home"
        if not source.is_dir() or shutil.which("cwebp") is None:
            self.skipTest("local PokeAPI sprites or cwebp are unavailable")
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            normal = root / "sprites" / "sprites" / "pokemon" / "other" / "home"
            normal.mkdir(parents=True)
            shutil.copyfile(source / "25.png", normal / "25.png")
            csv_path = root / "pokeapi" / "data" / "v2" / "csv"
            csv_path.mkdir(parents=True)
            (csv_path / "pokemon.csv").write_text(
                "id,identifier,species_id,height,weight,base_experience,order,is_default\n"
                "25,pikachu,25,4,60,112,35,1\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(BundleError, "required shiny PokeAPI HOME sprite"):
                _sprite_records(
                    [{"id": "pikachu", "national_dex_number": 25}],
                    root / "sprites", root / "pokeapi", root / "output",
                )

    def test_complete_mapping_is_unique_and_covers_reviewed_exceptions(self) -> None:
        repository = Path(__file__).parents[3]
        showdown = repository / "references" / "pokemon-showdown"
        pokeapi = repository / "references" / "pokeapi"
        if not showdown.is_dir() or not pokeapi.is_dir():
            self.skipTest("local source snapshots are unavailable")
        forms = _extract(showdown)["forms"]
        mapping = _load_sprite_mapping(forms, pokeapi)
        self.assertEqual(len(mapping), 353)
        self.assertEqual(len({value["pokemon_id"] for value in mapping.values()}), 353)
        self.assertEqual(mapping["aegislash"]["pokemon_identifier"], "aegislash-shield")
        self.assertEqual(mapping["meowsticfmega"]["pokemon_identifier"], "meowstic-female-mega")

    def test_home_source_png_has_exact_approved_structure(self) -> None:
        path = Path(__file__).parents[3] / "references" / "sprites" / "sprites" / "pokemon" / "other" / "home" / "59.png"
        if not path.is_file():
            self.skipTest("local PokeAPI sprites are unavailable")
        self.assertEqual(
            _parse_png(path),
            {"width": 512, "height": 512, "bit_depth": 8, "color_type": 6, "interlace": 0},
        )

    def test_duplicate_exact_mapping_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            csv_path = Path(name) / "data" / "v2" / "csv"
            csv_path.mkdir(parents=True)
            header = "id,identifier,species_id,height,weight,base_experience,order,is_default\n"
            (csv_path / "pokemon.csv").write_text(
                header + "25,pikachu,25,4,60,112,35,1\n26,pikachu,25,4,60,112,35,0\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(BundleError, "maps to 2"):
                _load_sprite_mapping([{"id": "pikachu", "national_dex_number": 25}], Path(name))

    def test_malformed_numeric_mapping_is_contextual(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            csv_path = Path(name) / "data" / "v2" / "csv"
            csv_path.mkdir(parents=True)
            (csv_path / "pokemon.csv").write_text(
                "id,identifier,species_id,height,weight,base_experience,order,is_default\n"
                "oops,pikachu,25,4,60,112,35,1\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(BundleError, "pokemon.csv:2: id and species_id"):
                _load_sprite_mapping([{"id": "pikachu", "national_dex_number": 25}], Path(name))


class OverlayTests(unittest.TestCase):
    def test_overlay_applies_only_when_before_and_fixture_match(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            overrides = root / "overrides"
            fixtures = root / "fixtures"
            output = root / "output"
            overrides.mkdir()
            fixtures.mkdir()
            output.mkdir()
            before = {"id": "pikachu", "name": "Pikachu"}
            after = {"id": "pikachu", "name": "Pikachu corrected"}
            overlay = {
                "id": "pikachu-name", "showdown_revision": EXPECTED_REVISION,
                "record": "forms.json:pikachu", "rationale": "Fixture proves the defect.",
                "authoring_date": "2026-10-15", "before": before, "after": after,
                "fixture": "proof.json",
            }
            fixture = {
                "overlay_id": "pikachu-name", "record": "forms.json:pikachu",
                "expected_before": before, "expected_after": after,
            }
            (fixtures / "proof.json").write_bytes(_canonical_bytes(fixture))
            (overrides / "pikachu-name.json").write_bytes(_canonical_bytes(overlay))
            records = {"forms.json": [before]}
            applied = _apply_overlays(records, overrides, fixtures, output)
            self.assertEqual(records["forms.json"], [after])
            self.assertEqual(applied[0]["record"], "forms.json:pikachu")

    def test_overlay_rejects_stale_before_value(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / "overrides").mkdir()
            (root / "fixtures").mkdir()
            (root / "output").mkdir()
            overlay = {
                "id": "stale", "showdown_revision": EXPECTED_REVISION,
                "record": "forms.json:pikachu", "rationale": "Regression.",
                "authoring_date": "2026-10-15", "before": {"id": "pikachu", "name": "Old"},
                "after": {"id": "pikachu", "name": "New"}, "fixture": "proof.json",
            }
            fixture = {
                "overlay_id": "stale", "record": "forms.json:pikachu",
                "expected_before": overlay["before"], "expected_after": overlay["after"],
            }
            (root / "fixtures" / "proof.json").write_bytes(_canonical_bytes(fixture))
            (root / "overrides" / "stale.json").write_bytes(_canonical_bytes(overlay))
            with self.assertRaisesRegex(BundleError, "before value no longer matches"):
                _apply_overlays(
                    {"forms.json": [{"id": "pikachu", "name": "Current"}]},
                    root / "overrides", root / "fixtures", root / "output",
                )


class SchemaArtifactTests(unittest.TestCase):
    def test_schema_documents_are_valid_json(self) -> None:
        schema_root = Path(__file__).parents[1] / "schema"
        for path in sorted(schema_root.glob("*.json")):
            with self.subTest(path=path.name):
                self.assertIsInstance(json.loads(path.read_text(encoding="utf-8")), dict)

    def test_record_schema_exposes_every_portable_file_root(self) -> None:
        schema = json.loads(
            (Path(__file__).parents[1] / "schema" / "records-v1.schema.json").read_text()
        )
        roots = schema["$defs"]["file_roots"]["properties"]
        self.assertEqual(
            set(roots),
            {
                "mechanics_profiles.json", "regulations.json", "forms.json", "types.json",
                "abilities.json", "moves.json", "move_flags.json",
                "regulation_memberships.json", "profiles.json", "ability_profiles.json",
                "move_profiles.json", "move_flag_relations.json", "mega_relations.json",
                "learnsets.json", "sprite_mappings.json", "sprites.json",
            },
        )
        self.assertTrue(all("$ref" in value["items"] for value in roots.values()))


class LocalSnapshotIntegrationTests(unittest.TestCase):
    def test_synthetic_pre_evolution_fallback_records_resolution(self) -> None:
        data_root = Path(__file__).parents[1]
        fixture = json.loads((data_root / "fixtures" / "pre-evolution-learnset.json").read_text())
        module = (data_root / "importer" / "learnset-resolution.mjs").as_uri()
        script = (
            f"import {{resolveLearnset}} from {json.dumps(module)};"
            f"const x={json.dumps(fixture)};"
            "const result=resolveLearnset({formID:x.form_id,table:x.table,moves:x.moves,"
            "regulationID:'m-c',pokedex:x.pokedex,sourceFor:()=>({source_mod:'base',source_kind:'inherited'})});"
            "process.stdout.write(JSON.stringify(result));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script], check=True,
            capture_output=True, text=True,
        )
        relation = json.loads(result.stdout)[0][1]
        self.assertEqual(relation["form_resolution"], "pre-evolution")
        self.assertEqual(relation["source_form_id"], "parent")

    def test_extraction_is_deterministic_and_has_expected_regulations(self) -> None:
        showdown = Path(__file__).parents[3] / "references" / "pokemon-showdown"
        if not showdown.is_dir():
            self.skipTest("user-supplied Showdown snapshot is not present")
        first = _extract(showdown)
        second = _extract(showdown)
        self.assertEqual(_canonical_bytes(first), _canonical_bytes(second))
        self.assertEqual({value["id"] for value in first["formats"]}, {"m-b", "m-c"})
        self.assertEqual(len(first["regulations"]["m-c"]["memberships"]), 351)
        self.assertEqual(len(first["regulations"]["m-b"]["memberships"]), 316)
        self.assertEqual(len(first["regulations"]["m-c"]["profiles"]), 353)
        self.assertEqual(len(first["regulations"]["m-b"]["profiles"]), 353)
        forms = {value["id"]: value for value in first["forms"]}
        self.assertEqual(forms["charizardmegax"]["sprite_id"], "charizard-megax")
        self.assertTrue(forms["absolmegaz"]["is_mega"])
        self.assertEqual(
            forms["arcaninehisui"],
            {"id": "arcaninehisui", "name": "Arcanine-Hisui", "national_dex_number": 59,
             "base_form_id": "arcanine", "form_label": "Hisui", "is_mega": False,
             "sprite_id": "arcanine-hisui"},
        )
        self.assertEqual(forms["indeedeef"]["form_label"], "F")
        self.assertEqual(forms["indeedeef"]["base_form_id"], "indeedee")
        profiles = {
            value["form_id"]: value for value in first["regulations"]["m-c"]["profiles"]
        }
        self.assertEqual(profiles["charizardmegax"]["types"], ["Fire", "Dragon"])
        self.assertEqual(profiles["charizardmegax"]["bst"], 634)
        self.assertEqual(profiles["arcaninehisui"]["types"], ["Fire", "Rock"])
        self.assertEqual(profiles["arcaninehisui"]["stats"], {
            "hp": 95, "atk": 115, "def": 80, "spa": 95, "spd": 80, "spe": 90,
        })
        mc_moves = {value["id"]: value for value in first["regulations"]["m-c"]["moves"]}
        mb_moves = {value["id"]: value for value in first["regulations"]["m-b"]["moves"]}
        self.assertEqual(mc_moves["strengthsap"]["pp"], 5)
        self.assertEqual(mb_moves["strengthsap"]["pp"], 10)
        self.assertIn("Lowers Atk by 1", mc_moves["strengthsap"]["short_description"])
        self.assertEqual(
            {key: mc_moves["flamethrower"][key] for key in ("type", "category", "base_power", "accuracy", "pp", "priority", "target", "flags")},
            {"type": "Fire", "category": "Special", "base_power": 90, "accuracy": 100,
             "pp": 15, "priority": 0, "target": "normal",
             "flags": ["metronome", "mirror", "protect"]},
        )
        self.assertEqual(
            {key: mc_moves["protect"][key] for key in ("category", "base_power", "accuracy", "priority", "target")},
            {"category": "Status", "base_power": 0, "accuracy": "always", "priority": 4,
             "target": "self"},
        )
        self.assertEqual(mc_moves["aerialace"]["category"], "Physical")
        self.assertEqual(mc_moves["aerialace"]["accuracy"], "always")
        self.assertEqual(mc_moves["fakeout"]["priority"], 3)
        self.assertEqual(
            mc_moves["drainpunch"]["flags"],
            ["contact", "heal", "metronome", "mirror", "protect", "punch"],
        )
        mc_abilities = {value["id"]: value for value in first["regulations"]["m-c"]["abilities"]}
        self.assertEqual(
            mc_abilities["intimidate"]["short_description"],
            "On switch-in, this Pokemon lowers the Attack of opponents by 1 stage.",
        )
        self.assertEqual(
            mc_abilities["intimidate"]["description"],
            "On switch-in, this Pokemon lowers the Attack of opposing Pokemon by 1 stage. "
            "Pokemon with the Inner Focus, Oblivious, Own Tempo, or Scrappy Abilities and "
            "Pokemon behind a substitute are immune.",
        )
        charizard_mega_moves = [
            value for value in first["regulations"]["m-c"]["learnsets"]
            if value["form_id"] == "charizardmegax"
        ]
        self.assertTrue(charizard_mega_moves)
        self.assertEqual({value["form_resolution"] for value in charizard_mega_moves}, {"base-to-mega"})
        self.assertEqual({value["source_form_id"] for value in charizard_mega_moves}, {"charizard"})
        mb_archaludon = [
            value for value in first["regulations"]["m-b"]["learnsets"]
            if value["form_id"] == "archaludon"
        ]
        self.assertTrue(mb_archaludon)
        self.assertEqual({value["source_mod"] for value in mb_archaludon}, {"championsregmb"})
        self.assertEqual({value["source_kind"] for value in mb_archaludon}, {"override"})
        mb_charizard = [
            value for value in first["regulations"]["m-b"]["learnsets"]
            if value["form_id"] == "charizard"
        ]
        self.assertEqual({value["source_kind"] for value in mb_charizard}, {"inherited"})
        aegislash_blade = [
            value for value in first["regulations"]["m-c"]["learnsets"]
            if value["form_id"] == "aegislashblade"
        ]
        self.assertEqual(len(aegislash_blade), 46)
        self.assertEqual({value["form_resolution"] for value in aegislash_blade}, {"changed-form"})
        self.assertEqual({value["source_form_id"] for value in aegislash_blade}, {"aegislash"})
        mawile_relations = [
            value for value in first["mega_relations"] if value["base_form_id"] == "mawile"
        ]
        self.assertEqual(mawile_relations, [{"base_form_id": "mawile", "mega_form_id": "mawilemega"}])


class PublishedBundleMutationTests(unittest.TestCase):
    def test_published_release_preserves_representative_real_goldens(self) -> None:
        releases = Path(__file__).parents[1] / "releases"
        available = sorted(path for path in releases.glob("showdown-*") if path.is_dir())
        if not available:
            self.skipTest("reviewed release has not been generated")
        bundle = available[0]

        def records(filename: str) -> list[dict]:
            return json.loads((bundle / filename).read_text(encoding="utf-8"))

        forms = {value["id"]: value for value in records("forms.json")}
        self.assertEqual(
            forms["arcaninehisui"],
            {
                "base_form_id": "arcanine",
                "form_label": "Hisui",
                "id": "arcaninehisui",
                "is_mega": False,
                "name": "Arcanine-Hisui",
                "national_dex_number": 59,
                "sprite_id": "arcanine-hisui",
            },
        )
        self.assertEqual(forms["indeedeef"]["form_label"], "F")
        self.assertEqual(forms["indeedeef"]["base_form_id"], "indeedee")
        self.assertEqual(forms["aegislashblade"]["form_label"], "Blade")
        self.assertEqual(forms["aegislashblade"]["base_form_id"], "aegislash")
        self.assertEqual(
            forms["mawilemega"],
            {
                "base_form_id": "mawile",
                "form_label": "Mega",
                "id": "mawilemega",
                "is_mega": True,
                "name": "Mawile-Mega",
                "national_dex_number": 303,
                "sprite_id": "mawile-mega",
            },
        )

        mega_relations = records("mega_relations.json")
        self.assertEqual(
            [value for value in mega_relations if value["base_form_id"] == "mawile"],
            [{"base_form_id": "mawile", "mega_form_id": "mawilemega"}],
        )

        learnsets = records("learnsets.json")
        blade_moves = [
            value
            for value in learnsets
            if value["regulation_id"] == "m-c" and value["form_id"] == "aegislashblade"
        ]
        self.assertEqual(len(blade_moves), 46)
        self.assertEqual({value["form_resolution"] for value in blade_moves}, {"changed-form"})
        self.assertEqual({value["source_form_id"] for value in blade_moves}, {"aegislash"})

        move_profiles = {
            (value["regulation_id"], value["id"]): value
            for value in records("move_profiles.json")
        }
        mc_moves = {
            move_id: move_profiles[("m-c", move_id)]
            for move_id in {
                "aerialace",
                "drainpunch",
                "fakeout",
                "flamethrower",
                "protect",
            }
        }
        self.assertEqual(
            (mc_moves["aerialace"]["category"], mc_moves["aerialace"]["accuracy"]),
            ("Physical", "always"),
        )
        self.assertEqual(mc_moves["flamethrower"]["category"], "Special")
        self.assertEqual(
            (
                mc_moves["protect"]["category"],
                mc_moves["protect"]["accuracy"],
                mc_moves["protect"]["priority"],
            ),
            ("Status", "always", 4),
        )
        self.assertEqual(mc_moves["fakeout"]["priority"], 3)
        move_flags = records("move_flag_relations.json")
        self.assertEqual(
            {
                value["flag_id"]
                for value in move_flags
                if value["regulation_id"] == "m-c" and value["move_id"] == "drainpunch"
            },
            {"contact", "heal", "metronome", "mirror", "protect", "punch"},
        )

        ability_profiles = {
            (value["regulation_id"], value["id"]): value
            for value in records("ability_profiles.json")
        }
        self.assertEqual(
            ability_profiles[("m-c", "intimidate")]["description"],
            "On switch-in, this Pokemon lowers the Attack of opposing Pokemon by 1 stage. "
            "Pokemon with the Inner Focus, Oblivious, Own Tempo, or Scrappy Abilities and "
            "Pokemon behind a substitute are immune.",
        )

    def test_representative_contract_mutations_fail_closed(self) -> None:
        releases = Path(__file__).parents[1] / "releases"
        available = sorted(path for path in releases.glob("showdown-*") if path.is_dir())
        if not available:
            self.skipTest("reviewed release has not been generated")
        with tempfile.TemporaryDirectory() as name:
            bundle = Path(name) / available[0].name
            shutil.copytree(available[0], bundle)

            def rejected(filename: str, mutate) -> None:
                path = bundle / filename
                original = path.read_bytes()
                value = json.loads(original)
                mutate(value)
                path.write_bytes(_canonical_bytes(value))
                try:
                    with self.assertRaises(BundleError):
                        validate_bundle(bundle)
                finally:
                    path.write_bytes(original)

            rejected("forms.json", lambda value: value[0].pop("name"))
            rejected("forms.json", lambda value: value[0].update({"unexpected": True}))
            rejected("forms.json", lambda value: value[0].update({"national_dex_number": "one"}))
            rejected("sprites.json", lambda value: value[0].update({"variant": "sparkle"}))
            rejected("mega_relations.json", lambda value: value[0].update({"base_form_id": value[0]["mega_form_id"]}))
            rejected("learnsets.json", lambda value: value[0].update({"source_form_id": "pikachu"}))
            rejected("sprite_mappings.json", lambda value: value[0].update({"pokeapi_pokemon_id": 1}))
            notice = bundle / "POKEMON-SHOWDOWN-LICENSE.txt"
            original_notice = notice.read_bytes()
            notice.write_bytes(original_notice + b"altered\n")
            with self.assertRaises(BundleError):
                validate_bundle(bundle)
            notice.write_bytes(original_notice)
            rejected("manifest.json", lambda value: value.update({"unexpected": True}))
            rejected("manifest.json", lambda value: value.update({"validation_status": 1}))


if __name__ == "__main__":
    unittest.main()

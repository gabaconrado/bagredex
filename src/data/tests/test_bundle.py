from __future__ import annotations

import copy
import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from src.data.importer.bundle import (
    EXPECTED_REVISION,
    M_A_ITEM_TEXT_OVERLAY_IDS,
    BundleError,
    _apply_m_a_item_text_overlay,
    _apply_overlays,
    _canonical_bytes,
    _combine_extractions,
    _extract,
    _load_sprite_mapping,
    _materialize_historical_tree,
    _parse_png,
    _parse_webp,
    _sprite_records,
    _unique,
    compare_bundles,
    validate_bundle,
)


class MultiRevisionSourceTests(unittest.TestCase):
    def test_exact_m_a_item_text_compatibility_set_is_applied(self) -> None:
        repository = Path(__file__).parents[3]
        showdown = repository / "references" / "pokemon-showdown"
        current = _extract(showdown)
        with tempfile.TemporaryDirectory() as name:
            historical_root = Path(name) / "tree"
            _materialize_historical_tree(showdown, historical_root)
            historical = _extract(historical_root, "m-a")
            before_memberships = copy.deepcopy(
                historical["regulations"]["m-a"]["memberships"]
            )
            before_mega = copy.deepcopy(historical["mega_relations"])
            overlay, _, fixtures = _apply_m_a_item_text_overlay(
                current,
                historical,
                repository / "src" / "data" / "overrides",
                repository / "src" / "data" / "fixtures",
            )
        self.assertEqual(
            {value["item_id"] for value in overlay["transitions"]},
            M_A_ITEM_TEXT_OVERLAY_IDS,
        )
        self.assertEqual(len(fixtures), 6)
        profiles = {
            value["id"]: value for value in historical["regulations"]["m-a"]["items"]
        }
        self.assertTrue(
            all(
                profiles[item_id]["short_description"]
                for item_id in M_A_ITEM_TEXT_OVERLAY_IDS
            )
        )
        self.assertEqual(
            historical["regulations"]["m-a"]["memberships"], before_memberships
        )
        self.assertEqual(historical["mega_relations"], before_mega)

    def test_m_a_item_text_compatibility_rejects_wrong_target_set(self) -> None:
        repository = Path(__file__).parents[3]
        showdown = repository / "references" / "pokemon-showdown"
        current = _extract(showdown)
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            historical_root = root / "tree"
            _materialize_historical_tree(showdown, historical_root)
            historical = _extract(historical_root, "m-a")
            overrides = root / "overrides"
            fixtures = root / "fixtures"
            shutil.copytree(repository / "src" / "data" / "overrides", overrides)
            shutil.copytree(repository / "src" / "data" / "fixtures", fixtures)
            path = overrides / "m-a-item-text-compatibility.json"
            value = json.loads(path.read_text(encoding="utf-8"))
            value["transitions"].pop()
            path.write_bytes(_canonical_bytes(value))
            with self.assertRaisesRegex(BundleError, "exactly six transitions"):
                _apply_m_a_item_text_overlay(current, historical, overrides, fixtures)

    def test_historical_tree_is_materialized_without_mutating_checkout(self) -> None:
        repository = Path(__file__).parents[3] / "references" / "pokemon-showdown"
        if not (repository / ".git").exists():
            self.skipTest("local Pokémon Showdown checkout is unavailable")
        before = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=repository,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        with tempfile.TemporaryDirectory() as name:
            tree = Path(name) / "tree"
            _materialize_historical_tree(repository, tree)
            extracted = _extract(tree, "m-a")
            self.assertEqual([value["id"] for value in extracted["formats"]], ["m-a"])
            self.assertEqual(
                extracted["formats"][0]["name"],
                "[Gen 9 Champions] VGC 2026 Reg M-A",
            )
        after = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=repository,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        self.assertEqual(after, before)

    def test_missing_historical_object_fails_closed(self) -> None:
        repository = Path(__file__).parents[3] / "references" / "pokemon-showdown"
        with (
            tempfile.TemporaryDirectory() as name,
            mock.patch("src.data.importer.bundle._run", return_value="0" * 40),
            self.assertRaisesRegex(BundleError, "historical Showdown object resolved"),
        ):
            _materialize_historical_tree(repository, Path(name) / "tree")

    def test_wrong_historical_commit_date_fails_closed(self) -> None:
        repository = Path(__file__).parents[3] / "references" / "pokemon-showdown"
        with (
            tempfile.TemporaryDirectory() as name,
            mock.patch(
                "src.data.importer.bundle._run",
                side_effect=[
                    "b555f4d8ce7250e72939fe0c12cc5b303741d203",
                    "2026-04-11",
                ],
            ),
            self.assertRaisesRegex(BundleError, "commit date changed"),
        ):
            _materialize_historical_tree(repository, Path(name) / "tree")

    def test_invalid_historical_archive_fails_closed(self) -> None:
        repository = Path(__file__).parents[3] / "references" / "pokemon-showdown"
        completed = subprocess.CompletedProcess([], 0, stdout=b"not a tar", stderr=b"")
        with (
            tempfile.TemporaryDirectory() as name,
            mock.patch(
                "src.data.importer.bundle._run",
                side_effect=[
                    "b555f4d8ce7250e72939fe0c12cc5b303741d203",
                    "2026-04-10",
                ],
            ),
            mock.patch(
                "src.data.importer.bundle.subprocess.run", return_value=completed
            ),
            self.assertRaisesRegex(BundleError, "archive is invalid"),
        ):
            _materialize_historical_tree(repository, Path(name) / "tree")

    def test_cross_revision_identity_conflict_fails_closed(self) -> None:
        form = {
            "id": "pikachu",
            "name": "Pikachu",
            "national_dex_number": 25,
            "base_form_id": "pikachu",
            "form_label": "",
            "is_mega": False,
            "sprite_id": "pikachu",
        }
        historical = {
            "formats": [{"id": "m-a"}],
            "forms": [form],
            "mega_relations": [],
            "regulations": {"m-a": {}},
            "source_counts": {},
        }
        current = {
            "formats": [{"id": "m-b"}, {"id": "m-c"}],
            "forms": [{**form, "name": "Pikachu conflict"}],
            "mega_relations": [],
            "regulations": {"m-b": {}, "m-c": {}},
            "source_counts": {},
        }
        with self.assertRaisesRegex(BundleError, "form identity conflict"):
            _combine_extractions(current, historical)


class CanonicalEncodingTests(unittest.TestCase):
    def test_encoding_is_sorted_compact_utf8_with_final_newline(self) -> None:
        self.assertEqual(
            _canonical_bytes({"z": 1, "a": "Flabébé"}),
            b'{"a":"Flab\xc3\xa9b\xc3\xa9","z":1}\n',
        )

    def test_duplicate_composite_key_is_rejected(self) -> None:
        records = [{"regulation_id": "m-c", "id": "move"}] * 2
        with self.assertRaisesRegex(BundleError, "duplicate key"):
            _unique(records, ("regulation_id", "id"), "moves.json")


class HeldItemMechanicsTests(unittest.TestCase):
    def test_source_callbacks_normalize_supported_stat_modifiers(self) -> None:
        repository = Path(__file__).parents[3]
        script = """
import {pathToFileURL} from 'node:url';
import {itemStatModifiers} from './src/data/importer/held-item-mechanics.mjs';
const root = process.argv[1];
const {Items} = await import(pathToFileURL(`${root}/data/items.ts`).href);
const ids = ['choicescarf', 'choiceband', 'choicespecs', 'assaultvest', 'eviolite', 'lifeorb', 'liechiberry'];
const facts = Object.fromEntries(ids.map(id => [id, itemStatModifiers(Items[id])]));
facts.unsupportedConditional = itemStatModifiers({
  onModifyAtk(atk, pokemon) {
    if (pokemon.status) return this.chainModify(1.5);
  },
});
facts.nonExactDecimal = itemStatModifiers({
  onModifyAtk(atk) {
    return this.chainModify(1.1);
  },
});
console.log(JSON.stringify(facts));
"""
        output = subprocess.run(
            [
                "node",
                "--no-warnings",
                "--input-type=module",
                "--eval",
                script,
                str(repository / "references" / "pokemon-showdown"),
            ],
            cwd=repository,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        facts = json.loads(output)
        expected = {
            "choicescarf": ("spe", "always"),
            "choiceband": ("atk", "always"),
            "choicespecs": ("spa", "always"),
            "assaultvest": ("spd", "always"),
        }
        for item_id, (stat, eligibility) in expected.items():
            self.assertEqual(
                facts[item_id],
                [
                    {
                        "stat": stat,
                        "numerator": 6144,
                        "denominator": 4096,
                        "eligibility": eligibility,
                    }
                ],
            )
        self.assertEqual(
            facts["eviolite"],
            [
                {
                    "stat": stat,
                    "numerator": 6144,
                    "denominator": 4096,
                    "eligibility": "form_is_nfe",
                }
                for stat in ("def", "spd")
            ],
        )
        self.assertEqual(facts["lifeorb"], [])
        self.assertEqual(facts["liechiberry"], [])
        self.assertEqual(facts["unsupportedConditional"], [])
        self.assertEqual(
            facts["nonExactDecimal"],
            [
                {
                    "stat": "atk",
                    "numerator": 4505,
                    "denominator": 4096,
                    "eligibility": "always",
                }
            ],
        )

    def test_release_contains_only_legal_normalized_mechanics(self) -> None:
        release = (
            Path(__file__).parents[1] / "releases" / "showdown-multi-s6-i8-e712c7acc763"
        )
        items = json.loads((release / "item_profiles.json").read_text())
        abilities = json.loads((release / "ability_profiles.json").read_text())
        modifiers = {
            (value["regulation_id"], value["id"]): value["stat_modifiers"]
            for value in items
            if value["stat_modifiers"]
        }
        self.assertEqual(
            modifiers[("m-c", "choicescarf")],
            [
                {
                    "denominator": 4096,
                    "eligibility": "always",
                    "numerator": 6144,
                    "stat": "spe",
                }
            ],
        )
        self.assertEqual(
            modifiers[("m-c", "ironball")][0],
            {
                "denominator": 4096,
                "eligibility": "always",
                "numerator": 2048,
                "stat": "spe",
            },
        )
        self.assertEqual(
            {
                value["regulation_id"]
                for value in abilities
                if value["suppresses_held_item"] and value["id"] == "klutz"
            },
            {"m-a", "m-b", "m-c"},
        )
        self.assertFalse(
            any(
                value["suppresses_held_item"] and value["id"] != "klutz"
                for value in abilities
            )
        )

    def test_membership_provenance_release_has_exact_meowstic_delta(self) -> None:
        releases = Path(__file__).parents[1] / "releases"
        previous = releases / "showdown-multi-s6-i8-e712c7acc763"
        release = releases / "showdown-multi-s7-i9-78b322057dd0"
        self.assertEqual(validate_bundle(previous)["status"], "valid")
        summary = validate_bundle(release)
        self.assertEqual(summary["status"], "valid")
        self.assertEqual(
            summary["counts"]["legal_forms_by_regulation"],
            {"m-a": 273, "m-b": 315, "m-c": 350},
        )
        memberships = json.loads(
            (release / "regulation_memberships.json").read_text(encoding="utf-8")
        )
        female = [value for value in memberships if value["form_id"] == "meowsticf"]
        self.assertEqual(
            female,
            [
                {
                    "form_id": "meowsticf",
                    "regulation_id": regulation_id,
                    "resolution": "related-fixed-sex",
                    "source_form_id": "meowstic",
                }
                for regulation_id in ("m-a", "m-b", "m-c")
            ],
        )
        self.assertTrue(
            all(
                value["resolution"] == "direct"
                and value["source_form_id"] == value["form_id"]
                for value in memberships
                if value["form_id"] != "meowsticf"
            )
        )
        difference = compare_bundles(previous, release)["files"]
        changed_files = {
            filename
            for filename, value in difference.items()
            if value["added"] or value["removed"] or value["changed"]
        }
        self.assertEqual(changed_files, {"regulation_memberships.json"})
        membership_delta = difference["regulation_memberships.json"]
        self.assertEqual(
            membership_delta["added_keys"],
            ["m-a:meowsticf", "m-b:meowsticf", "m-c:meowsticf"],
        )
        self.assertEqual(membership_delta["changed"], 935)

    def test_membership_provenance_release_rejects_invalid_relations(self) -> None:
        release = (
            Path(__file__).parents[1] / "releases" / "showdown-multi-s7-i9-78b322057dd0"
        )
        mutations = (
            lambda values: values[0].update(resolution="unknown"),
            lambda values: values[0].update(source_form_id="meowstic"),
            lambda values: next(
                value for value in values if value["form_id"] == "meowsticf"
            ).update(source_form_id="meowsticf"),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate), tempfile.TemporaryDirectory() as name:
                bundle = Path(name) / release.name
                shutil.copytree(release, bundle)
                path = bundle / "regulation_memberships.json"
                values = json.loads(path.read_text(encoding="utf-8"))
                mutate(values)
                path.write_bytes(_canonical_bytes(values))
                with self.assertRaises(BundleError):
                    validate_bundle(bundle, verify_manifest=False)


class SpriteSelectionTests(unittest.TestCase):
    def test_both_home_variants_are_converted_and_hashed(self) -> None:
        repository = Path(__file__).parents[3]
        source = (
            repository
            / "references"
            / "sprites"
            / "sprites"
            / "pokemon"
            / "other"
            / "home"
        )
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
            self.assertEqual(
                [record["variant"] for record in records], ["normal", "shiny"]
            )
            self.assertTrue(all(len(record["sha256"]) == 64 for record in records))
            self.assertEqual(
                {(record["width"], record["height"]) for record in records},
                {(384, 384)},
            )
            self.assertTrue(
                all(
                    _parse_webp(output / record["path"])["has_alpha"]
                    for record in records
                )
            )
            normal_record = next(
                record for record in records if record["variant"] == "normal"
            )
            self.assertEqual(
                normal_record["sha256"],
                "a9d1ab2ab66a1be440143caedbef08f3a0d373a1c0d936a715d6a8fdff40db92",
            )

    def test_missing_shiny_sprite_fails_closed(self) -> None:
        repository = Path(__file__).parents[3]
        source = (
            repository
            / "references"
            / "sprites"
            / "sprites"
            / "pokemon"
            / "other"
            / "home"
        )
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
            with self.assertRaisesRegex(
                BundleError, "required shiny PokeAPI HOME sprite"
            ):
                _sprite_records(
                    [{"id": "pikachu", "national_dex_number": 25}],
                    root / "sprites",
                    root / "pokeapi",
                    root / "output",
                )

    def test_complete_mapping_is_unique_and_covers_reviewed_exceptions(self) -> None:
        repository = Path(__file__).parents[3]
        showdown = repository / "references" / "pokemon-showdown"
        pokeapi = repository / "references" / "pokeapi"
        if not showdown.is_dir() or not pokeapi.is_dir():
            self.skipTest("local source snapshots are unavailable")
        forms = _extract(showdown)["forms"]
        mapping = _load_sprite_mapping(forms, pokeapi)
        self.assertEqual(len(mapping), 351)
        self.assertEqual(len({value["pokemon_id"] for value in mapping.values()}), 351)
        self.assertEqual(mapping["aegislash"]["pokemon_identifier"], "aegislash-shield")
        self.assertEqual(mapping["meowsticf"]["pokemon_identifier"], "meowstic-female")
        self.assertEqual(
            mapping["meowsticfmega"]["pokemon_identifier"], "meowstic-female-mega"
        )

    def test_home_source_png_has_exact_approved_structure(self) -> None:
        path = (
            Path(__file__).parents[3]
            / "references"
            / "sprites"
            / "sprites"
            / "pokemon"
            / "other"
            / "home"
            / "59.png"
        )
        if not path.is_file():
            self.skipTest("local PokeAPI sprites are unavailable")
        self.assertEqual(
            _parse_png(path),
            {
                "width": 512,
                "height": 512,
                "bit_depth": 8,
                "color_type": 6,
                "interlace": 0,
            },
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
                _load_sprite_mapping(
                    [{"id": "pikachu", "national_dex_number": 25}], Path(name)
                )

    def test_malformed_numeric_mapping_is_contextual(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            csv_path = Path(name) / "data" / "v2" / "csv"
            csv_path.mkdir(parents=True)
            (csv_path / "pokemon.csv").write_text(
                "id,identifier,species_id,height,weight,base_experience,order,is_default\n"
                "oops,pikachu,25,4,60,112,35,1\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                BundleError, "pokemon.csv:2: id and species_id"
            ):
                _load_sprite_mapping(
                    [{"id": "pikachu", "national_dex_number": 25}], Path(name)
                )


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
                "id": "pikachu-name",
                "showdown_revision": EXPECTED_REVISION,
                "record": "forms.json:pikachu",
                "rationale": "Fixture proves the defect.",
                "authoring_date": "2026-10-15",
                "before": before,
                "after": after,
                "fixture": "proof.json",
            }
            fixture = {
                "overlay_id": "pikachu-name",
                "record": "forms.json:pikachu",
                "expected_before": before,
                "expected_after": after,
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
                "id": "stale",
                "showdown_revision": EXPECTED_REVISION,
                "record": "forms.json:pikachu",
                "rationale": "Regression.",
                "authoring_date": "2026-10-15",
                "before": {"id": "pikachu", "name": "Old"},
                "after": {"id": "pikachu", "name": "New"},
                "fixture": "proof.json",
            }
            fixture = {
                "overlay_id": "stale",
                "record": "forms.json:pikachu",
                "expected_before": overlay["before"],
                "expected_after": overlay["after"],
            }
            (root / "fixtures" / "proof.json").write_bytes(_canonical_bytes(fixture))
            (root / "overrides" / "stale.json").write_bytes(_canonical_bytes(overlay))
            with self.assertRaisesRegex(BundleError, "before value no longer matches"):
                _apply_overlays(
                    {"forms.json": [{"id": "pikachu", "name": "Current"}]},
                    root / "overrides",
                    root / "fixtures",
                    root / "output",
                )


class SchemaArtifactTests(unittest.TestCase):
    @staticmethod
    def _matching_manifest_schema_branches(schema: dict, manifest: dict) -> int:
        matches = 0
        for branch in schema["oneOf"]:
            properties = branch["properties"]
            if any(
                manifest[field] != constraint["const"]
                for field, constraint in properties.items()
                if "const" in constraint
            ):
                continue
            counts_name = properties["counts"]["$ref"].rsplit("/", 1)[-1]
            if manifest["counts"] != schema["$defs"][counts_name]["const"]:
                continue
            expected_mapping_hash = properties["sprite_provenance"]["properties"][
                "mapping_sha256"
            ]["const"]
            if manifest["sprite_provenance"]["mapping_sha256"] != expected_mapping_hash:
                continue
            matches += 1
        return matches

    def test_schema_documents_are_valid_json(self) -> None:
        schema_root = Path(__file__).parents[1] / "schema"
        for path in sorted(schema_root.glob("*.json")):
            with self.subTest(path=path.name):
                self.assertIsInstance(
                    json.loads(path.read_text(encoding="utf-8")), dict
                )

    def test_v7_schema_pins_membership_provenance_release(self) -> None:
        data_root = Path(__file__).parents[1]
        schema = json.loads(
            (data_root / "schema" / "bundle-v7.schema.json").read_text()
        )
        manifest = json.loads(
            (
                data_root
                / "releases"
                / "showdown-multi-s7-i9-78b322057dd0"
                / "manifest.json"
            ).read_text()
        )
        properties = schema["properties"]
        for field in (
            "bundle_id",
            "bundle_hash",
            "bundle_schema_version",
            "importer_version",
            "source_shape_version",
        ):
            self.assertEqual(manifest[field], properties[field]["const"])
        self.assertEqual(manifest["counts"]["memberships"], 938)
        self.assertEqual(
            manifest["counts"]["legal_forms_by_regulation"],
            {"m-a": 273, "m-b": 315, "m-c": 350},
        )

    def test_v2_schema_pins_complete_published_manifest_and_rejects_mutations(
        self,
    ) -> None:
        data_root = Path(__file__).parents[1]
        schema = json.loads(
            (data_root / "schema" / "bundle-v2.schema.json").read_text()
        )
        manifest = json.loads(
            (
                data_root
                / "releases"
                / "showdown-multi-s2-i3-fc85b358deaa"
                / "manifest.json"
            ).read_text()
        )

        def accepted(value: dict) -> bool:
            # The v2 schema intentionally publishes one exact portable contract via JSON Schema
            # `const`; equality is the complete Draft 2020-12 validation rule for this schema.
            return value == schema["const"]

        self.assertTrue(accepted(manifest))

        mutations = []
        value = json.loads(_canonical_bytes(manifest))
        value["formats"][0] = {"id": "m-a"}
        mutations.append(value)
        value = json.loads(_canonical_bytes(manifest))
        value["sprite_provenance"] = {}
        mutations.append(value)
        value = json.loads(_canonical_bytes(manifest))
        value["counts"]["unexpected"] = 1
        mutations.append(value)
        value = json.loads(_canonical_bytes(manifest))
        value["counts"]["forms"] += 1
        mutations.append(value)
        value = json.loads(_canonical_bytes(manifest))
        value["files"][0]["path"] = "changed.json"
        mutations.append(value)
        value = json.loads(_canonical_bytes(manifest))
        value["files"][0]["sha256"] = "0" * 64
        mutations.append(value)
        value = json.loads(_canonical_bytes(manifest))
        value["files"][1] = value["files"][0]
        mutations.append(value)
        for value in mutations:
            with self.subTest(mutation=value):
                self.assertFalse(accepted(value))

    def test_record_schema_exposes_every_portable_file_root(self) -> None:
        schema = json.loads(
            (
                Path(__file__).parents[1] / "schema" / "records-v1.schema.json"
            ).read_text()
        )
        roots = schema["$defs"]["file_roots"]["properties"]
        self.assertEqual(
            set(roots),
            {
                "mechanics_profiles.json",
                "regulations.json",
                "forms.json",
                "types.json",
                "abilities.json",
                "moves.json",
                "move_flags.json",
                "regulation_memberships.json",
                "profiles.json",
                "ability_profiles.json",
                "move_profiles.json",
                "move_flag_relations.json",
                "mega_relations.json",
                "learnsets.json",
                "sprite_mappings.json",
                "sprites.json",
            },
        )
        self.assertTrue(all("$ref" in value["items"] for value in roots.values()))

    def test_manifest_schema_accepts_only_coherent_importer_release_contracts(
        self,
    ) -> None:
        data_root = Path(__file__).parents[1]
        schema = json.loads(
            (data_root / "schema" / "bundle-v1.schema.json").read_text()
        )
        releases = data_root / "releases"
        legacy = json.loads(
            (
                releases / "showdown-3a766f2c-s1-i1-923ba416555c" / "manifest.json"
            ).read_text()
        )
        current = json.loads(
            (
                releases / "showdown-3a766f2c-s1-i2-4bedbf1eb44d" / "manifest.json"
            ).read_text()
        )
        self.assertEqual(self._matching_manifest_schema_branches(schema, legacy), 1)
        self.assertEqual(self._matching_manifest_schema_branches(schema, current), 1)

        mismatches = []
        for field in ("bundle_id", "bundle_hash", "counts"):
            value = dict(legacy)
            value[field] = current[field]
            mismatches.append(value)
        mapping_mismatch = dict(legacy)
        mapping_mismatch["sprite_provenance"] = dict(legacy["sprite_provenance"])
        mapping_mismatch["sprite_provenance"]["mapping_sha256"] = current[
            "sprite_provenance"
        ]["mapping_sha256"]
        mismatches.append(mapping_mismatch)
        for value in mismatches:
            with self.subTest(mismatch=value):
                self.assertEqual(
                    self._matching_manifest_schema_branches(schema, value), 0
                )


class LocalSnapshotIntegrationTests(unittest.TestCase):
    def test_item_text_resolution_trims_and_records_fallback(self) -> None:
        module = (Path(__file__).parents[1] / "importer" / "item-text.mjs").as_uri()
        script = (
            f"import {{resolveItemDescription}} from {json.dumps(module)};"
            "const values=["
            "resolveItemDescription({shortDesc:' short ',desc:' full '},'item'),"
            "resolveItemDescription({shortDesc:' fallback ',desc:'   '},'item'),"
            "resolveItemDescription({shortDesc:' absent '},'item')];"
            "process.stdout.write(JSON.stringify(values));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            json.loads(result.stdout),
            [
                {
                    "short_description": "short",
                    "description": "full",
                    "description_source": "desc",
                },
                {
                    "short_description": "fallback",
                    "description": "fallback",
                    "description_source": "shortDesc",
                },
                {
                    "short_description": "absent",
                    "description": "absent",
                    "description_source": "shortDesc",
                },
            ],
        )

    def test_item_text_resolution_rejects_malformed_text(self) -> None:
        module = (Path(__file__).parents[1] / "importer" / "item-text.mjs").as_uri()
        cases = (
            {},
            {"shortDesc": ""},
            {"shortDesc": 3},
            {"shortDesc": "ok", "desc": 3},
        )
        for value in cases:
            script = (
                f"import {{resolveItemDescription}} from {json.dumps(module)};"
                f"resolveItemDescription({json.dumps(value)},'item');"
            )
            with self.subTest(value=value):
                result = subprocess.run(
                    ["node", "--input-type=module", "--eval", script],
                    check=False,
                    capture_output=True,
                    text=True,
                )
                self.assertNotEqual(result.returncode, 0)

    def test_standard_item_status_truth_table_fails_closed(self) -> None:
        legality = (Path(__file__).parents[1] / "importer" / "legality.mjs").as_uri()
        cases = [
            [{}, True],
            [{"isNonstandard": None}, True],
            [{"isNonstandard": False}, True],
            [{"isNonstandard": "Past"}, False],
            [{"isNonstandard": "Future"}, False],
            [{"isNonstandard": "Unknown category"}, False],
            [{"isNonstandard": ""}, False],
        ]
        script = (
            f"import {{hasStandardStatus}} from {json.dumps(legality)};"
            f"const cases={json.dumps(cases)};"
            "process.stdout.write(JSON.stringify(cases.map(([entry]) => "
            "hasStandardStatus(entry))));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(json.loads(result.stdout), [expected for _, expected in cases])

    def test_standard_formats_entry_truth_table_fails_closed(self) -> None:
        legality = (Path(__file__).parents[1] / "importer" / "legality.mjs").as_uri()
        cases = [
            [{"tier": "OU"}, True],
            [{"tier": "OU", "isNonstandard": None}, True],
            [{"tier": "OU", "isNonstandard": False}, True],
            [{"tier": "Illegal"}, False],
            [{"tier": "Illegal", "isNonstandard": None}, False],
            [{"tier": "Illegal", "isNonstandard": False}, False],
            [{"tier": "OU", "isNonstandard": "Future"}, False],
            [{"tier": "OU", "isNonstandard": "Past"}, False],
            [{"tier": "OU", "isNonstandard": "LGPE"}, False],
            [{"tier": "OU", "isNonstandard": "CAP"}, False],
            [{"tier": "OU", "isNonstandard": ""}, False],
            [{"tier": "OU", "isNonstandard": "Unknown category"}, False],
        ]
        script = (
            f"import {{isStandardFormatsEntry}} from {json.dumps(legality)};"
            f"const cases={json.dumps(cases)};"
            "process.stdout.write(JSON.stringify(cases.map(([entry]) => "
            "isStandardFormatsEntry(entry))));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(json.loads(result.stdout), [expected for _, expected in cases])

    def test_standard_formats_entry_rejects_malformed_records_with_context(
        self,
    ) -> None:
        legality = (Path(__file__).parents[1] / "importer" / "legality.mjs").as_uri()
        script = (
            f"import {{isStandardFormatsEntry}} from {json.dumps(legality)};"
            "const malformed=[null,undefined,'standard',42,true,[]];"
            "const errors=malformed.map((value,index)=>{try{"
            "isStandardFormatsEntry(value,`champions FormatsData broken-${index}`);return null;"
            "}catch(error){return error.message;}});"
            "process.stdout.write(JSON.stringify(errors));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            json.loads(result.stdout),
            [
                f"champions FormatsData broken-{index}: expected an object"
                for index in range(6)
            ],
        )

    def test_nonstandard_mega_profile_can_be_retained_without_membership(self) -> None:
        legality = (Path(__file__).parents[1] / "importer" / "legality.mjs").as_uri()
        script = (
            f"import {{isStandardFormatsEntry,selectRelatedFormIDs}} from {json.dumps(legality)};"
            "const formats={base:{tier:'OU'},basemega:{tier:'OU',isNonstandard:'Future'}};"
            "const pokedex={"
            "base:{name:'Base',otherFormes:['Base-Mega']},"
            "basemega:{name:'Base-Mega',baseSpecies:'Base',forme:'Mega'}"
            "};"
            "const memberships=Object.entries(formats).filter(([,value])=>"
            "isStandardFormatsEntry(value)).map(([id])=>id);"
            "process.stdout.write(JSON.stringify({memberships,profiles:"
            "selectRelatedFormIDs(memberships,pokedex)}));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            json.loads(result.stdout),
            {"memberships": ["base"], "profiles": ["base", "basemega"]},
        )

    def test_fixed_opposite_sex_form_is_related_without_cosmetic_expansion(
        self,
    ) -> None:
        legality = (Path(__file__).parents[1] / "importer" / "legality.mjs").as_uri()
        script = (
            f"import {{selectRelatedFormIDs}} from {json.dumps(legality)};"
            "const pokedex={"
            "base:{name:'Base',gender:'M',otherFormes:['Base-F','Base-Style']},"
            "basef:{name:'Base-F',baseSpecies:'Base',forme:'F',gender:'F'},"
            "basestyle:{name:'Base-Style',baseSpecies:'Base',forme:'Style',gender:'M'}"
            "};"
            "process.stdout.write(JSON.stringify(selectRelatedFormIDs(['base'],pokedex)));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(json.loads(result.stdout), ["base", "basef"])

    def test_related_fixed_sex_membership_records_provenance(self) -> None:
        module = (
            Path(__file__).parents[1] / "importer" / "membership-resolution.mjs"
        ).as_uri()
        script = (
            f"import {{resolveRegulationMemberships}} from {json.dumps(module)};"
            "const formats={base:{tier:'OU'}};"
            "const pokedex={"
            "base:{name:'Base',gender:'M',otherFormes:['Base-F','Base-Mega']},"
            "basef:{name:'Base-F',baseSpecies:'Base',forme:'F',gender:'F'},"
            "basemega:{name:'Base-Mega',baseSpecies:'Base',forme:'Mega',gender:'M'}"
            "};"
            "process.stdout.write(JSON.stringify(resolveRegulationMemberships("
            "formats,pokedex,'champions FormatsData')));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            json.loads(result.stdout),
            [
                {
                    "form_id": "base",
                    "resolution": "direct",
                    "source_form_id": "base",
                },
                {
                    "form_id": "basef",
                    "resolution": "related-fixed-sex",
                    "source_form_id": "base",
                },
            ],
        )

    def test_related_fixed_sex_membership_fails_closed(self) -> None:
        module = (
            Path(__file__).parents[1] / "importer" / "membership-resolution.mjs"
        ).as_uri()
        script = (
            f"import {{resolveRegulationMemberships}} from {json.dumps(module)};"
            "const base={name:'Base',gender:'M',otherFormes:['Base-F']};"
            "const candidate={name:'Base-F',baseSpecies:'Base',forme:'F',gender:'F'};"
            "const cases=["
            "[{base:{tier:'OU'},basef:{tier:'Illegal'}},{base,basef:candidate}],"
            "[{base:{tier:'OU'}},{base,basef:{...candidate,baseSpecies:'Other'}}],"
            "[{base:{tier:'OU'}},{base,basef:{...candidate,gender:'variable'}}],"
            "[{base:{tier:'OU'}},{base,basef:{...candidate,forme:'F-Mega'}}]"
            "];"
            "const results=cases.map(([formats,pokedex])=>resolveRegulationMemberships("
            "formats,pokedex,'champions FormatsData'));"
            "const failures=[];"
            "for(const [formats,pokedex] of [[{base:{tier:'OU'}},{base}],"
            "[{base:{tier:'OU'},basef:null},{base,basef:candidate}],"
            "[{base:{tier:'OU'}},{base:{...base,otherFormes:['Base-F','Base-F']},basef:candidate}]]){"
            "try{resolveRegulationMemberships(formats,pokedex,'champions FormatsData');"
            "failures.push(null);}catch(error){failures.push(error.message);}}"
            "process.stdout.write(JSON.stringify({results,failures}));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
        )
        value = json.loads(result.stdout)
        direct = [{"form_id": "base", "resolution": "direct", "source_form_id": "base"}]
        self.assertEqual(value["results"], [direct, direct, direct, direct])
        self.assertEqual(
            value["failures"],
            [
                "data/pokedex.ts: base related form basef is missing",
                "champions FormatsData basef: expected an object",
                "champions FormatsData: duplicate related fixed-sex form basef",
            ],
        )

    def test_current_future_membership_candidates_are_exactly_magearna_megas(
        self,
    ) -> None:
        showdown = Path(__file__).parents[3] / "references" / "pokemon-showdown"
        if not showdown.is_dir():
            self.skipTest("user-supplied Showdown snapshot is not present")
        champions = (showdown / "data/mods/champions/formats-data.ts").as_uri()
        regulation_b = (showdown / "data/mods/championsregmb/formats-data.ts").as_uri()
        script = (
            f"import {{FormatsData as champions}} from {json.dumps(champions)};"
            f"import {{FormatsData as regulationB}} from {json.dumps(regulation_b)};"
            "const candidates=table=>Object.entries(table).filter(([,value])=>"
            "value.tier!=='Illegal'&&value.isNonstandard==='Future').map(([id])=>id).sort();"
            "process.stdout.write(JSON.stringify({champions:candidates(champions),"
            "regulationB:candidates(regulationB)}));"
        )
        result = subprocess.run(
            ["node", "--no-warnings", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
        )
        expected = ["magearnamega", "magearnaoriginalmega"]
        self.assertEqual(
            json.loads(result.stdout),
            {"champions": expected, "regulationB": expected},
        )

    def test_synthetic_pre_evolution_fallback_records_resolution(self) -> None:
        data_root = Path(__file__).parents[1]
        fixture = json.loads(
            (data_root / "fixtures" / "pre-evolution-learnset.json").read_text()
        )
        module = (data_root / "importer" / "learnset-resolution.mjs").as_uri()
        script = (
            f"import {{resolveLearnset}} from {json.dumps(module)};"
            f"const x={json.dumps(fixture)};"
            "const result=resolveLearnset({formID:x.form_id,table:x.table,moves:x.moves,"
            "regulationID:'m-c',pokedex:x.pokedex,sourceFor:()=>({source_mod:'base',source_kind:'inherited'})});"
            "process.stdout.write(JSON.stringify(result));"
        )
        result = subprocess.run(
            ["node", "--input-type=module", "--eval", script],
            check=True,
            capture_output=True,
            text=True,
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
        self.assertEqual(len(first["regulations"]["m-c"]["memberships"]), 350)
        self.assertEqual(len(first["regulations"]["m-b"]["memberships"]), 315)
        for regulation_id in ("m-c", "m-b"):
            membership_ids = {
                value["form_id"]
                for value in first["regulations"][regulation_id]["memberships"]
            }
            self.assertNotIn("magearnamega", membership_ids)
            self.assertNotIn("magearnaoriginalmega", membership_ids)
            self.assertIn("meowsticf", membership_ids)
            female = next(
                value
                for value in first["regulations"][regulation_id]["memberships"]
                if value["form_id"] == "meowsticf"
            )
            self.assertEqual(
                female,
                {
                    "form_id": "meowsticf",
                    "resolution": "related-fixed-sex",
                    "source_form_id": "meowstic",
                },
            )
        forms = {value["id"]: value for value in first["forms"]}
        self.assertEqual(forms["charizardmegax"]["sprite_id"], "charizard-megax")
        self.assertTrue(forms["absolmegaz"]["is_mega"])
        self.assertEqual(
            forms["arcaninehisui"],
            {
                "id": "arcaninehisui",
                "name": "Arcanine-Hisui",
                "national_dex_number": 59,
                "base_form_id": "arcanine",
                "form_label": "Hisui",
                "is_mega": False,
                "is_nfe": False,
                "gender": "variable",
                "gender_options": ["M", "F"],
                "default_gender": "M",
                "sprite_id": "arcanine-hisui",
            },
        )
        self.assertEqual(forms["indeedeef"]["form_label"], "F")
        self.assertEqual(forms["indeedeef"]["base_form_id"], "indeedee")
        self.assertEqual(
            forms["meowsticf"],
            {
                "id": "meowsticf",
                "name": "Meowstic-F",
                "national_dex_number": 678,
                "base_form_id": "meowstic",
                "form_label": "F",
                "is_mega": False,
                "is_nfe": False,
                "gender": "F",
                "gender_options": ["F"],
                "default_gender": "F",
                "sprite_id": "meowstic-f",
            },
        )
        profiles = {
            value["form_id"]: value for value in first["regulations"]["m-c"]["profiles"]
        }
        self.assertEqual(profiles["charizardmegax"]["types"], ["Fire", "Dragon"])
        self.assertEqual(profiles["charizardmegax"]["bst"], 634)
        self.assertEqual(
            profiles["meowsticf"]["abilities"],
            [
                {"slot": "0", "ability_id": "keeneye"},
                {"slot": "1", "ability_id": "infiltrator"},
                {"slot": "H", "ability_id": "competitive"},
            ],
        )
        self.assertEqual(profiles["arcaninehisui"]["types"], ["Fire", "Rock"])
        self.assertEqual(
            profiles["arcaninehisui"]["stats"],
            {
                "hp": 95,
                "atk": 115,
                "def": 80,
                "spa": 95,
                "spd": 80,
                "spe": 90,
            },
        )
        mc_moves = {
            value["id"]: value for value in first["regulations"]["m-c"]["moves"]
        }
        mb_moves = {
            value["id"]: value for value in first["regulations"]["m-b"]["moves"]
        }
        self.assertEqual(mc_moves["strengthsap"]["pp"], 5)
        self.assertEqual(mb_moves["strengthsap"]["pp"], 10)
        self.assertIn("Lowers Atk by 1", mc_moves["strengthsap"]["short_description"])
        self.assertEqual(
            {
                key: mc_moves["flamethrower"][key]
                for key in (
                    "type",
                    "category",
                    "base_power",
                    "accuracy",
                    "pp",
                    "priority",
                    "target",
                    "flags",
                )
            },
            {
                "type": "Fire",
                "category": "Special",
                "base_power": 90,
                "accuracy": 100,
                "pp": 15,
                "priority": 0,
                "target": "normal",
                "flags": ["metronome", "mirror", "protect"],
            },
        )
        self.assertEqual(
            {
                key: mc_moves["protect"][key]
                for key in ("category", "base_power", "accuracy", "priority", "target")
            },
            {
                "category": "Status",
                "base_power": 0,
                "accuracy": "always",
                "priority": 4,
                "target": "self",
            },
        )
        self.assertEqual(mc_moves["aerialace"]["category"], "Physical")
        self.assertEqual(mc_moves["aerialace"]["accuracy"], "always")
        self.assertEqual(mc_moves["fakeout"]["priority"], 3)
        self.assertEqual(
            mc_moves["drainpunch"]["flags"],
            ["contact", "heal", "metronome", "mirror", "protect", "punch"],
        )
        mc_abilities = {
            value["id"]: value for value in first["regulations"]["m-c"]["abilities"]
        }
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
            value
            for value in first["regulations"]["m-c"]["learnsets"]
            if value["form_id"] == "charizardmegax"
        ]
        self.assertTrue(charizard_mega_moves)
        self.assertEqual(
            {value["form_resolution"] for value in charizard_mega_moves},
            {"base-to-mega"},
        )
        self.assertEqual(
            {value["source_form_id"] for value in charizard_mega_moves}, {"charizard"}
        )
        mb_archaludon = [
            value
            for value in first["regulations"]["m-b"]["learnsets"]
            if value["form_id"] == "archaludon"
        ]
        self.assertTrue(mb_archaludon)
        self.assertEqual(
            {value["source_mod"] for value in mb_archaludon}, {"championsregmb"}
        )
        self.assertEqual(
            {value["source_kind"] for value in mb_archaludon}, {"override"}
        )
        mb_charizard = [
            value
            for value in first["regulations"]["m-b"]["learnsets"]
            if value["form_id"] == "charizard"
        ]
        self.assertEqual(
            {value["source_kind"] for value in mb_charizard}, {"inherited"}
        )
        aegislash_blade = [
            value
            for value in first["regulations"]["m-c"]["learnsets"]
            if value["form_id"] == "aegislashblade"
        ]
        self.assertEqual(len(aegislash_blade), 46)
        self.assertEqual(
            {value["form_resolution"] for value in aegislash_blade}, {"changed-form"}
        )
        self.assertEqual(
            {value["source_form_id"] for value in aegislash_blade}, {"aegislash"}
        )
        mawile_relations = [
            value
            for value in first["mega_relations"]
            if value["base_form_id"] == "mawile"
        ]
        self.assertEqual(
            mawile_relations, [{"base_form_id": "mawile", "mega_form_id": "mawilemega"}]
        )


class PublishedBundleMutationTests(unittest.TestCase):
    @property
    def team_builder_bundle(self) -> Path:
        return (
            Path(__file__).parents[1] / "releases" / "showdown-multi-s3-i4-5073b2ab1402"
        )

    @property
    def item_information_bundle(self) -> Path:
        return (
            Path(__file__).parents[1] / "releases" / "showdown-multi-s4-i5-7205fa48044e"
        )

    def test_item_information_release_goldens_and_semantic_diff(self) -> None:
        summary = validate_bundle(self.item_information_bundle)
        manifest = json.loads(
            (self.item_information_bundle / "manifest.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            (manifest["bundle_id"], manifest["bundle_hash"]),
            (
                "showdown-multi-s4-i5-7205fa48044e",
                "7205fa48044e73f059e980629e222fcbdc1d5aaffb2bd667c8b8837a7b15ab6b",
            ),
        )
        self.assertEqual(
            summary["counts"]["item_description_sources_by_regulation"],
            {
                "m-a": {"desc": 2, "shortDesc": 115},
                "m-b": {"desc": 2, "shortDesc": 146},
                "m-c": {"desc": 2, "shortDesc": 164},
            },
        )
        self.assertEqual(
            summary["overlays"][0]["target_keys"], sorted(M_A_ITEM_TEXT_OVERLAY_IDS)
        )
        profiles = json.loads(
            (self.item_information_bundle / "item_profiles.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertTrue(
            all(
                value["short_description"] and value["description"]
                for value in profiles
            )
        )
        difference = compare_bundles(
            self.team_builder_bundle, self.item_information_bundle
        )
        self.assertEqual(difference["files"]["item_profiles.json"]["changed"], 431)
        self.assertTrue(
            all(
                changes["changed"] == 0
                for filename, changes in difference["files"].items()
                if filename != "item_profiles.json"
            )
        )
        self.assertEqual(
            difference["overlays"]["added"], ["m-a-item-text-compatibility"]
        )

    def test_item_information_release_rejects_description_mutations(self) -> None:
        mutations = (
            lambda value: value.update(short_description=""),
            lambda value: value.update(description_source="unknown"),
            lambda value: value.update(
                description_source="shortDesc", description="different"
            ),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate), tempfile.TemporaryDirectory() as name:
                bundle = Path(name) / self.item_information_bundle.name
                shutil.copytree(self.item_information_bundle, bundle)
                path = bundle / "item_profiles.json"
                values = json.loads(path.read_text(encoding="utf-8"))
                mutate(values[0])
                path.write_bytes(_canonical_bytes(values))
                with self.assertRaises(BundleError):
                    validate_bundle(bundle, verify_manifest=False)

    def test_meowstic_female_release_has_exact_semantic_delta(self) -> None:
        releases = Path(__file__).parents[1] / "releases"
        before = releases / "showdown-multi-s5-i6-38ee90625b30"
        after = releases / "showdown-multi-s5-i7-49850c617dd2"

        def records(filename: str) -> list[dict]:
            return json.loads((after / filename).read_text(encoding="utf-8"))

        difference = compare_bundles(before, after)
        expected_additions = {
            "forms.json": ["meowsticf"],
            "profiles.json": [
                "m-a:meowsticf",
                "m-b:meowsticf",
                "m-c:meowsticf",
            ],
            "learnsets.json": [
                f"{regulation_id}:meowsticf:{move_id}"
                for regulation_id in ("m-a", "m-b", "m-c")
                for move_id in sorted(
                    value["move_id"]
                    for value in records("learnsets.json")
                    if value["regulation_id"] == regulation_id
                    and value["form_id"] == "meowsticf"
                )
            ],
            "mega_item_relations.json": [
                "m-a:meowsticite:meowsticf",
                "m-b:meowsticite:meowsticf",
                "m-c:meowsticite:meowsticf",
            ],
            "sprite_mappings.json": ["meowsticf"],
            "sprites.json": ["meowsticf:normal", "meowsticf:shiny"],
        }
        self.assertEqual(
            {
                filename: changes["added_keys"]
                for filename, changes in difference["files"].items()
                if changes["added"]
            },
            expected_additions,
        )
        self.assertEqual(
            {filename: len(keys) for filename, keys in expected_additions.items()},
            {
                "forms.json": 1,
                "profiles.json": 3,
                "learnsets.json": 168,
                "mega_item_relations.json": 3,
                "sprite_mappings.json": 1,
                "sprites.json": 2,
            },
        )
        self.assertTrue(
            all(
                changes["removed"] == changes["changed"] == 0
                for changes in difference["files"].values()
            )
        )
        self.assertEqual(
            difference["overlays"], {"added": [], "removed": [], "changed": []}
        )

        form = next(
            value for value in records("forms.json") if value["id"] == "meowsticf"
        )
        self.assertEqual(
            form,
            {
                "base_form_id": "meowstic",
                "default_gender": "F",
                "form_label": "F",
                "gender": "F",
                "gender_options": ["F"],
                "id": "meowsticf",
                "is_mega": False,
                "is_nfe": False,
                "name": "Meowstic-F",
                "national_dex_number": 678,
                "sprite_id": "meowstic-f",
            },
        )
        female_profiles = [
            value
            for value in records("profiles.json")
            if value["form_id"] == "meowsticf"
        ]
        profile = {
            "abilities": [
                {"ability_id": "keeneye", "slot": "0"},
                {"ability_id": "infiltrator", "slot": "1"},
                {"ability_id": "competitive", "slot": "H"},
            ],
            "bst": 466,
            "form_id": "meowsticf",
            "stats": {"atk": 48, "def": 76, "hp": 74, "spa": 83, "spd": 81, "spe": 104},
            "types": ["Psychic"],
            "weight_tenths_kg": 85,
        }
        self.assertEqual(
            female_profiles,
            [
                {**profile, "regulation_id": regulation_id}
                for regulation_id in ("m-a", "m-b", "m-c")
            ],
        )

        female_learnsets = [
            value
            for value in records("learnsets.json")
            if value["form_id"] == "meowsticf"
        ]
        self.assertEqual(len(female_learnsets), 168)
        self.assertEqual(
            {
                (
                    value["regulation_id"],
                    value["form_resolution"],
                    value["source_form_id"],
                    value["source_mod"],
                    value["source_kind"],
                )
                for value in female_learnsets
            },
            {
                ("m-a", "direct", "meowsticf", "champions", "direct"),
                ("m-b", "direct", "meowsticf", "champions", "inherited"),
                ("m-c", "direct", "meowsticf", "champions", "direct"),
            },
        )
        self.assertEqual(
            {
                regulation_id: sum(
                    value["regulation_id"] == regulation_id
                    for value in female_learnsets
                )
                for regulation_id in ("m-a", "m-b", "m-c")
            },
            {"m-a": 56, "m-b": 56, "m-c": 56},
        )
        self.assertFalse(
            any(
                value["form_id"] == "meowsticf"
                for value in records("regulation_memberships.json")
            )
        )

        self.assertEqual(
            [
                value
                for value in records("sprite_mappings.json")
                if value["form_id"] == "meowsticf"
            ],
            [
                {
                    "form_id": "meowsticf",
                    "mapping_rule": "exception",
                    "pokeapi_identifier": "meowstic-female",
                    "pokeapi_pokemon_id": 10025,
                }
            ],
        )
        female_sprites = [
            value
            for value in records("sprites.json")
            if value["form_id"] == "meowsticf"
        ]
        self.assertEqual(
            [
                (value["variant"], value["path"], value["sha256"])
                for value in female_sprites
            ],
            [
                (
                    "normal",
                    "sprites/normal/meowsticf.webp",
                    "c070e7064ff52acb871530ae841f462c763feb09d638881ef189b442c9e18e0f",
                ),
                (
                    "shiny",
                    "sprites/shiny/meowsticf.webp",
                    "f6bd879b3989b4d3d90169014aa59acc830a78a57536adc52b071d24063cbb97",
                ),
            ],
        )
        self.assertTrue(
            all(
                value["pokeapi_identifier"] == "meowstic-female"
                and value["pokeapi_pokemon_id"] == 10025
                and value["mapping_rule"] == "exception"
                for value in female_sprites
            )
        )
        self.assertEqual(
            [
                value
                for value in records("mega_item_relations.json")
                if value["base_form_id"] == "meowsticf"
            ],
            [
                {
                    "base_form_id": "meowsticf",
                    "item_id": "meowsticite",
                    "mega_form_id": "meowsticfmega",
                    "regulation_id": regulation_id,
                }
                for regulation_id in ("m-a", "m-b", "m-c")
            ],
        )

    def test_item_information_release_rejects_overlay_inventory_mutations(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            bundle = Path(name) / self.item_information_bundle.name
            shutil.copytree(self.item_information_bundle, bundle)
            path = bundle / "provenance.json"
            value = json.loads(path.read_text(encoding="utf-8"))
            value["overlays"][0]["target_keys"].pop()
            path.write_bytes(_canonical_bytes(value))
            with self.assertRaisesRegex(BundleError, "overlay provenance changed"):
                validate_bundle(bundle, verify_manifest=False)

    def test_team_builder_release_item_nature_and_mega_goldens(self) -> None:
        summary = validate_bundle(self.team_builder_bundle)
        self.assertEqual(
            {
                key: summary["counts"][key]
                for key in ("items", "item_profiles", "natures", "mega_item_relations")
            },
            {
                "items": 166,
                "item_profiles": 431,
                "natures": 21,
                "mega_item_relations": 214,
            },
        )
        profiles = json.loads(
            (self.team_builder_bundle / "item_profiles.json").read_text(
                encoding="utf-8"
            )
        )
        by_regulation = {
            regulation_id: {
                record["id"]
                for record in profiles
                if record["regulation_id"] == regulation_id
            }
            for regulation_id in ("m-a", "m-b", "m-c")
        }
        self.assertTrue(all("leftovers" in values for values in by_regulation.values()))
        self.assertNotIn("airballoon", by_regulation["m-a"])
        self.assertIn("airballoon", by_regulation["m-c"])

        natures = json.loads(
            (self.team_builder_bundle / "natures.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            {
                (record["increased_stat"], record["decreased_stat"])
                for record in natures
            },
            {
                (plus, minus)
                for plus in ("atk", "def", "spa", "spd", "spe")
                for minus in ("atk", "def", "spa", "spd", "spe")
                if plus != minus
            }
            | {(None, None)},
        )

        relations = json.loads(
            (self.team_builder_bundle / "mega_item_relations.json").read_text(
                encoding="utf-8"
            )
        )
        charizard = {
            (record["item_id"], record["mega_form_id"])
            for record in relations
            if record["regulation_id"] == "m-c"
            and record["base_form_id"] == "charizard"
        }
        self.assertEqual(
            charizard,
            {("charizarditex", "charizardmegax"), ("charizarditey", "charizardmegay")},
        )

    def test_team_builder_release_rejects_invalid_nature_and_mega_relations(
        self,
    ) -> None:
        mutations = (
            ("natures.json", lambda values: values[0].update(decreased_stat=None)),
            ("mega_item_relations.json", lambda values: values.pop()),
            (
                "mega_item_relations.json",
                lambda values: values[0].update(mega_form_id="charizardmegax"),
            ),
            (
                "mega_item_relations.json",
                lambda values: values[0].update(regulation_id="m-z"),
            ),
        )
        for filename, mutate in mutations:
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as name:
                bundle = Path(name) / self.team_builder_bundle.name
                shutil.copytree(self.team_builder_bundle, bundle)
                path = bundle / filename
                values = json.loads(path.read_text(encoding="utf-8"))
                mutate(values)
                path.write_bytes(_canonical_bytes(values))
                with self.assertRaises(BundleError):
                    validate_bundle(bundle, verify_manifest=False)

    def test_multi_revision_release_goldens_and_semantic_diff(self) -> None:
        releases = Path(__file__).parents[1] / "releases"
        old = releases / "showdown-3a766f2c-s1-i2-4bedbf1eb44d"
        bundle = releases / "showdown-multi-s2-i3-fc85b358deaa"
        manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(
            (manifest["bundle_id"], manifest["bundle_hash"]),
            (
                "showdown-multi-s2-i3-fc85b358deaa",
                "fc85b358deaa105d4fcd57602dee863e29a57fa62e7bb6b1b69018ddd2dbd038",
            ),
        )
        self.assertEqual(
            [source["regulations"] for source in manifest["showdown_sources"]],
            [["m-a"], ["m-b", "m-c"]],
        )
        memberships = json.loads(
            (bundle / "regulation_memberships.json").read_text(encoding="utf-8")
        )
        ma = {
            value["form_id"] for value in memberships if value["regulation_id"] == "m-a"
        }
        self.assertTrue({"pikachu", "charizard", "charizardmegax", "aegislash"} <= ma)
        self.assertTrue({"cinderace", "magearnamega"}.isdisjoint(ma))
        learnsets = json.loads((bundle / "learnsets.json").read_text(encoding="utf-8"))
        self.assertTrue(any(value["regulation_id"] == "m-a" for value in learnsets))
        self.assertEqual(
            {
                value["source_mod"]
                for value in learnsets
                if value["regulation_id"] == "m-a"
            },
            {"base", "champions"},
        )
        difference = compare_bundles(old, bundle)["files"]
        self.assertTrue(
            all(
                value["removed"] == value["changed"] == 0
                for value in difference.values()
            )
        )
        for filename in (
            "regulation_memberships.json",
            "profiles.json",
            "ability_profiles.json",
            "move_profiles.json",
            "move_flag_relations.json",
            "learnsets.json",
        ):
            self.assertTrue(
                all(
                    key.startswith("m-a:") for key in difference[filename]["added_keys"]
                )
            )
        self.assertEqual(difference["moves.json"]["added_keys"], ["pound"])
        self.assertEqual(difference["sprites.json"]["added"], 0)

    def test_multi_revision_provenance_container_mutations_fail_closed(self) -> None:
        reviewed = (
            Path(__file__).parents[1] / "releases" / "showdown-multi-s2-i3-fc85b358deaa"
        )
        with tempfile.TemporaryDirectory() as name:
            bundle = Path(name) / reviewed.name
            shutil.copytree(reviewed, bundle)
            path = bundle / "provenance.json"
            original = path.read_bytes()
            valid = json.loads(original)["showdown_sources"]
            for sources in (
                [],
                [{}],
                [None, None],
                list(reversed(valid)),
                [{**valid[0], "regulations": ["m-b"]}, valid[1]],
            ):
                value = json.loads(original)
                value["showdown_sources"] = sources
                path.write_bytes(_canonical_bytes(value))
                with self.subTest(sources=sources), self.assertRaises(BundleError):
                    validate_bundle(bundle, verify_manifest=False)
            path.write_bytes(original)

    def test_corrected_release_has_exact_legality_and_dependency_delta(self) -> None:
        releases = Path(__file__).parents[1] / "releases"
        candidates = []
        for bundle in releases.glob("showdown-*"):
            if not bundle.is_dir():
                continue
            manifest = json.loads(
                (bundle / "manifest.json").read_text(encoding="utf-8")
            )
            if (
                manifest["importer_version"] == "2"
                and manifest["counts"]["memberships"] == 663
            ):
                candidates.append(bundle)
        self.assertEqual(len(candidates), 1)
        bundle = candidates[0]
        self.assertEqual(bundle.name, "showdown-3a766f2c-s1-i2-4bedbf1eb44d")
        summary = validate_bundle(bundle)
        self.assertEqual(
            summary["counts"]["legal_forms_by_regulation"], {"m-b": 314, "m-c": 349}
        )
        self.assertEqual(summary["counts"]["forms"], 350)
        self.assertEqual(summary["counts"]["profiles"], 700)
        self.assertEqual(summary["counts"]["mega_relations"], 82)
        self.assertEqual(summary["counts"]["sprites"], 700)

        memberships = json.loads(
            (bundle / "regulation_memberships.json").read_text(encoding="utf-8")
        )
        membership_ids = {
            (value["regulation_id"], value["form_id"]) for value in memberships
        }
        for regulation_id in ("m-b", "m-c"):
            self.assertNotIn((regulation_id, "magearnamega"), membership_ids)
            self.assertNotIn((regulation_id, "magearnaoriginalmega"), membership_ids)
        forms = {
            value["id"]
            for value in json.loads((bundle / "forms.json").read_text(encoding="utf-8"))
        }
        self.assertTrue(
            {"magearna", "magearnamega", "magearnaoriginalmega"}.isdisjoint(forms)
        )

        old_bundle = releases / "showdown-3a766f2c-s1-i1-923ba416555c"
        difference = compare_bundles(old_bundle, bundle)["files"]
        for filename, changes in difference.items():
            with self.subTest(filename=filename):
                self.assertEqual(changes["added"], 0)
                self.assertEqual(changes["changed"], 0)
        self.assertEqual(
            difference["regulation_memberships.json"]["removed_keys"],
            [
                "m-b:magearnamega",
                "m-b:magearnaoriginalmega",
                "m-c:magearnamega",
                "m-c:magearnaoriginalmega",
            ],
        )
        expected_removal_counts = {
            "abilities.json": 1,
            "ability_profiles.json": 2,
            "forms.json": 3,
            "learnsets.json": 462,
            "mega_relations.json": 2,
            "profiles.json": 6,
            "regulation_memberships.json": 4,
            "sprite_mappings.json": 3,
            "sprites.json": 6,
        }
        self.assertEqual(
            {
                filename: changes["removed"]
                for filename, changes in difference.items()
                if changes["removed"]
            },
            expected_removal_counts,
        )
        self.assertEqual(difference["abilities.json"]["removed_keys"], ["soulheart"])
        self.assertEqual(
            difference["ability_profiles.json"]["removed_keys"],
            ["m-b:soulheart", "m-c:soulheart"],
        )
        for filename in (
            "forms.json",
            "learnsets.json",
            "mega_relations.json",
            "profiles.json",
            "sprite_mappings.json",
            "sprites.json",
        ):
            with self.subTest(dependent_removals=filename):
                self.assertTrue(
                    all(
                        "magearna" in key
                        for key in difference[filename]["removed_keys"]
                    )
                )

    def test_published_release_preserves_representative_real_goldens(self) -> None:
        releases = Path(__file__).parents[1] / "releases"
        bundle = releases / "showdown-3a766f2c-s1-i2-4bedbf1eb44d"
        if not bundle.is_dir():
            self.skipTest("reviewed release has not been generated")

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
        self.assertEqual(
            {value["form_resolution"] for value in blade_moves}, {"changed-form"}
        )
        self.assertEqual(
            {value["source_form_id"] for value in blade_moves}, {"aegislash"}
        )

        move_profiles = {
            (value["regulation_id"], value["id"]): value
            for value in records("move_profiles.json")
        }
        mc_moves = {
            move_id: move_profiles[("m-c", move_id)]
            for move_id in (
                "aerialace",
                "drainpunch",
                "fakeout",
                "flamethrower",
                "protect",
            )
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
        reviewed = releases / "showdown-3a766f2c-s1-i2-4bedbf1eb44d"
        if not reviewed.is_dir():
            self.skipTest("reviewed release has not been generated")
        with tempfile.TemporaryDirectory() as name:
            bundle = Path(name) / reviewed.name
            shutil.copytree(reviewed, bundle)

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
            rejected(
                "forms.json",
                lambda value: value[0].update({"national_dex_number": "one"}),
            )
            rejected(
                "sprites.json", lambda value: value[0].update({"variant": "sparkle"})
            )
            rejected(
                "mega_relations.json",
                lambda value: value[0].update(
                    {"base_form_id": value[0]["mega_form_id"]}
                ),
            )
            rejected(
                "learnsets.json",
                lambda value: value[0].update({"source_form_id": "pikachu"}),
            )
            rejected(
                "sprite_mappings.json",
                lambda value: value[0].update({"pokeapi_pokemon_id": 1}),
            )
            notice = bundle / "POKEMON-SHOWDOWN-LICENSE.txt"
            original_notice = notice.read_bytes()
            notice.write_bytes(original_notice + b"altered\n")
            with self.assertRaises(BundleError):
                validate_bundle(bundle)
            notice.write_bytes(original_notice)
            rejected("manifest.json", lambda value: value.update({"unexpected": True}))
            rejected(
                "manifest.json", lambda value: value.update({"validation_status": 1})
            )
            rejected(
                "manifest.json",
                lambda value: value.update(
                    {
                        "bundle_id": value["bundle_id"].replace("-i2-", "-i1-"),
                        "importer_version": "1",
                    }
                ),
            )


class DamageCalculatorContractTests(unittest.TestCase):
    RIVALRY_GENDER_CASES = frozenset(
        {
            ("M", "M", "same"),
            ("M", "F", "opposite"),
            ("M", "N", "genderless"),
        }
    )

    def test_schema_five_release_and_consumer_fixture_match(self) -> None:
        data_root = Path(__file__).parents[1]
        release = data_root / "releases" / "showdown-multi-s5-i6-38ee90625b30"
        fixture = json.loads(
            (data_root / "fixtures" / "damage-calculator-data-v1.json").read_text(
                encoding="utf-8"
            )
        )
        summary = validate_bundle(release)
        self.assertEqual(summary["counts"]["type_effectiveness"], 324)
        self.assertEqual(fixture["data_version"], release.name)
        self.assertEqual(fixture["schema_version"], "damage-calculator-data-v1")

        def records(name: str) -> list[dict[str, object]]:
            return json.loads((release / name).read_text(encoding="utf-8"))

        capability = records("calculator_capabilities.json")[0]
        self.assertEqual(
            fixture["capability"],
            {
                key: value
                for key, value in capability.items()
                if key != "state_input_policy"
            },
        )
        self.assertEqual(fixture["mechanics"], records("mechanics_profiles.json")[0])
        self.assertEqual(
            fixture["state_input_policy"], capability["state_input_policy"]
        )
        profiles = {
            (value["regulation_id"], value["form_id"]): value
            for value in records("profiles.json")
        }
        charizard = profiles[("m-c", "charizard")]
        self.assertEqual(
            fixture["forms"][0]["weight_tenths_kg"], charizard["weight_tenths_kg"]
        )
        self.assertEqual(fixture["forms"][0]["base_stats"], charizard["stats"])
        moves = {
            (value["regulation_id"], value["id"]): value
            for value in records("move_profiles.json")
        }
        fixture_moves = {value["id"]: value for value in fixture["moves"]}
        self.assertEqual(
            fixture_moves["earthquake"]["calculation"],
            moves[("m-c", "earthquake")]["calculation"],
        )
        self.assertEqual(
            moves[("m-c", "counter")]["contextual_inputs"],
            [
                {
                    "key": "prior_damage_taken",
                    "label": "Prior damage taken",
                    "kind": "integer",
                    "default": 0,
                    "minimum": 0,
                    "maximum": 65535,
                }
            ],
        )
        self.assertEqual(
            moves[("m-c", "spitup")]["contextual_inputs"],
            [
                {
                    "key": "stockpile_count",
                    "label": "Stockpile count",
                    "kind": "integer",
                    "default": 1,
                    "minimum": 1,
                    "maximum": 3,
                }
            ],
        )
        self.assertEqual(
            [value["key"] for value in moves[("m-c", "beatup")]["contextual_inputs"]],
            ["ally_1_base_attack", "ally_2_base_attack", "ally_3_base_attack"],
        )
        effectiveness = {
            (value["attacking_type_id"], value["defending_type_id"]): value
            for value in records("type_effectiveness.json")
        }
        self.assertEqual(effectiveness[("normal", "ghost")]["multiplier_percent"], 0)
        self.assertEqual(effectiveness[("fire", "grass")]["multiplier_percent"], 200)

        self.assertEqual(
            set(fixture),
            {
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
                "type_effectiveness",
                "mega_item_relations",
            },
        )
        type_ids = {value["id"] for value in fixture["types"]}
        ability_ids = {value["id"] for value in fixture["abilities"]}
        item_ids = {value["id"] for value in fixture["items"]}
        move_ids = {value["id"] for value in fixture["moves"]}
        form_ids = {value["id"] for value in fixture["forms"]}
        for form in fixture["forms"]:
            self.assertLessEqual(set(form["types"]), type_ids)
            self.assertLessEqual(
                {value["id"] for value in form["abilities"]}, ability_ids
            )
            self.assertLessEqual(set(form["move_ids"]), move_ids)
        self.assertEqual(
            {
                (value["attacking_type_id"], value["defending_type_id"])
                for value in fixture["type_effectiveness"]
            },
            {
                (attacking, defending)
                for attacking in type_ids
                for defending in type_ids
            },
        )
        relation = fixture["mega_item_relations"][0]
        self.assertIn(relation["item_id"], item_ids)
        self.assertIn(relation["base_form_id"], form_ids)
        self.assertIn(relation["mega_form_id"], form_ids)
        mega = next(
            value
            for value in fixture["forms"]
            if value["id"] == relation["mega_form_id"]
        )
        self.assertFalse(mega["searchable"])
        self.assertEqual(
            mega["abilities"], [{"id": relation["locked_ability_id"], "slot": "0"}]
        )
        charizard_fixture = next(
            value for value in fixture["forms"] if value["id"] == "charizard"
        )
        self.assertEqual(
            (charizard_fixture["gender_options"], charizard_fixture["default_gender"]),
            (["M", "F"], "M"),
        )
        self.assertEqual(
            self.RIVALRY_GENDER_CASES,
            {("M", "M", "same"), ("M", "F", "opposite"), ("M", "N", "genderless")},
        )

        engine_types = (
            Path(__file__).parents[3]
            / "references/vgc-multicalc/src/domain/data/types.ts"
        ).read_text(encoding="utf-8")
        for interface in ("StateMove", "StatePokemon"):
            body = re.search(
                rf"export interface {interface} \{{(.*?)\n\}}", engine_types, re.DOTALL
            )
            self.assertIsNotNone(body)
            engine_keys = set(re.findall(r"^\s*(\w+)\??:", body.group(1), re.MULTILINE))
            policy = fixture["state_input_policy"][interface]
            classified = (
                set(policy["source"])
                | set(policy["user"])
                | set(policy["deterministic_defaults"])
                | set(policy["unsupported"])
            )
            self.assertEqual(classified, engine_keys)
            self.assertEqual(
                sum(
                    key in group
                    for group in (
                        policy["source"],
                        policy["user"],
                        policy["deterministic_defaults"],
                        policy["unsupported"],
                    )
                    for key in engine_keys
                ),
                len(engine_keys),
            )

    def test_schema_five_context_mutations_fail_closed(self) -> None:
        reviewed = (
            Path(__file__).parents[1] / "releases" / "showdown-multi-s5-i6-38ee90625b30"
        )
        with tempfile.TemporaryDirectory() as name:
            bundle = Path(name) / reviewed.name
            shutil.copytree(reviewed, bundle)
            path = bundle / "move_profiles.json"
            values = json.loads(path.read_text(encoding="utf-8"))
            rage_fist = next(value for value in values if value["id"] == "ragefist")
            rage_fist["contextual_inputs"][0]["key"] = "unreviewed_state"
            path.write_bytes(_canonical_bytes(values))
            with self.assertRaisesRegex(BundleError, "unknown context key"):
                validate_bundle(bundle, verify_manifest=False)

    def test_schema_five_nested_calculation_mutations_fail_closed(self) -> None:
        reviewed = (
            Path(__file__).parents[1] / "releases" / "showdown-multi-s5-i6-38ee90625b30"
        )

        def rejected(filename: str, mutate: object, message: str) -> None:
            with tempfile.TemporaryDirectory() as name:
                bundle = Path(name) / reviewed.name
                shutil.copytree(reviewed, bundle)
                path = bundle / filename
                values = json.loads(path.read_text(encoding="utf-8"))
                mutate(values)
                path.write_bytes(_canonical_bytes(values))
                with self.assertRaisesRegex(BundleError, message):
                    validate_bundle(bundle, verify_manifest=False)

        rejected(
            "move_profiles.json",
            lambda values: values[0]["calculation"].update({"drain": [1, 0]}),
            "fraction",
        )
        rejected(
            "move_profiles.json",
            lambda values: values[0]["calculation"].update({"always_crit": 1}),
            "boolean",
        )
        rejected(
            "move_profiles.json",
            lambda values: values[0]["calculation"].update(
                {
                    "secondary": {
                        "chance": 101,
                        "boosts": {},
                        "self_boosts": {},
                        "status": None,
                        "volatile_status": None,
                    }
                }
            ),
            "chance",
        )
        rejected(
            "item_profiles.json",
            lambda values: values[0]["calculation"].update(
                {"plate_type_id": "unknown"}
            ),
            "unknown type",
        )
        rejected(
            "move_profiles.json",
            lambda values: values[0]["calculation"].update({"multihit": [5, 2]}),
            "multihit",
        )
        rejected(
            "move_profiles.json",
            lambda values: values[0]["calculation"].update({"crit_ratio": -1}),
            "crit_ratio",
        )
        rejected(
            "move_profiles.json",
            lambda values: values[0]["calculation"].update(
                {"override_defensive_stat": "atk"}
            ),
            "override_defensive_stat",
        )


if __name__ == "__main__":
    unittest.main()

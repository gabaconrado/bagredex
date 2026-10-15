import uuid
from typing import Any

import django.core.validators
import django.db.models.deletion
import django.db.models.expressions
from django.db import migrations, models


def create_active_pointer(apps: Any, schema_editor: Any) -> None:
    active_data_version = apps.get_model("pokemon_data", "ActiveDataVersion")
    active_data_version.objects.get_or_create(singleton_key=1)


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Ability",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("canonical_id", models.CharField(max_length=100)),
                ("name", models.CharField(max_length=200)),
            ],
        ),
        migrations.CreateModel(
            name="PokemonProfile",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("hp", models.PositiveSmallIntegerField()),
                ("attack", models.PositiveSmallIntegerField()),
                ("defense", models.PositiveSmallIntegerField()),
                ("special_attack", models.PositiveSmallIntegerField()),
                ("special_defense", models.PositiveSmallIntegerField()),
                ("speed", models.PositiveSmallIntegerField()),
                ("bst", models.PositiveSmallIntegerField()),
            ],
        ),
        migrations.CreateModel(
            name="DataVersion",
            fields=[
                ("id", models.CharField(max_length=100, primary_key=True, serialize=False)),
                ("bundle_hash", models.CharField(max_length=64)),
                ("bundle_schema_version", models.CharField(max_length=32)),
                ("importer_version", models.CharField(max_length=32)),
                ("source_shape_version", models.CharField(max_length=100)),
                ("provenance", models.JSONField()),
                ("validation_summary", models.JSONField()),
                ("semantic_inventory", models.JSONField()),
                ("semantic_diff", models.JSONField()),
                ("manifest", models.JSONField()),
                (
                    "status",
                    models.CharField(
                        choices=[("loading", "Loading"), ("loaded", "Loaded")],
                        default="loading",
                        max_length=16,
                    ),
                ),
                ("loaded_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("status__in", ("loading", "loaded"))),
                        name="pokemon_data_version_has_valid_status",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="DataActivation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("activated_at", models.DateTimeField(auto_now_add=True)),
                (
                    "new_version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="activations_to",
                        to="pokemon_data.dataversion",
                    ),
                ),
                (
                    "previous_version",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="activations_from",
                        to="pokemon_data.dataversion",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="AbilityProfile",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("short_description", models.TextField()),
                ("description", models.TextField()),
                (
                    "ability",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.ability"
                    ),
                ),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="ability",
            name="version",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
            ),
        ),
        migrations.CreateModel(
            name="MechanicsProfile",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("canonical_id", models.CharField(max_length=100)),
                ("level", models.PositiveSmallIntegerField()),
                ("sp_minimum", models.PositiveSmallIntegerField()),
                ("sp_maximum", models.PositiveSmallIntegerField()),
                ("hp_formula", models.CharField(max_length=200)),
                ("other_formula", models.CharField(max_length=200)),
                ("nature_percentages", models.JSONField()),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Move",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("canonical_id", models.CharField(max_length=100)),
                ("name", models.CharField(max_length=200)),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="MoveFlag",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("canonical_id", models.CharField(max_length=100)),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="MoveProfile",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("Physical", "Physical"),
                            ("Special", "Special"),
                            ("Status", "Status"),
                        ],
                        max_length=8,
                    ),
                ),
                ("base_power", models.PositiveSmallIntegerField()),
                ("accuracy", models.PositiveSmallIntegerField(null=True)),
                ("always_hits", models.BooleanField(default=False)),
                (
                    "pp",
                    models.PositiveSmallIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(20),
                        ]
                    ),
                ),
                ("priority", models.SmallIntegerField()),
                ("target", models.CharField(max_length=100)),
                ("short_description", models.TextField()),
                ("description", models.TextField()),
                (
                    "move",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.move"
                    ),
                ),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="MoveFlagRelation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "flag",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.moveflag"
                    ),
                ),
                (
                    "move_profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="flags",
                        to="pokemon_data.moveprofile",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PokemonForm",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("canonical_id", models.CharField(max_length=100)),
                ("name", models.CharField(max_length=200)),
                ("national_dex_number", models.PositiveSmallIntegerField()),
                ("form_label", models.CharField(blank=True, max_length=100)),
                ("is_mega", models.BooleanField()),
                ("sprite_id", models.CharField(max_length=100)),
                (
                    "base_form",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="derived_forms",
                        to="pokemon_data.pokemonform",
                    ),
                ),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="MegaRelation",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
                (
                    "base_form",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="mega_relations",
                        to="pokemon_data.pokemonform",
                    ),
                ),
                (
                    "mega_form",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="base_relation",
                        to="pokemon_data.pokemonform",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="RegulationMembership",
            fields=[
                (
                    "profile",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        primary_key=True,
                        related_name="membership",
                        serialize=False,
                        to="pokemon_data.pokemonprofile",
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="pokemonprofile",
            name="form",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.pokemonform"
            ),
        ),
        migrations.AddField(
            model_name="pokemonprofile",
            name="version",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
            ),
        ),
        migrations.CreateModel(
            name="LearnsetEntry",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                (
                    "form_resolution",
                    models.CharField(
                        choices=[
                            ("direct", "Direct"),
                            ("pre-evolution", "Pre-evolution"),
                            ("changed-form", "Changed form"),
                            ("base-to-mega", "Base to Mega"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "source_mod",
                    models.CharField(
                        choices=[
                            ("base", "Base"),
                            ("champions", "Champions"),
                            ("championsregmb", "Champions Regulation M-B"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "source_kind",
                    models.CharField(
                        choices=[
                            ("direct", "Direct"),
                            ("inherited", "Inherited"),
                            ("override", "Override"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "move_profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.moveprofile"
                    ),
                ),
                (
                    "source_form",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.pokemonform"
                    ),
                ),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="learnset",
                        to="pokemon_data.pokemonprofile",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PokemonProfileAbility",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("slot", models.CharField(max_length=20)),
                (
                    "ability_profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to="pokemon_data.abilityprofile",
                    ),
                ),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="abilities",
                        to="pokemon_data.pokemonprofile",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Regulation",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("canonical_id", models.CharField(max_length=100)),
                ("name", models.CharField(max_length=200)),
                ("showdown_format_id", models.CharField(max_length=150)),
                ("mod", models.CharField(max_length=100)),
                ("ruleset", models.JSONField()),
                (
                    "mechanics_profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to="pokemon_data.mechanicsprofile",
                    ),
                ),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="pokemonprofile",
            name="regulation",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.regulation"
            ),
        ),
        migrations.AddField(
            model_name="moveprofile",
            name="regulation",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.regulation"
            ),
        ),
        migrations.AddField(
            model_name="abilityprofile",
            name="regulation",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.regulation"
            ),
        ),
        migrations.CreateModel(
            name="SpriteMapping",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("pokeapi_pokemon_id", models.PositiveIntegerField()),
                ("pokeapi_identifier", models.CharField(max_length=200)),
                (
                    "mapping_rule",
                    models.CharField(
                        choices=[
                            ("normalized-identifier", "Normalized identifier"),
                            ("exception", "Reviewed exception"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "form",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="sprite_mapping",
                        to="pokemon_data.pokemonform",
                    ),
                ),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
            options={
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="Sprite",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "variant",
                    models.CharField(
                        choices=[("normal", "Normal"), ("shiny", "Shiny")], max_length=8
                    ),
                ),
                ("path", models.CharField(max_length=500)),
                ("source_path", models.CharField(max_length=500)),
                ("sha256", models.CharField(max_length=64)),
                ("width", models.PositiveSmallIntegerField()),
                ("height", models.PositiveSmallIntegerField()),
                ("provenance", models.JSONField(default=dict)),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
                (
                    "mapping",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="sprites",
                        to="pokemon_data.spritemapping",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Type",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("canonical_id", models.CharField(max_length=100)),
                ("name", models.CharField(max_length=200)),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="PokemonProfileType",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("position", models.PositiveSmallIntegerField()),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="types",
                        to="pokemon_data.pokemonprofile",
                    ),
                ),
                (
                    "type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.type"
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="moveprofile",
            name="type",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.type"
            ),
        ),
        migrations.CreateModel(
            name="ActiveDataVersion",
            fields=[
                (
                    "singleton_key",
                    models.PositiveSmallIntegerField(default=1, primary_key=True, serialize=False),
                ),
                (
                    "version",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="active_pointer",
                        to="pokemon_data.dataversion",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("singleton_key", 1)),
                        name="pokemon_data_active_singleton_key",
                    )
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="ability",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_ability"
            ),
        ),
        migrations.AddConstraint(
            model_name="mechanicsprofile",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_mechanics"
            ),
        ),
        migrations.AddConstraint(
            model_name="mechanicsprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(("sp_minimum__lte", models.F("sp_maximum"))),
                name="pokemon_data_valid_sp_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="move",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_move"
            ),
        ),
        migrations.AddConstraint(
            model_name="moveflag",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_move_flag"
            ),
        ),
        migrations.AddConstraint(
            model_name="moveflagrelation",
            constraint=models.UniqueConstraint(
                fields=("move_profile", "flag"), name="pokemon_data_unique_move_flag_relation"
            ),
        ),
        migrations.AddIndex(
            model_name="pokemonform",
            index=models.Index(
                fields=["version", "national_dex_number", "canonical_id"],
                name="pokemon_dat_version_d25c7e_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="pokemonform",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_form"
            ),
        ),
        migrations.AddConstraint(
            model_name="pokemonform",
            constraint=models.CheckConstraint(
                condition=models.Q(("national_dex_number__gt", 0)), name="pokemon_data_positive_dex"
            ),
        ),
        migrations.AddConstraint(
            model_name="megarelation",
            constraint=models.CheckConstraint(
                condition=models.Q(("base_form", models.F("mega_form")), _negated=True),
                name="pokemon_data_distinct_mega_forms",
            ),
        ),
        migrations.AddIndex(
            model_name="learnsetentry",
            index=models.Index(
                fields=["move_profile", "profile"], name="pokemon_dat_move_pr_c0c310_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="learnsetentry",
            constraint=models.UniqueConstraint(
                fields=("profile", "move_profile"), name="pokemon_data_unique_learnset_entry"
            ),
        ),
        migrations.AddIndex(
            model_name="pokemonprofileability",
            index=models.Index(
                fields=["ability_profile", "profile"], name="pokemon_dat_ability_1d042b_idx"
            ),
        ),
        migrations.AddConstraint(
            model_name="pokemonprofileability",
            constraint=models.UniqueConstraint(
                fields=("profile", "slot"), name="pokemon_data_unique_ability_slot"
            ),
        ),
        migrations.AddConstraint(
            model_name="pokemonprofileability",
            constraint=models.UniqueConstraint(
                fields=("profile", "ability_profile"), name="pokemon_data_unique_profile_ability"
            ),
        ),
        migrations.AddConstraint(
            model_name="regulation",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_regulation"
            ),
        ),
        migrations.AddIndex(
            model_name="pokemonprofile",
            index=models.Index(fields=["regulation", "hp"], name="pokemon_dat_regulat_36e97d_idx"),
        ),
        migrations.AddIndex(
            model_name="pokemonprofile",
            index=models.Index(
                fields=["regulation", "attack"], name="pokemon_dat_regulat_e7ee42_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="pokemonprofile",
            index=models.Index(
                fields=["regulation", "defense"], name="pokemon_dat_regulat_3cf894_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="pokemonprofile",
            index=models.Index(
                fields=["regulation", "special_attack"], name="pokemon_dat_regulat_c4d832_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="pokemonprofile",
            index=models.Index(
                fields=["regulation", "special_defense"], name="pokemon_dat_regulat_f9226a_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="pokemonprofile",
            index=models.Index(
                fields=["regulation", "speed"], name="pokemon_dat_regulat_320ca6_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="pokemonprofile",
            index=models.Index(fields=["regulation", "bst"], name="pokemon_dat_regulat_83c4b7_idx"),
        ),
        migrations.AddConstraint(
            model_name="pokemonprofile",
            constraint=models.UniqueConstraint(
                fields=("regulation", "form"), name="pokemon_data_unique_pokemon_profile"
            ),
        ),
        migrations.AddConstraint(
            model_name="pokemonprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("hp__gt", 0),
                    ("attack__gt", 0),
                    ("defense__gt", 0),
                    ("special_attack__gt", 0),
                    ("special_defense__gt", 0),
                    ("speed__gt", 0),
                ),
                name="pokemon_data_positive_stats",
            ),
        ),
        migrations.AddConstraint(
            model_name="pokemonprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "bst",
                        django.db.models.expressions.CombinedExpression(
                            django.db.models.expressions.CombinedExpression(
                                django.db.models.expressions.CombinedExpression(
                                    django.db.models.expressions.CombinedExpression(
                                        django.db.models.expressions.CombinedExpression(
                                            models.F("hp"), "+", models.F("attack")
                                        ),
                                        "+",
                                        models.F("defense"),
                                    ),
                                    "+",
                                    models.F("special_attack"),
                                ),
                                "+",
                                models.F("special_defense"),
                            ),
                            "+",
                            models.F("speed"),
                        ),
                    )
                ),
                name="pokemon_data_bst_matches_stats",
            ),
        ),
        migrations.AddConstraint(
            model_name="abilityprofile",
            constraint=models.UniqueConstraint(
                fields=("regulation", "ability"), name="pokemon_data_unique_ability_profile"
            ),
        ),
        migrations.AddConstraint(
            model_name="sprite",
            constraint=models.UniqueConstraint(
                fields=("mapping", "variant"), name="pokemon_data_unique_sprite_variant"
            ),
        ),
        migrations.AddConstraint(
            model_name="sprite",
            constraint=models.CheckConstraint(
                condition=models.Q(("variant__in", ("normal", "shiny"))),
                name="pokemon_data_sprite_variant",
            ),
        ),
        migrations.AddConstraint(
            model_name="sprite",
            constraint=models.CheckConstraint(
                condition=models.Q(("height", 384), ("width", 384)),
                name="pokemon_data_sprite_dimensions",
            ),
        ),
        migrations.AddConstraint(
            model_name="type",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_type"
            ),
        ),
        migrations.AddIndex(
            model_name="pokemonprofiletype",
            index=models.Index(fields=["type", "profile"], name="pokemon_dat_type_id_3a790b_idx"),
        ),
        migrations.AddConstraint(
            model_name="pokemonprofiletype",
            constraint=models.UniqueConstraint(
                fields=("profile", "position"), name="pokemon_data_unique_type_position"
            ),
        ),
        migrations.AddConstraint(
            model_name="pokemonprofiletype",
            constraint=models.UniqueConstraint(
                fields=("profile", "type"), name="pokemon_data_unique_profile_type"
            ),
        ),
        migrations.AddConstraint(
            model_name="pokemonprofiletype",
            constraint=models.CheckConstraint(
                condition=models.Q(("position__gte", 0), ("position__lte", 1)),
                name="pokemon_data_type_position_range",
            ),
        ),
        migrations.AddConstraint(
            model_name="moveprofile",
            constraint=models.UniqueConstraint(
                fields=("regulation", "move"), name="pokemon_data_unique_move_profile"
            ),
        ),
        migrations.AddConstraint(
            model_name="moveprofile",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(("accuracy__isnull", True), ("always_hits", True)),
                    models.Q(("accuracy__isnull", False), ("always_hits", False)),
                    _connector="OR",
                ),
                name="pokemon_data_valid_accuracy",
            ),
        ),
        migrations.RunPython(create_active_pointer, migrations.RunPython.noop),
    ]

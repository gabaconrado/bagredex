import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("pokemon_data", "0004_itemprofile_description_and_more")]

    operations = [
        migrations.AddField(
            model_name="abilityprofile",
            name="contextual_inputs",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="itemprofile",
            name="contextual_inputs",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="moveprofile",
            name="calculation",
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name="moveprofile",
            name="contextual_inputs",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="pokemonform",
            name="default_gender",
            field=models.CharField(default="M", max_length=1),
        ),
        migrations.AddField(
            model_name="pokemonform",
            name="gender",
            field=models.CharField(default="variable", max_length=16),
        ),
        migrations.AddField(
            model_name="pokemonform",
            name="gender_options",
            field=models.JSONField(default=list),
        ),
        migrations.AddField(
            model_name="pokemonform",
            name="is_nfe",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="pokemonprofile",
            name="weight_tenths_kg",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="itemprofile",
            name="calculation",
            field=models.JSONField(default=dict),
        ),
        migrations.CreateModel(
            name="CalculatorCapability",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("canonical_id", models.CharField(max_length=100)),
                ("contract", models.JSONField()),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="TypeEffectiveness",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("multiplier_percent", models.PositiveSmallIntegerField()),
                (
                    "attacking_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="attacking",
                        to="pokemon_data.type",
                    ),
                ),
                (
                    "defending_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="defending",
                        to="pokemon_data.type",
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
        migrations.AddConstraint(
            model_name="calculatorcapability",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"),
                name="pokemon_data_unique_calculator_capability",
            ),
        ),
        migrations.AddConstraint(
            model_name="typeeffectiveness",
            constraint=models.UniqueConstraint(
                fields=("version", "attacking_type", "defending_type"),
                name="pokemon_data_unique_type_effectiveness",
            ),
        ),
        migrations.AddConstraint(
            model_name="typeeffectiveness",
            constraint=models.CheckConstraint(
                condition=models.Q(("multiplier_percent__in", (0, 50, 100, 200))),
                name="pokemon_data_valid_type_effectiveness",
            ),
        ),
    ]

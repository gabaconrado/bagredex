import uuid

import django.db.models.deletion
from django.db import migrations, models

CREATE_DATA_GUARDS = """
CREATE TRIGGER pokemon_data_item_immutable
BEFORE INSERT OR UPDATE OR DELETE ON pokemon_data_item
FOR EACH ROW EXECUTE FUNCTION pokemon_data_guard_owned_mutation();
CREATE TRIGGER pokemon_data_nature_immutable
BEFORE INSERT OR UPDATE OR DELETE ON pokemon_data_nature
FOR EACH ROW EXECUTE FUNCTION pokemon_data_guard_owned_mutation();
CREATE TRIGGER pokemon_data_itemprofile_immutable
BEFORE INSERT OR UPDATE OR DELETE ON pokemon_data_itemprofile
FOR EACH ROW EXECUTE FUNCTION pokemon_data_guard_owned_mutation();
CREATE TRIGGER pokemon_data_megaitemrelation_immutable
BEFORE INSERT OR UPDATE OR DELETE ON pokemon_data_megaitemrelation
FOR EACH ROW EXECUTE FUNCTION pokemon_data_guard_owned_mutation();

CREATE FUNCTION pokemon_data_assert_team_builder_version_local() RETURNS trigger AS $$
DECLARE
    regulation_version varchar(100);
    related_version varchar(100);
    third_version varchar(100);
    item_regulation uuid;
    base_species uuid;
    mega_species uuid;
    base_marker boolean;
    mega_marker boolean;
BEGIN
    SELECT version_id INTO regulation_version FROM pokemon_data_regulation
    WHERE id = NEW.regulation_id;
    IF TG_TABLE_NAME = 'pokemon_data_itemprofile' THEN
        SELECT version_id INTO related_version FROM pokemon_data_item WHERE id = NEW.item_id;
    ELSE
        SELECT version_id, regulation_id INTO related_version, item_regulation
        FROM pokemon_data_itemprofile WHERE id = NEW.item_profile_id;
        SELECT version_id, base_form_id, is_mega INTO third_version, base_species, base_marker
        FROM pokemon_data_pokemonform WHERE id = NEW.base_form_id;
        IF NEW.version_id <> third_version THEN
            RAISE EXCEPTION 'Mega item base form must belong to the same version';
        END IF;
        SELECT version_id, base_form_id, is_mega INTO third_version, mega_species, mega_marker
        FROM pokemon_data_pokemonform WHERE id = NEW.mega_form_id;
        IF item_regulation <> NEW.regulation_id OR base_marker IS NOT FALSE
            OR mega_marker IS NOT TRUE OR base_species <> mega_species THEN
            RAISE EXCEPTION 'invalid Mega item relation';
        END IF;
    END IF;
    IF NEW.version_id IS NULL OR regulation_version IS NULL OR related_version IS NULL
        OR NEW.version_id <> regulation_version OR NEW.version_id <> related_version
        OR (third_version IS NOT NULL AND NEW.version_id <> third_version) THEN
        RAISE EXCEPTION 'related Pokemon data records must belong to the same version';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER pokemon_data_itemprofile_version_local
AFTER INSERT OR UPDATE ON pokemon_data_itemprofile DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pokemon_data_assert_team_builder_version_local();
CREATE CONSTRAINT TRIGGER pokemon_data_megaitemrelation_version_local
AFTER INSERT OR UPDATE ON pokemon_data_megaitemrelation DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pokemon_data_assert_team_builder_version_local();
"""

DROP_DATA_GUARDS = """
DROP TRIGGER IF EXISTS pokemon_data_itemprofile_version_local ON pokemon_data_itemprofile;
DROP TRIGGER IF EXISTS pokemon_data_megaitemrelation_version_local ON pokemon_data_megaitemrelation;
DROP FUNCTION IF EXISTS pokemon_data_assert_team_builder_version_local();
DROP TRIGGER IF EXISTS pokemon_data_item_immutable ON pokemon_data_item;
DROP TRIGGER IF EXISTS pokemon_data_nature_immutable ON pokemon_data_nature;
DROP TRIGGER IF EXISTS pokemon_data_itemprofile_immutable ON pokemon_data_itemprofile;
DROP TRIGGER IF EXISTS pokemon_data_megaitemrelation_immutable ON pokemon_data_megaitemrelation;
"""


class Migration(migrations.Migration):
    dependencies = [("pokemon_data", "0002_database_guards")]

    operations = [
        migrations.AddField(
            model_name="mechanicsprofile",
            name="sp_total_max",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="Item",
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
            name="Nature",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("canonical_id", models.CharField(max_length=100)),
                ("name", models.CharField(max_length=200)),
                ("increased_stat", models.CharField(blank=True, max_length=3, null=True)),
                ("decreased_stat", models.CharField(blank=True, max_length=3, null=True)),
                (
                    "version",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.dataversion"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="ItemProfile",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("source_status", models.CharField(max_length=32)),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.item"
                    ),
                ),
                (
                    "regulation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.regulation"
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
            name="MegaItemRelation",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                (
                    "base_form",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="pokemon_data.pokemonform",
                    ),
                ),
                (
                    "item_profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.itemprofile"
                    ),
                ),
                (
                    "mega_form",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="pokemon_data.pokemonform",
                    ),
                ),
                (
                    "regulation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="pokemon_data.regulation"
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
            model_name="item",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_item"
            ),
        ),
        migrations.AddConstraint(
            model_name="nature",
            constraint=models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_nature"
            ),
        ),
        migrations.AddConstraint(
            model_name="nature",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(("decreased_stat__isnull", True), ("increased_stat__isnull", True)),
                    models.Q(("decreased_stat__isnull", False), ("increased_stat__isnull", False)),
                    _connector="OR",
                ),
                name="pokemon_data_nature_directions_paired",
            ),
        ),
        migrations.AddConstraint(
            model_name="itemprofile",
            constraint=models.UniqueConstraint(
                fields=("regulation", "item"), name="pokemon_data_unique_item_profile"
            ),
        ),
        migrations.AddConstraint(
            model_name="megaitemrelation",
            constraint=models.UniqueConstraint(
                fields=("regulation", "item_profile", "base_form"),
                name="pokemon_data_unique_mega_item_relation",
            ),
        ),
        migrations.AddConstraint(
            model_name="megaitemrelation",
            constraint=models.CheckConstraint(
                condition=models.Q(("base_form", models.F("mega_form")), _negated=True),
                name="pokemon_data_distinct_mega_item_forms",
            ),
        ),
        migrations.RunSQL(CREATE_DATA_GUARDS, DROP_DATA_GUARDS),
    ]

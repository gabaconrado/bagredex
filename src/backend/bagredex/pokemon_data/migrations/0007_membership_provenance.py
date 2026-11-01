from typing import Any

from django.db import migrations, models

DROP_MEMBERSHIP_IMMUTABILITY_TRIGGER = """
DROP TRIGGER IF EXISTS pokemon_data_regulationmembership_immutable
ON pokemon_data_regulationmembership;
"""

CREATE_MEMBERSHIP_IMMUTABILITY_TRIGGER = """
CREATE TRIGGER pokemon_data_regulationmembership_immutable
BEFORE INSERT OR UPDATE OR DELETE ON pokemon_data_regulationmembership
FOR EACH ROW EXECUTE FUNCTION pokemon_data_guard_owned_mutation();
"""


def populate_source_form(apps: Any, schema_editor: Any) -> None:
    membership = apps.get_model("pokemon_data", "RegulationMembership")
    for row in membership.objects.select_related("profile__form").iterator():
        row.source_form_id = row.profile.form.canonical_id
        row.save(update_fields=("source_form_id",))


class Migration(migrations.Migration):
    dependencies = [("pokemon_data", "0006_held_item_stat_mechanics")]

    operations = [
        migrations.AddField(
            model_name="regulationmembership",
            name="resolution",
            field=models.CharField(
                choices=[("direct", "Direct"), ("related-fixed-sex", "Related fixed sex")],
                default="direct",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="regulationmembership",
            name="source_form_id",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.RunSQL(
            DROP_MEMBERSHIP_IMMUTABILITY_TRIGGER,
            CREATE_MEMBERSHIP_IMMUTABILITY_TRIGGER,
        ),
        migrations.RunPython(populate_source_form, migrations.RunPython.noop),
        migrations.RunSQL(
            CREATE_MEMBERSHIP_IMMUTABILITY_TRIGGER,
            DROP_MEMBERSHIP_IMMUTABILITY_TRIGGER,
        ),
        migrations.AddConstraint(
            model_name="regulationmembership",
            constraint=models.CheckConstraint(
                condition=models.Q(resolution__in=("direct", "related-fixed-sex")),
                name="pokemon_data_membership_resolution_valid",
            ),
        ),
    ]

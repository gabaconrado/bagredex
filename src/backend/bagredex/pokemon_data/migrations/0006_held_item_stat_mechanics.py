from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("pokemon_data", "0005_damage_calculator_data")]

    operations = [
        migrations.AddField(
            model_name="abilityprofile",
            name="suppresses_held_item",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="itemprofile",
            name="stat_modifiers",
            field=models.JSONField(default=list),
        ),
    ]

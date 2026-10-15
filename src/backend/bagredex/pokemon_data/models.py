"""Immutable, version-owned canonical Pokémon data models."""

from __future__ import annotations

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class DataVersion(models.Model):
    """A completely validated and atomically loaded portable bundle."""

    class Status(models.TextChoices):
        LOADING = "loading", "Loading"
        LOADED = "loaded", "Loaded"

    id = models.CharField(primary_key=True, max_length=100)
    bundle_hash = models.CharField(max_length=64)
    bundle_schema_version = models.CharField(max_length=32)
    importer_version = models.CharField(max_length=32)
    source_shape_version = models.CharField(max_length=100)
    provenance = models.JSONField()
    validation_summary = models.JSONField()
    semantic_inventory = models.JSONField()
    semantic_diff = models.JSONField()
    manifest = models.JSONField()
    status = models.CharField(max_length=16, choices=Status, default=Status.LOADING)
    loaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=("loading", "loaded")),
                name="pokemon_data_version_has_valid_status",
            )
        ]

    def __str__(self) -> str:
        return self.pk


class ActiveDataVersion(models.Model):
    """The lockable singleton pointer to the globally active data version."""

    singleton_key = models.PositiveSmallIntegerField(primary_key=True, default=1)
    version = models.OneToOneField(
        DataVersion,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="active_pointer",
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(singleton_key=1), name="pokemon_data_active_singleton_key"
            )
        ]

    def __str__(self) -> str:
        return f"Active Pokémon data: {self.version_id or 'none'}"


class DataActivation(models.Model):
    """Append-only audit record for an active-version transition."""

    previous_version = models.ForeignKey(
        DataVersion,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="activations_from",
    )
    new_version = models.ForeignKey(
        DataVersion, on_delete=models.PROTECT, related_name="activations_to"
    )
    activated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.previous_version_id or 'none'} -> {self.new_version_id}"


class VersionOwnedModel(models.Model):
    """Base for records whose identity exists only inside one data version."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(DataVersion, on_delete=models.PROTECT)

    class Meta:
        abstract = True

    def __str__(self) -> str:
        return str(self.pk)


class NamedIdentity(VersionOwnedModel):
    """Base for version-owned canonical identifiers with display names."""

    canonical_id = models.CharField(max_length=100)
    name = models.CharField(max_length=200)

    class Meta:
        abstract = True

    def __str__(self) -> str:
        return self.name


class MechanicsProfile(VersionOwnedModel):
    """Exact arithmetic contract associated with a regulation."""

    canonical_id = models.CharField(max_length=100)
    level = models.PositiveSmallIntegerField()
    sp_minimum = models.PositiveSmallIntegerField()
    sp_maximum = models.PositiveSmallIntegerField()
    hp_formula = models.CharField(max_length=200)
    other_formula = models.CharField(max_length=200)
    nature_percentages = models.JSONField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_mechanics"
            ),
            models.CheckConstraint(
                condition=Q(sp_minimum__lte=models.F("sp_maximum")),
                name="pokemon_data_valid_sp_range",
            ),
        ]

    def __str__(self) -> str:
        return self.canonical_id


class Regulation(NamedIdentity):
    """A Showdown format and its mechanics contract."""

    showdown_format_id = models.CharField(max_length=150)
    mod = models.CharField(max_length=100)
    ruleset = models.JSONField()
    mechanics_profile = models.ForeignKey(MechanicsProfile, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_regulation"
            )
        ]


class PokemonForm(NamedIdentity):
    """A selectable or toggle-supporting exact Pokémon form."""

    national_dex_number = models.PositiveSmallIntegerField()
    base_form = models.ForeignKey("self", on_delete=models.PROTECT, related_name="derived_forms")
    form_label = models.CharField(max_length=100, blank=True)
    is_mega = models.BooleanField()
    sprite_id = models.CharField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_form"
            ),
            models.CheckConstraint(
                condition=Q(national_dex_number__gt=0), name="pokemon_data_positive_dex"
            ),
        ]
        indexes = [models.Index(fields=("version", "national_dex_number", "canonical_id"))]


class Type(NamedIdentity):
    """A stable Pokémon type identity."""

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_type"
            )
        ]


class Ability(NamedIdentity):
    """A stable ability identity."""

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_ability"
            )
        ]


class Move(NamedIdentity):
    """A stable move identity."""

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_move"
            )
        ]


class MoveFlag(VersionOwnedModel):
    """A stable Showdown move-flag identity."""

    canonical_id = models.CharField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("version", "canonical_id"), name="pokemon_data_unique_move_flag"
            )
        ]

    def __str__(self) -> str:
        return self.canonical_id


class AbilityProfile(VersionOwnedModel):
    """Regulation-effective ability descriptions."""

    regulation = models.ForeignKey(Regulation, on_delete=models.PROTECT)
    ability = models.ForeignKey(Ability, on_delete=models.PROTECT)
    short_description = models.TextField()
    description = models.TextField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("regulation", "ability"), name="pokemon_data_unique_ability_profile"
            )
        ]


class MoveProfile(VersionOwnedModel):
    """Regulation-effective move metadata and descriptions."""

    class Category(models.TextChoices):
        PHYSICAL = "Physical", "Physical"
        SPECIAL = "Special", "Special"
        STATUS = "Status", "Status"

    regulation = models.ForeignKey(Regulation, on_delete=models.PROTECT)
    move = models.ForeignKey(Move, on_delete=models.PROTECT)
    type = models.ForeignKey(Type, on_delete=models.PROTECT)
    category = models.CharField(max_length=8, choices=Category)
    base_power = models.PositiveSmallIntegerField()
    accuracy = models.PositiveSmallIntegerField(null=True)
    always_hits = models.BooleanField(default=False)
    pp = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(20)])
    priority = models.SmallIntegerField()
    target = models.CharField(max_length=100)
    short_description = models.TextField()
    description = models.TextField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("regulation", "move"), name="pokemon_data_unique_move_profile"
            ),
            models.CheckConstraint(
                condition=(
                    Q(always_hits=True, accuracy__isnull=True)
                    | Q(always_hits=False, accuracy__isnull=False)
                ),
                name="pokemon_data_valid_accuracy",
            ),
        ]


class PokemonProfile(VersionOwnedModel):
    """Regulation-effective form details, whether list-legal or toggle-only."""

    regulation = models.ForeignKey(Regulation, on_delete=models.PROTECT)
    form = models.ForeignKey(PokemonForm, on_delete=models.PROTECT)
    hp = models.PositiveSmallIntegerField()
    attack = models.PositiveSmallIntegerField()
    defense = models.PositiveSmallIntegerField()
    special_attack = models.PositiveSmallIntegerField()
    special_defense = models.PositiveSmallIntegerField()
    speed = models.PositiveSmallIntegerField()
    bst = models.PositiveSmallIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("regulation", "form"), name="pokemon_data_unique_pokemon_profile"
            ),
            models.CheckConstraint(
                condition=(
                    Q(hp__gt=0)
                    & Q(attack__gt=0)
                    & Q(defense__gt=0)
                    & Q(special_attack__gt=0)
                    & Q(special_defense__gt=0)
                    & Q(speed__gt=0)
                ),
                name="pokemon_data_positive_stats",
            ),
            models.CheckConstraint(
                condition=Q(
                    bst=(
                        models.F("hp")
                        + models.F("attack")
                        + models.F("defense")
                        + models.F("special_attack")
                        + models.F("special_defense")
                        + models.F("speed")
                    )
                ),
                name="pokemon_data_bst_matches_stats",
            ),
        ]
        indexes = [
            models.Index(fields=("regulation", "hp")),
            models.Index(fields=("regulation", "attack")),
            models.Index(fields=("regulation", "defense")),
            models.Index(fields=("regulation", "special_attack")),
            models.Index(fields=("regulation", "special_defense")),
            models.Index(fields=("regulation", "speed")),
            models.Index(fields=("regulation", "bst")),
        ]


class RegulationMembership(models.Model):
    """Explicit list legality; effective profiles alone never imply membership."""

    profile = models.OneToOneField(
        PokemonProfile, primary_key=True, on_delete=models.PROTECT, related_name="membership"
    )

    def __str__(self) -> str:
        return str(self.profile)


class PokemonProfileType(models.Model):
    """An ordered type on an effective Pokémon profile."""

    profile = models.ForeignKey(PokemonProfile, on_delete=models.PROTECT, related_name="types")
    type = models.ForeignKey(Type, on_delete=models.PROTECT)
    position = models.PositiveSmallIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("profile", "position"), name="pokemon_data_unique_type_position"
            ),
            models.UniqueConstraint(
                fields=("profile", "type"), name="pokemon_data_unique_profile_type"
            ),
            models.CheckConstraint(
                condition=Q(position__gte=0) & Q(position__lte=1),
                name="pokemon_data_type_position_range",
            ),
        ]
        indexes = [models.Index(fields=("type", "profile"))]

    def __str__(self) -> str:
        return f"{self.profile}: {self.position}={self.type}"


class PokemonProfileAbility(models.Model):
    """A slotted regulation-effective ability on a Pokémon profile."""

    profile = models.ForeignKey(PokemonProfile, on_delete=models.PROTECT, related_name="abilities")
    ability_profile = models.ForeignKey(AbilityProfile, on_delete=models.PROTECT)
    slot = models.CharField(max_length=20)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("profile", "slot"), name="pokemon_data_unique_ability_slot"
            ),
            models.UniqueConstraint(
                fields=("profile", "ability_profile"), name="pokemon_data_unique_profile_ability"
            ),
        ]
        indexes = [models.Index(fields=("ability_profile", "profile"))]

    def __str__(self) -> str:
        return f"{self.profile}: {self.slot}={self.ability_profile}"


class MoveFlagRelation(models.Model):
    """A regulation-effective move flag."""

    move_profile = models.ForeignKey(MoveProfile, on_delete=models.PROTECT, related_name="flags")
    flag = models.ForeignKey(MoveFlag, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("move_profile", "flag"), name="pokemon_data_unique_move_flag_relation"
            )
        ]

    def __str__(self) -> str:
        return f"{self.move_profile}: {self.flag}"


class MegaRelation(VersionOwnedModel):
    """A bidirectionally traversable base-to-Mega edge."""

    base_form = models.ForeignKey(
        PokemonForm, on_delete=models.PROTECT, related_name="mega_relations"
    )
    mega_form = models.OneToOneField(
        PokemonForm, on_delete=models.PROTECT, related_name="base_relation"
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~Q(base_form=models.F("mega_form")),
                name="pokemon_data_distinct_mega_forms",
            )
        ]


class LearnsetEntry(models.Model):
    """A validator-legal move for one regulation-effective form."""

    class FormResolution(models.TextChoices):
        DIRECT = "direct", "Direct"
        PRE_EVOLUTION = "pre-evolution", "Pre-evolution"
        CHANGED_FORM = "changed-form", "Changed form"
        BASE_TO_MEGA = "base-to-mega", "Base to Mega"

    class SourceMod(models.TextChoices):
        BASE = "base", "Base"
        CHAMPIONS = "champions", "Champions"
        CHAMPIONS_REG_M_B = "championsregmb", "Champions Regulation M-B"

    class SourceKind(models.TextChoices):
        DIRECT = "direct", "Direct"
        INHERITED = "inherited", "Inherited"
        OVERRIDE = "override", "Override"

    profile = models.ForeignKey(PokemonProfile, on_delete=models.PROTECT, related_name="learnset")
    move_profile = models.ForeignKey(MoveProfile, on_delete=models.PROTECT)
    form_resolution = models.CharField(max_length=20, choices=FormResolution)
    source_form = models.ForeignKey(PokemonForm, on_delete=models.PROTECT)
    source_mod = models.CharField(max_length=20, choices=SourceMod)
    source_kind = models.CharField(max_length=20, choices=SourceKind)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("profile", "move_profile"), name="pokemon_data_unique_learnset_entry"
            )
        ]
        indexes = [models.Index(fields=("move_profile", "profile"))]

    def __str__(self) -> str:
        return f"{self.profile}: {self.move_profile}"


class Sprite(VersionOwnedModel):
    """A verified static sprite derivative for an exact form and variant."""

    class Variant(models.TextChoices):
        NORMAL = "normal", "Normal"
        SHINY = "shiny", "Shiny"

    mapping = models.ForeignKey("SpriteMapping", on_delete=models.PROTECT, related_name="sprites")
    variant = models.CharField(max_length=8, choices=Variant)
    path = models.CharField(max_length=500)
    source_path = models.CharField(max_length=500)
    sha256 = models.CharField(max_length=64)
    width = models.PositiveSmallIntegerField()
    height = models.PositiveSmallIntegerField()
    provenance = models.JSONField(default=dict)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("mapping", "variant"), name="pokemon_data_unique_sprite_variant"
            ),
            models.CheckConstraint(
                condition=Q(variant__in=("normal", "shiny")),
                name="pokemon_data_sprite_variant",
            ),
            models.CheckConstraint(
                condition=Q(width=384, height=384),
                name="pokemon_data_sprite_dimensions",
            ),
        ]


class SpriteMapping(VersionOwnedModel):
    """The reviewed PokeAPI HOME identity mapping for one exact form."""

    class Rule(models.TextChoices):
        NORMALIZED_IDENTIFIER = "normalized-identifier", "Normalized identifier"
        EXCEPTION = "exception", "Reviewed exception"

    form = models.OneToOneField(
        PokemonForm, on_delete=models.PROTECT, related_name="sprite_mapping"
    )
    pokeapi_pokemon_id = models.PositiveIntegerField()
    pokeapi_identifier = models.CharField(max_length=200)
    mapping_rule = models.CharField(max_length=32, choices=Rule)

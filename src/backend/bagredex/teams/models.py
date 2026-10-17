"""Persistence models for explicitly saved private teams."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from bagredex.pokemon_data.models import (
    AbilityProfile,
    ItemProfile,
    MoveProfile,
    Nature,
    PokemonForm,
    PokemonProfile,
    Regulation,
)


class Team(models.Model):
    """One aggregate pinned to an exact immutable regulation row."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    regulation = models.ForeignKey(Regulation, on_delete=models.PROTECT)
    name = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("name"), "owner", name="teams_unique_owner_casefolded_name"
            )
        ]
        indexes = [models.Index(fields=("owner", "regulation", "-updated_at"))]

    def __str__(self) -> str:
        return self.name


class TeamMember(models.Model):
    """One ordered set, with durable species-clause identity."""

    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="members")
    position = models.PositiveSmallIntegerField()
    profile = models.ForeignKey(PokemonProfile, on_delete=models.PROTECT)
    species_form = models.ForeignKey(PokemonForm, on_delete=models.PROTECT)
    nickname = models.CharField(max_length=12, blank=True)
    ability_profile = models.ForeignKey(
        AbilityProfile, null=True, blank=True, on_delete=models.PROTECT
    )
    item_profile = models.ForeignKey(ItemProfile, null=True, blank=True, on_delete=models.PROTECT)
    nature = models.ForeignKey(Nature, on_delete=models.PROTECT)
    sp_hp = models.PositiveSmallIntegerField(default=0)
    sp_attack = models.PositiveSmallIntegerField(default=0)
    sp_defense = models.PositiveSmallIntegerField(default=0)
    sp_special_attack = models.PositiveSmallIntegerField(default=0)
    sp_special_defense = models.PositiveSmallIntegerField(default=0)
    sp_speed = models.PositiveSmallIntegerField(default=0)
    shiny = models.BooleanField(default=False)
    mega_preview = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("team", "position"), name="teams_unique_position"),
            models.UniqueConstraint(fields=("team", "species_form"), name="teams_unique_species"),
            models.UniqueConstraint(
                fields=("team", "item_profile"),
                condition=Q(item_profile__isnull=False),
                name="teams_unique_held_item",
            ),
            models.CheckConstraint(
                condition=Q(position__gte=0) & Q(position__lte=5),
                name="teams_member_position_range",
            ),
            *[
                models.CheckConstraint(
                    condition=Q(**{f"{field}__gte": 0}) & Q(**{f"{field}__lte": 32}),
                    name=f"teams_{field}_range",
                )
                for field in (
                    "sp_hp",
                    "sp_attack",
                    "sp_defense",
                    "sp_special_attack",
                    "sp_special_defense",
                    "sp_speed",
                )
            ],
        ]

    def __str__(self) -> str:
        return f"{self.team}: slot {self.position + 1}"


class TeamMemberMove(models.Model):
    """One ordered, distinct move on a member."""

    member = models.ForeignKey(TeamMember, on_delete=models.CASCADE, related_name="moves")
    position = models.PositiveSmallIntegerField()
    move_profile = models.ForeignKey(MoveProfile, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("member", "position"), name="teams_unique_move_position"
            ),
            models.UniqueConstraint(
                fields=("member", "move_profile"), name="teams_unique_member_move"
            ),
            models.CheckConstraint(
                condition=Q(position__gte=0) & Q(position__lte=3),
                name="teams_move_position_range",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.member}: move {self.position + 1}"

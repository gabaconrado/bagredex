"""Validated request policy and template context for site-wide regulations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

from django.http import HttpRequest

from .pokemon_data.models import DataVersion, Regulation

REGULATION_IDS = ("m-c", "m-b", "m-a")
DEFAULT_REGULATION_ID = REGULATION_IDS[0]


class RegulationChoice(TypedDict):
    """One server-rendered regulation navigation option."""

    id: str
    label: str
    url: str


class PreservedQueryValue(TypedDict):
    """One non-regulation query value rendered as a hidden successful control."""

    name: str
    value: str


class RegulationSelectorContext(TypedDict):
    """Template contract for the authenticated global-header selector."""

    selected_id: str
    choices: list[RegulationChoice]
    preserved_query: list[PreservedQueryValue]


class InvalidRegulationRequest(ValueError):
    """The request did not contain exactly zero or one supported regulation."""


@dataclass(frozen=True)
class RegulationRequest:
    """One validated URL-scoped regulation selection."""

    canonical_id: str


def resolve_regulation_request(request: HttpRequest) -> RegulationRequest:
    """Resolve one query value, defaulting omission to the latest regulation."""
    values = request.GET.getlist("regulation")
    if len(values) > 1 or (values and values[0] not in REGULATION_IDS):
        raise InvalidRegulationRequest
    return RegulationRequest(values[0] if values else DEFAULT_REGULATION_ID)


def regulation_selector_context(
    request: HttpRequest,
    version: DataVersion,
    selected: Regulation,
) -> RegulationSelectorContext:
    """Build ordered same-page choices from the active version only."""
    available_ids = set(
        Regulation.objects.filter(
            version=version,
            canonical_id__in=REGULATION_IDS,
        ).values_list("canonical_id", flat=True)
    )
    choices: list[RegulationChoice] = []
    for canonical_id in REGULATION_IDS:
        if canonical_id not in available_ids:
            continue
        query = request.GET.copy()
        query.setlist("regulation", [canonical_id])
        choices.append(
            {
                "id": canonical_id,
                "label": f"Regulation {canonical_id.upper()}",
                "url": f"{request.path}?{query.urlencode()}",
            }
        )
    preserved_query: list[PreservedQueryValue] = [
        {"name": name, "value": value}
        for name, values in request.GET.lists()
        if name != "regulation"
        for value in values
    ]
    return {
        "selected_id": selected.canonical_id,
        "choices": choices,
        "preserved_query": preserved_query,
    }

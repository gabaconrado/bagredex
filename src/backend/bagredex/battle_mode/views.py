"""Authenticated HTML boundary for Battle Mode."""

from __future__ import annotations

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET

from bagredex.damage_calculator.datasets import calculator_supported
from bagredex.pokedex import active_version, snapshot_for
from bagredex.regulations import (
    InvalidRegulationRequest,
    regulation_selector_context,
    resolve_regulation_request,
)

from .bootstrap import battle_mode_bootstrap


@require_GET
def battle_mode_page(request: HttpRequest) -> HttpResponse:
    """Render an exact active-regulation Battle Mode bootstrap."""
    try:
        regulation_request = resolve_regulation_request(request)
    except InvalidRegulationRequest:
        return HttpResponse("Invalid regulation.", status=400, content_type="text/plain")
    version = active_version()
    if version is None:
        return render(
            request,
            "battle_mode.html",
            {"battle_mode_unavailable": "No Pokémon data version is active."},
            status=503,
        )
    snapshot = snapshot_for(version, regulation_request.canonical_id)
    if snapshot is None or not calculator_supported(snapshot):
        return render(
            request,
            "battle_mode.html",
            {"battle_mode_unavailable": ("The requested regulation does not support Battle Mode.")},
            status=503,
        )
    return render(
        request,
        "battle_mode.html",
        {
            "battle_mode_bootstrap": battle_mode_bootstrap(request.user, snapshot),
            "regulation_selector": regulation_selector_context(
                request, version, snapshot.regulation
            ),
        },
    )

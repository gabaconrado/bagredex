"""Authenticated HTML and JSON boundaries for the Damage Calculator."""

from __future__ import annotations

import re

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.http import parse_etags
from django.views.decorators.http import require_GET

from bagredex.pokedex import active_version, response_etag, snapshot_for
from bagredex.regulations import (
    REGULATION_IDS,
    InvalidRegulationRequest,
    canonical_regulation_url,
    regulation_page_url,
    regulation_selector_context,
    resolve_regulation_request,
)

from .datasets import (
    DATA_SCHEMA,
    DamageCalculatorUnavailable,
    calculator_supported,
    damage_calculator_dataset,
)

BOOTSTRAP_SCHEMA = "damage-calculator-bootstrap-v1"
_CANONICAL_ID = re.compile(r"^[a-z0-9-]+$")


def _error(code: str, message: str, status: int, **extra: str) -> JsonResponse:
    return JsonResponse(
        {
            "schema_version": DATA_SCHEMA,
            "error": {"code": code, "message": message, **extra},
        },
        status=status,
    )


@require_GET
def damage_calculator_page(request: HttpRequest) -> HttpResponse:
    """Render the active-regulation calculator bootstrap."""
    try:
        regulation_request = resolve_regulation_request(request)
    except InvalidRegulationRequest:
        return HttpResponse("Invalid regulation.", status=400, content_type="text/plain")
    version = active_version()
    if version is None:
        return render(
            request,
            "damage_calculator.html",
            {"damage_calculator_unavailable": "No Pokémon data version is active."},
            status=503,
        )
    snapshot = snapshot_for(version, regulation_request.canonical_id)
    if snapshot is None or not calculator_supported(snapshot):
        if regulation_request.explicit:
            return HttpResponse("Invalid regulation.", status=400, content_type="text/plain")
        return render(
            request,
            "damage_calculator.html",
            {
                "damage_calculator_unavailable": (
                    "The requested regulation does not support damage calculation."
                )
            },
            status=503,
        )
    canonical_url = canonical_regulation_url(request, regulation_request)
    if canonical_url is not None:
        return redirect(canonical_url)
    bootstrap = {
        "schema_version": BOOTSTRAP_SCHEMA,
        "active_version": version.pk,
        "regulation": {
            "id": snapshot.regulation.canonical_id,
            "name": snapshot.regulation.name,
        },
        "dataset_url": reverse(
            "damage-calculator-data",
            kwargs={
                "version": version.pk,
                "regulation": snapshot.regulation.canonical_id,
            },
        ),
    }
    return render(
        request,
        "damage_calculator.html",
        {
            "damage_calculator_bootstrap": bootstrap,
            "regulation_selector": regulation_selector_context(
                request, version, snapshot.regulation
            ),
        },
    )


@require_GET
def damage_calculator_data(request: HttpRequest, version: str, regulation: str) -> HttpResponse:
    """Serve the exact active normalized calculator dataset."""
    if (
        request.GET
        or not _CANONICAL_ID.fullmatch(version)
        or not _CANONICAL_ID.fullmatch(regulation)
        or regulation not in REGULATION_IDS
    ):
        return _error("invalid-request", "The calculator dataset request is invalid.", 400)
    current = active_version()
    if current is None:
        return _error("data-unavailable", "No Pokémon data version is active.", 503)
    if current.pk != version:
        return _error(
            "data-version-changed",
            "The active Pokémon data changed. Reload the Damage Calculator.",
            409,
            active_version=current.pk,
            reload_url=regulation_page_url(reverse("damage-calculator-page"), regulation),
        )
    snapshot = snapshot_for(current, regulation)
    if snapshot is None:
        return _error("regulation-unavailable", "The requested regulation is unavailable.", 404)
    etag = response_etag(version, regulation, DATA_SCHEMA)
    supplied_etags = parse_etags(request.headers.get("If-None-Match", ""))
    if "*" in supplied_etags or etag in supplied_etags:
        response = HttpResponse(status=304)
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = "private, max-age=3600"
        return response
    try:
        payload = damage_calculator_dataset(snapshot)
    except DamageCalculatorUnavailable as error:
        return _error("data-unavailable", str(error), 503)
    response = JsonResponse(payload)
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, max-age=3600"
    return response

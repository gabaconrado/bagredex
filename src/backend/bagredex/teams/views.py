"""Authenticated HTML and JSON boundaries for private teams."""

from __future__ import annotations

import json
from typing import Any, cast
from uuid import UUID

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.http import parse_etags

from bagredex.pokedex import active_version, response_etag, snapshot_for
from bagredex.pokemon_data.models import DataVersion, Regulation
from bagredex.regulations import (
    InvalidRegulationRequest,
    canonical_regulation_url,
    regulation_selector_context,
    resolve_regulation_request,
)

from .datasets import builder_dataset
from .models import Team
from .services import (
    API_SCHEMA,
    BOOTSTRAP_SCHEMA,
    DATA_SCHEMA,
    TeamValidationError,
    create_team,
    mechanics_supported,
    replace_team,
    serialize_team,
    summary,
    team_queryset,
)

MAX_JSON_BYTES = 65_536


def _error(
    code: str,
    message: str,
    status: int,
    fields: dict[str, list[str]] | None = None,
) -> JsonResponse:
    return JsonResponse(
        {
            "schema_version": API_SCHEMA,
            "error": {"code": code, "message": message, "fields": fields or {}},
        },
        status=status,
    )


def _success(data: dict[str, Any], status: int = 200) -> JsonResponse:
    return JsonResponse({"schema_version": API_SCHEMA, "data": data}, status=status)


def _aggregate_response(team: Team, status: int = 200) -> JsonResponse:
    try:
        data = serialize_team(team)
    except ValueError:
        return _error(
            "data-unavailable",
            "The team's pinned Pokémon data is unavailable or unsupported.",
            503,
        )
    return _success(data, status)


def _payload(request: HttpRequest) -> object:
    if request.content_type != "application/json":
        raise TeamValidationError(
            {"": ["Use the application/json content type."]}, "invalid-request"
        )
    content_length = request.META.get("CONTENT_LENGTH", "")
    try:
        declared_length = int(content_length) if content_length else 0
    except ValueError as error:
        raise TeamValidationError(
            {"": ["Enter a valid content length."]}, "invalid-request"
        ) from error
    if declared_length > MAX_JSON_BYTES:
        raise TeamValidationError({"": ["The team payload is too large."]}, "payload-too-large")
    if len(request.body) > MAX_JSON_BYTES:
        raise TeamValidationError({"": ["The team payload is too large."]}, "payload-too-large")
    try:
        return json.loads(request.body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise TeamValidationError({"": ["Enter valid JSON."]}, "invalid-json") from error


def _validation_response(error: TeamValidationError) -> JsonResponse:
    status = (
        413
        if error.code == "payload-too-large"
        else 503
        if error.code == "data-unavailable"
        else 400
    )
    return _error(error.code, str(error), status, error.fields)


def _owned_team(request: HttpRequest, team_id: UUID) -> Team | None:
    return cast(Team | None, team_queryset().filter(pk=team_id, owner=request.user).first())


def teams_page(request: HttpRequest) -> HttpResponse:
    """Render the active-regulation team list and builder bootstrap."""
    if request.method == "POST":
        return teams_create(request)
    if request.method != "GET":
        return _error("method-not-allowed", "This endpoint requires GET.", 405)
    try:
        regulation_request = resolve_regulation_request(request)
    except InvalidRegulationRequest:
        return HttpResponse("Invalid regulation.", status=400, content_type="text/plain")
    version = active_version()
    if version is None:
        return render(
            request,
            "team_builder.html",
            {"team_builder_unavailable": "No Pokémon data version is active."},
            status=503,
        )
    snapshot = snapshot_for(version, regulation_request.canonical_id)
    if snapshot is None or not mechanics_supported(snapshot.regulation):
        if regulation_request.explicit:
            return HttpResponse("Invalid regulation.", status=400, content_type="text/plain")
        return render(
            request,
            "team_builder.html",
            {"team_builder_unavailable": "The requested regulation is unavailable."},
            status=503,
        )
    canonical_url = canonical_regulation_url(request, regulation_request)
    if canonical_url is not None:
        return redirect(canonical_url)
    teams = list(
        team_queryset()
        .filter(
            owner=request.user,
            regulation_id__in=Regulation.objects.filter(
                canonical_id=snapshot.regulation.canonical_id
            ).values("pk"),
        )
        .order_by("-updated_at")
    )
    bootstrap = {
        "schema_version": BOOTSTRAP_SCHEMA,
        "active_version": version.pk,
        "next_team_number": Team.objects.filter(owner=cast(Any, request.user)).count() + 1,
        "regulation": {
            "id": snapshot.regulation.canonical_id,
            "name": snapshot.regulation.name,
        },
        "teams": [summary(team) for team in teams],
        "create_url": reverse("teams-page"),
        "dataset_url": reverse(
            "teams-data",
            kwargs={"version": version.pk, "regulation": snapshot.regulation.canonical_id},
        ),
        "team_url_template": reverse("teams-detail", kwargs={"team_id": UUID(int=0)}).replace(
            str(UUID(int=0)), "__TEAM__"
        ),
    }
    return render(
        request,
        "team_builder.html",
        {
            "team_builder_bootstrap": bootstrap,
            "regulation_selector": regulation_selector_context(
                request, version, snapshot.regulation
            ),
        },
    )


def teams_data(request: HttpRequest, version: str, regulation: str) -> HttpResponse:
    """Serve an active or owned-team-retained exact builder dataset."""
    if request.method != "GET":
        return _error("method-not-allowed", "This endpoint requires GET.", 405)
    data_version = DataVersion.objects.filter(pk=version, status=DataVersion.Status.LOADED).first()
    if data_version is None:
        return _error("data-unavailable", "The requested data version is unavailable.", 404)
    snapshot = snapshot_for(data_version, regulation)
    if snapshot is None:
        return _error("regulation-unavailable", "The requested regulation is unavailable.", 404)
    current = active_version()
    active_pair = current is not None and current.pk == version
    owned_pair = Team.objects.filter(
        owner=cast(Any, request.user),
        regulation=snapshot.regulation,
    ).exists()
    if not active_pair and not owned_pair:
        return _error("data-unavailable", "The requested data version is unavailable.", 404)
    etag = response_etag(version, regulation, DATA_SCHEMA)
    supplied_etags = parse_etags(request.headers.get("If-None-Match", ""))
    if "*" in supplied_etags or etag in supplied_etags:
        response = HttpResponse(status=304)
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = "private, max-age=3600"
        return response
    try:
        payload = builder_dataset(snapshot)
    except ValueError:
        return _error("data-unavailable", "The requested dataset cannot build teams.", 503)
    response = JsonResponse(payload)
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, max-age=3600"
    return response


def teams_create(request: HttpRequest) -> HttpResponse:
    """Create a complete draft pinned to its stated active context."""
    if request.method != "POST":
        return _error("method-not-allowed", "This endpoint requires POST.", 405)
    try:
        payload = _payload(request)
        if not isinstance(payload, dict):
            raise TeamValidationError({"": ["Enter a JSON object."]}, "invalid-request")
        version_id = payload.get("version")
        regulation_id = payload.get("regulation")
        if not isinstance(version_id, str) or not isinstance(regulation_id, str):
            raise TeamValidationError(
                {"version": ["Enter the active version and regulation."]}, "invalid-request"
            )
        current = active_version()
        if current is None or current.pk != version_id:
            raise TeamValidationError(
                {"version": ["The active Pokémon data changed. Reload the builder."]},
                "data-version-changed",
            )
        snapshot = snapshot_for(current, regulation_id)
        if snapshot is None or not mechanics_supported(snapshot.regulation):
            raise TeamValidationError(
                {"regulation": ["The requested regulation is unavailable."]},
                "regulation-unavailable",
            )
        team = create_team(request.user, snapshot.regulation, payload)
    except TeamValidationError as error:
        return _validation_response(error)
    return _aggregate_response(team_queryset().get(pk=team.pk), 201)


def teams_detail(request: HttpRequest, team_id: UUID) -> HttpResponse:
    """Read, replace, or permanently delete one concealed owned team."""
    team = _owned_team(request, team_id)
    if team is None:
        return _error("team-not-found", "The requested team was not found.", 404)
    if request.method == "GET":
        return _aggregate_response(team)
    if request.method == "DELETE":
        team.delete()
        return HttpResponse(status=204)
    if request.method == "PUT":
        try:
            payload = _payload(request)
            if isinstance(payload, dict):
                supplied_version = payload.get("version")
                supplied_regulation = payload.get("regulation")
                if supplied_version not in (None, team.regulation.version_id):
                    raise TeamValidationError(
                        {"version": ["A saved team's data version cannot change."]}
                    )
                if supplied_regulation not in (None, team.regulation.canonical_id):
                    raise TeamValidationError(
                        {"regulation": ["A saved team's regulation cannot change."]}
                    )
            saved = replace_team(team, payload)
        except TeamValidationError as error:
            return _validation_response(error)
        return _aggregate_response(team_queryset().get(pk=saved.pk))
    return _error("method-not-allowed", "Use GET, PUT, or DELETE.", 405)

"""Server-rendered, Pokédex data, and operational endpoints."""

from pathlib import Path
from typing import cast

from django.conf import settings
from django.contrib.auth.decorators import login_not_required
from django.db import DatabaseError, connection
from django.http import FileResponse, HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.http import parse_etags
from django.views.decorators.http import require_GET

from .pokedex import (
    DETAIL_SCHEMA,
    DETAILS_SCHEMA,
    INDEX_SCHEMA,
    REGULATION_IDS,
    PokedexUnavailable,
    Snapshot,
    active_version,
    bootstrap,
    form_detail,
    regulation_details,
    regulation_index,
    response_etag,
    snapshot_for,
)
from .pokemon_data.models import DataVersion, Sprite


def _error(code: str, message: str, status: int, **extra: str) -> JsonResponse:
    return JsonResponse({"code": code, "message": message, **extra}, status=status)


def _not_modified(request: HttpRequest, etag: str) -> HttpResponse | None:
    supplied = parse_etags(request.headers.get("If-None-Match", ""))
    if "*" in supplied or etag in supplied:
        response = HttpResponse(status=304)
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = "private, no-cache"
        return response
    return None


def _json_response(request: HttpRequest, payload: dict[str, object], etag: str) -> HttpResponse:
    cached = _not_modified(request, etag)
    if cached is not None:
        return cached
    response = JsonResponse(payload)
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, no-cache"
    return response


def _expected_version(request: HttpRequest) -> str | None:
    values = request.GET.getlist("version")
    return values[0] if len(values) == 1 and values[0] else None


def _current_snapshot_response(
    request: HttpRequest, regulation: str
) -> tuple[Snapshot | None, JsonResponse | None]:
    if regulation not in REGULATION_IDS:
        return None, _error("invalid-request", "The regulation identifier is invalid.", 400)
    expected = _expected_version(request)
    if expected is None:
        return None, _error("invalid-request", "Exactly one non-empty version is required.", 400)
    version = active_version()
    if version is None:
        return None, _error("data-unavailable", "No Pokémon data version is active.", 503)
    if expected != version.pk:
        return None, _error(
            "data-version-changed",
            "The active Pokémon data changed. Reload the Pokédex.",
            409,
            active_version=version.pk,
            url=f"{reverse('home')}?regulation={regulation}",
        )
    snapshot = snapshot_for(version, regulation)
    if snapshot is None:
        return None, _error(
            "regulation-unavailable", "The requested regulation is unavailable.", 404
        )
    return snapshot, None


@require_GET
def home(request: HttpRequest) -> HttpResponse:
    """Render validated Pokédex bootstrap configuration or an unavailable state."""
    values = request.GET.getlist("regulation")
    if len(values) > 1 or (values and values[0] not in REGULATION_IDS):
        return HttpResponse("Invalid regulation.", status=400, content_type="text/plain")
    regulation_id = values[0] if values else REGULATION_IDS[0]
    version = active_version()
    if version is None:
        return render(
            request,
            "home.html",
            {"pokedex_unavailable": "No Pokémon data version is active."},
            status=503,
        )
    snapshot = snapshot_for(version, regulation_id)
    if snapshot is None:
        return render(
            request,
            "home.html",
            {"pokedex_unavailable": "The requested regulation is unavailable."},
            status=503,
        )
    return render(
        request,
        "home.html",
        {"pokedex_bootstrap": bootstrap(version, snapshot.regulation)},
    )


@require_GET
def pokedex_index(request: HttpRequest, regulation: str) -> HttpResponse:
    """Return all local-interaction data for one active regulation."""
    snapshot, error = _current_snapshot_response(request, regulation)
    if error is not None:
        return error
    assert snapshot is not None
    etag = response_etag(snapshot.version.pk, regulation, INDEX_SCHEMA)
    cached = _not_modified(request, etag)
    if cached is not None:
        return cached
    return _json_response(request, regulation_index(snapshot), etag)


@require_GET
def pokedex_details(request: HttpRequest, regulation: str) -> HttpResponse:
    """Return normalized effective details for one active regulation."""
    snapshot, error = _current_snapshot_response(request, regulation)
    if error is not None:
        return error
    assert snapshot is not None
    etag = response_etag(snapshot.version.pk, regulation, DETAILS_SCHEMA)
    cached = _not_modified(request, etag)
    if cached is not None:
        return cached
    try:
        payload = regulation_details(snapshot)
    except PokedexUnavailable as error:
        return _error("data-unavailable", str(error), 503)
    return _json_response(request, payload, etag)


@require_GET
def pokedex_form_detail(request: HttpRequest, regulation: str, form: str) -> HttpResponse:
    """Return regulation-effective detail for one exact canonical form."""
    if not form.isascii() or not form.isalnum() or form.lower() != form:
        return _error("invalid-request", "The form identifier is invalid.", 400)
    snapshot, error = _current_snapshot_response(request, regulation)
    if error is not None:
        return error
    assert snapshot is not None
    try:
        payload = form_detail(snapshot, form)
    except PokedexUnavailable as error:
        return _error("data-unavailable", str(error), 503)
    if payload is None:
        return _error("form-not-found", "The requested form is unavailable.", 404)
    etag = response_etag(snapshot.version.pk, regulation, DETAIL_SCHEMA, form)
    cached = _not_modified(request, etag)
    if cached is not None:
        return cached
    return _json_response(request, payload, etag)


@require_GET
def pokedex_sprite(request: HttpRequest, version: str, form: str, variant: str) -> HttpResponse:
    """Serve one database-declared immutable sprite from its retained release."""
    if (
        not version
        or not form.isascii()
        or not form.isalnum()
        or form.lower() != form
        or variant not in Sprite.Variant.values
    ):
        return _error("invalid-request", "The sprite request is invalid.", 400)
    sprite = (
        Sprite.objects.select_related("mapping__form", "version")
        .filter(
            version_id=version,
            version__status=DataVersion.Status.LOADED,
            mapping__version_id=version,
            mapping__form__canonical_id=form,
            mapping__form__version_id=version,
            variant=variant,
        )
        .first()
    )
    if sprite is None:
        return _error("sprite-not-found", "The requested sprite is unavailable.", 404)
    release_root = Path(settings.POKEMON_DATA_RELEASES_ROOT).resolve()
    version_root = (release_root / version).resolve()
    sprite_path = (version_root / sprite.path).resolve()
    if (
        not version_root.is_relative_to(release_root)
        or not sprite_path.is_relative_to(version_root)
        or not sprite_path.is_file()
    ):
        return _error("sprite-not-found", "The requested sprite is unavailable.", 404)
    etag = f'"{sprite.sha256}"'
    cached = _not_modified(request, etag)
    if cached is not None:
        cached.headers["Cache-Control"] = "private, max-age=31536000, immutable"
        cached.headers["X-Content-Type-Options"] = "nosniff"
        return cached
    response = FileResponse(sprite_path.open("rb"), content_type="image/webp")
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, max-age=31536000, immutable"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return cast(HttpResponse, response)


@login_not_required
@require_GET
def live(request: HttpRequest) -> JsonResponse:
    """Report process liveness without accessing a dependency."""
    return JsonResponse({"status": "ok"})


@login_not_required
@require_GET
def ready(request: HttpRequest) -> JsonResponse:
    """Report readiness only after a database round trip succeeds."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})

"""Server-rendered and operational endpoints."""

from django.contrib.auth.decorators import login_not_required
from django.db import DatabaseError, connection
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET


@require_GET
def home(request: HttpRequest) -> HttpResponse:
    """Render the authenticated application home page."""
    return render(request, "home.html")


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

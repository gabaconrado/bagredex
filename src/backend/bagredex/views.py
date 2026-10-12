"""Minimal server-rendered and operational endpoints."""

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET


@require_GET
def home(request: HttpRequest) -> HttpResponse:
    """Render the public placeholder page."""
    return render(request, "home.html")


@require_GET
def live(request: HttpRequest) -> JsonResponse:
    """Report process liveness without accessing a dependency."""
    return JsonResponse({"status": "ok"})


@require_GET
def ready(request: HttpRequest) -> JsonResponse:
    """Report readiness after Django has loaded its configuration."""
    return JsonResponse({"status": "ok"})

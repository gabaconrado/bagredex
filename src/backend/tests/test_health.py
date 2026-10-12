"""Request tests for dependency-free operational health endpoints."""

import pytest
from django.test import Client


@pytest.mark.parametrize("path", ["/health/live", "/health/ready"])
def test_health_endpoint_reports_ok(client: Client, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 200
    assert response.headers["Content-Type"] == "application/json"
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize("method", ["head", "post", "put", "patch", "delete", "options", "trace"])
@pytest.mark.parametrize("path", ["/health/live", "/health/ready"])
def test_health_endpoint_rejects_non_get_methods(client: Client, method: str, path: str) -> None:
    response = getattr(client, method)(path)

    assert response.status_code == 405
    assert response.headers["Allow"] == "GET"

"""Request tests for public operational health endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from django.db import OperationalError
from django.test import Client


def test_liveness_is_public_and_does_not_access_the_database(client: Client) -> None:
    with patch("bagredex.views.connection.cursor") as cursor:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.headers["Content-Type"] == "application/json"
    assert response.json() == {"status": "ok"}
    cursor.assert_not_called()


def test_readiness_is_public_and_queries_the_database(client: Client) -> None:
    database_cursor = MagicMock()
    cursor_context = MagicMock()
    cursor_context.__enter__.return_value = database_cursor

    with patch("bagredex.views.connection.cursor", return_value=cursor_context):
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    database_cursor.execute.assert_called_once_with("SELECT 1")
    database_cursor.fetchone.assert_called_once_with()


def test_readiness_hides_database_failure_details(client: Client) -> None:
    with patch(
        "bagredex.views.connection.cursor",
        side_effect=OperationalError("secret connection detail"),
    ):
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert b"secret connection detail" not in response.content


@pytest.mark.parametrize("method", ["head", "post", "put", "patch", "delete", "options", "trace"])
@pytest.mark.parametrize("path", ["/health/live", "/health/ready"])
def test_health_endpoint_rejects_non_get_methods(client: Client, method: str, path: str) -> None:
    response = getattr(client, method)(path)

    assert response.status_code == 405
    assert response.headers["Allow"] == "GET"

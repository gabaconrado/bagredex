"""Request tests for the public placeholder page."""

import pytest
from django.test import Client


def test_home_renders_the_placeholder(client: Client) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.templates[0].name == "home.html"
    assert b"<title>Bagredex</title>" in response.content
    assert b"<h1" in response.content
    assert b">Bagredex</h1>" in response.content
    assert b"Coming soon" in response.content


@pytest.mark.parametrize("method", ["head", "post", "put", "patch", "delete", "options", "trace"])
def test_home_rejects_non_get_methods(client: Client, method: str) -> None:
    response = getattr(client, method)("/")

    assert response.status_code == 405
    assert response.headers["Allow"] == "GET"

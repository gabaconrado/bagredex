"""Request tests for the authenticated application home page."""

import pytest
from django.test import Client

from bagredex.accounts.models import User


def test_anonymous_home_redirects_to_login_with_local_destination(client: Client) -> None:
    response = client.get("/")

    assert response.status_code == 302
    assert response.headers["Location"] == "/login/?next=/"


@pytest.mark.django_db
def test_authenticated_home_renders_for_user(client: Client) -> None:
    user = User.objects.create_user(username="misty", password="test-password")
    client.force_login(user)

    response = client.get("/")

    assert response.status_code == 503
    assert response.templates[0].name == "home.html"
    assert response.context["bagredex_version_label"] == "development"


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["head", "post", "put", "patch", "delete", "options", "trace"])
def test_authenticated_home_rejects_non_get_methods(client: Client, method: str) -> None:
    user = User.objects.create_user(username="brock", password="test-password")
    client.force_login(user)

    response = getattr(client, method)("/")

    assert response.status_code == 405
    assert response.headers["Allow"] == "GET"

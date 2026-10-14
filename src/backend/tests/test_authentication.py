"""Request tests for login, logout, and admin access boundaries."""

from collections.abc import Callable

import pytest
from django.contrib.auth import SESSION_KEY
from django.test import Client
from django.urls import reverse

from bagredex.accounts.models import User


@pytest.fixture
def user() -> User:
    return User.objects.create_user(
        username="gardenia",
        password="test-password",
        first_name="Gardenia",
    )


def test_login_page_is_public_and_uses_authentication_form(client: Client) -> None:
    response = client.get("/login/?next=/")

    assert response.status_code == 200
    assert response.templates[0].name == "registration/login.html"
    assert set(response.context["form"].fields) == {"username", "password"}
    assert response.context["next"] == "/"


@pytest.mark.django_db
def test_invalid_login_does_not_reveal_whether_username_exists(client: Client, user: User) -> None:
    submitted_usernames = (user.username, "unknown-user")
    error_messages: list[list[str]] = []

    for username in submitted_usernames:
        response = client.post(
            "/login/",
            {"username": username, "password": "incorrect-password"},
        )

        assert response.status_code == 200
        errors = list(response.context["form"].non_field_errors())
        assert errors
        assert username not in " ".join(errors)
        assert SESSION_KEY not in client.session
        error_messages.append(errors)

    assert error_messages[0] == error_messages[1]


@pytest.mark.django_db
def test_valid_login_creates_a_persistent_session(client: Client, user: User) -> None:
    response = client.post(
        "/login/",
        {"username": user.username, "password": "test-password"},
    )

    assert response.status_code == 302
    assert response.headers["Location"] == "/"
    assert client.session[SESSION_KEY] == str(user.pk)
    assert client.session.get_expire_at_browser_close() is False
    assert 1_209_590 < client.session.get_expiry_age() <= 1_209_600


@pytest.mark.django_db
def test_authenticated_login_redirects_home(client: Client, user: User) -> None:
    client.force_login(user)

    response = client.get("/login/")

    assert response.status_code == 302
    assert response.headers["Location"] == "/"


@pytest.mark.django_db
@pytest.mark.parametrize("destination", ["/admin/", "/?section=teams"])
def test_login_accepts_safe_local_destination(client: Client, user: User, destination: str) -> None:
    response = client.post(
        "/login/",
        {"username": user.username, "password": "test-password", "next": destination},
        secure=True,
    )

    assert response.status_code == 302
    assert response.headers["Location"] == destination


@pytest.mark.django_db
@pytest.mark.parametrize(
    "destination",
    [
        "https://attacker.example/path",
        "//attacker.example/path",
        "http://testserver/path",
        "https:///malformed",
        "\\\\attacker.example/path",
    ],
)
def test_login_rejects_unsafe_destination(client: Client, user: User, destination: str) -> None:
    response = client.post(
        "/login/",
        {"username": user.username, "password": "test-password", "next": destination},
        secure=True,
    )

    assert response.status_code == 302
    assert response.headers["Location"] == "/"


@pytest.mark.django_db
def test_logout_requires_csrf_and_post(user: User) -> None:
    client = Client(enforce_csrf_checks=True)
    client.force_login(user)

    response = client.post("/logout/")

    assert response.status_code == 403
    assert SESSION_KEY in client.session


@pytest.mark.django_db
def test_post_logout_clears_session_and_redirects_to_login(user: User) -> None:
    client = Client(enforce_csrf_checks=True)
    client.force_login(user)
    page = client.get("/")
    csrf_token = page.cookies["csrftoken"].value

    response = client.post("/logout/", HTTP_X_CSRFTOKEN=csrf_token)

    assert response.status_code == 302
    assert response.headers["Location"] == "/login/"
    assert SESSION_KEY not in client.session
    assert client.get("/").headers["Location"] == "/login/?next=/"


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["get", "head", "put", "patch", "delete", "trace"])
def test_unsupported_logout_method_does_not_end_session(
    client: Client, user: User, method: str
) -> None:
    client.force_login(user)

    response = getattr(client, method)("/logout/")

    assert response.status_code == 405
    assert SESSION_KEY in client.session


@pytest.mark.django_db
def test_logout_options_does_not_end_session(client: Client, user: User) -> None:
    client.force_login(user)

    response = client.options("/logout/")

    assert response.status_code == 200
    assert SESSION_KEY in client.session


@pytest.mark.parametrize("route", ["/signup/", "/password-reset/", "/accounts/password_reset/"])
def test_unconfigured_account_routes_are_absent(client: Client, route: str) -> None:
    response = client.get(route)

    assert response.status_code == 404


@pytest.mark.django_db
def test_admin_uses_its_own_login_destination(client: Client) -> None:
    response = client.get(reverse("admin:index"))

    assert response.status_code == 302
    assert response.headers["Location"] == "/admin/login/?next=/admin/"


def test_admin_login_page_is_public(client: Client) -> None:
    response = client.get(reverse("admin:login"))

    assert response.status_code == 200
    assert response.templates[0].name == "admin/login.html"


@pytest.mark.django_db
def test_active_staff_user_can_authenticate_through_admin_login(client: Client) -> None:
    staff_user = User.objects.create_user(
        username="admin-staff",
        password="test-password",
        is_staff=True,
    )

    response = client.post(
        reverse("admin:login"),
        {
            "username": staff_user.username,
            "password": "test-password",
            "next": reverse("admin:index"),
        },
    )

    assert response.status_code == 302
    assert response.headers["Location"] == reverse("admin:index")
    assert client.session[SESSION_KEY] == str(staff_user.pk)
    assert client.get(reverse("admin:index")).status_code == 200


@pytest.mark.django_db
def test_active_staff_user_can_access_admin(client: Client) -> None:
    staff_user = User.objects.create_user(username="staff", password="test", is_staff=True)
    client.force_login(staff_user)

    response = client.get(reverse("admin:index"))

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize(
    "user_factory",
    [
        lambda: User.objects.create_user(username="member", password="test"),
        lambda: User.objects.create_user(
            username="inactive", password="test", is_staff=True, is_active=False
        ),
    ],
)
def test_user_without_active_staff_status_cannot_access_admin(
    client: Client, user_factory: Callable[[], User]
) -> None:
    denied_user = user_factory()
    client.force_login(denied_user)

    response = client.get(reverse("admin:index"))

    assert response.status_code == 302
    assert response.headers["Location"] == "/admin/login/?next=/admin/"


@pytest.mark.django_db
def test_superuser_has_standard_permissions_and_user_admin(client: Client) -> None:
    superuser = User.objects.create_superuser(
        username="champion", password="test-password", email="champion@example.test"
    )
    client.force_login(superuser)

    assert superuser.has_perm("accounts.change_user")
    response = client.get(reverse("admin:accounts_user_changelist"))
    assert response.status_code == 200

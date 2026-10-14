"""Tests for the project-owned authentication model and admin registration."""

import pytest
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from bagredex.accounts.models import User


def test_user_retains_only_abstract_user_fields() -> None:
    concrete_fields = {field.name for field in User._meta.local_fields}
    many_to_many_fields = {field.name for field in User._meta.local_many_to_many}

    assert concrete_fields == {
        "id",
        "password",
        "last_login",
        "is_superuser",
        "username",
        "first_name",
        "last_name",
        "email",
        "is_staff",
        "is_active",
        "date_joined",
    }
    assert many_to_many_fields == {"groups", "user_permissions"}
    assert User._meta.label == "accounts.User"
    assert User.USERNAME_FIELD == "username"


@pytest.mark.django_db
def test_user_manager_creates_a_user_with_a_hashed_password() -> None:
    user = User.objects.create_user(
        username="cynthia",
        password="test-password",
        first_name="Cynthia",
        last_name="Shirona",
        email="cynthia@example.test",
    )

    assert user.username == "cynthia"
    assert user.first_name == "Cynthia"
    assert user.last_name == "Shirona"
    assert user.email == "cynthia@example.test"
    assert user.check_password("test-password")
    assert user.password != "test-password"


def test_custom_user_uses_standard_user_admin() -> None:
    assert isinstance(admin.site._registry[User], UserAdmin)


def test_admin_branding_identifies_bagredex() -> None:
    assert admin.site.site_header == "Bagredex administration"
    assert admin.site.site_title == "Bagredex administration"
    assert admin.site.index_title == "Administration"

"""Tests for the narrow global Bagredex template context."""

from django.contrib.auth.models import AnonymousUser
from django.template import engines
from django.test import RequestFactory, override_settings

from bagredex.context_processors import bagredex_metadata


def test_metadata_context_contains_only_the_configured_version_label() -> None:
    request = RequestFactory().get("/")

    with override_settings(BAGREDEX_VERSION_LABEL="development"):
        assert bagredex_metadata(request) == {"bagredex_version_label": "development"}


def test_registered_version_label_context_uses_ordinary_template_escaping() -> None:
    request = RequestFactory().get("/")
    request.user = AnonymousUser()
    template = engines["django"].from_string("{{ bagredex_version_label }}")

    with override_settings(BAGREDEX_VERSION_LABEL='<version & "unsafe">'):
        rendered = template.render({}, request)

    assert rendered == "&lt;version &amp; &quot;unsafe&quot;&gt;"

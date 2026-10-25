"""Unit tests for the shared regulation URL policy."""

from django.http import QueryDict
from django.test import RequestFactory

from bagredex.regulations import (
    canonical_regulation_url,
    regulation_page_url,
    resolve_regulation_request,
)


def test_latest_regulation_is_implicit_and_preserves_repeated_query_values() -> None:
    query = QueryDict("view=grid&tag=first&tag=second&regulation=m-c")

    assert regulation_page_url("/", "m-c", query) == "/?view=grid&tag=first&tag=second"
    assert regulation_page_url("/teams/", "m-b", query) == (
        "/teams/?view=grid&tag=first&tag=second&regulation=m-b"
    )


def test_only_an_explicit_latest_selection_has_a_canonical_destination() -> None:
    factory = RequestFactory()
    implicit_request = factory.get("/damage-calculator/?tag=first&tag=second")
    implicit = resolve_regulation_request(implicit_request)
    explicit_request = factory.get("/damage-calculator/?tag=first&tag=second&regulation=m-c")
    explicit = resolve_regulation_request(explicit_request)
    historical_request = factory.get("/damage-calculator/?regulation=m-b")
    historical = resolve_regulation_request(historical_request)

    assert implicit.canonical_id == "m-c"
    assert implicit.explicit is False
    assert canonical_regulation_url(implicit_request, implicit) is None
    assert canonical_regulation_url(explicit_request, explicit) == (
        "/damage-calculator/?tag=first&tag=second"
    )
    assert canonical_regulation_url(historical_request, historical) is None

"""Shared form-family search policy for normalized Pokémon consumers."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

GROUPED_FORM_OPTIONS: dict[str, tuple[tuple[str, str], ...]] = {
    "castform": (
        ("castform", "Castform"),
        ("castformrainy", "Rainy"),
        ("castformsnowy", "Snowy"),
        ("castformsunny", "Sunny"),
    ),
    "aegislash": (("aegislash", "Shield"), ("aegislashblade", "Blade")),
    "gourgeist": (
        ("gourgeist", "Average"),
        ("gourgeistlarge", "Large"),
        ("gourgeistsmall", "Small"),
        ("gourgeistsuper", "Super"),
    ),
    "squawkabilly": (
        ("squawkabilly", "Green"),
        ("squawkabillyblue", "Blue"),
        ("squawkabillywhite", "White"),
        ("squawkabillyyellow", "Yellow"),
    ),
}
GROUPED_VARIANT_IDS = frozenset(
    form_id
    for base_id, options in GROUPED_FORM_OPTIONS.items()
    for form_id, _ in options
    if form_id != base_id
)
GROUPED_SEARCH_NAMES = {
    "castform": "Castform",
    "aegislash": "Aegislash",
    "gourgeist": "Gourgeist",
    "squawkabilly": "Squawkabilly",
}
FORM_DISPLAY_NAMES = {"meowstic": "Meowstic-Male", "meowsticf": "Meowstic-Female"}


def available_form_group(form_id: str, available_ids: set[str]) -> dict[str, Any] | None:
    """Return the available ordered options for the family containing ``form_id``."""
    base_id = next(
        (base for base, options in GROUPED_FORM_OPTIONS.items() if form_id in dict(options)), None
    )
    if base_id is None:
        return None
    options = [
        {"id": option_id, "label": label}
        for option_id, label in GROUPED_FORM_OPTIONS[base_id]
        if option_id in available_ids
    ]
    return {"label": "Form", "options": options} if options else None


def group_representatives(available_ids: set[str]) -> dict[str, str]:
    """Choose the first available canonical form in each family's stable order."""
    return {
        base_id: representative
        for base_id, options in GROUPED_FORM_OPTIONS.items()
        if (representative := next((item for item, _ in options if item in available_ids), None))
        is not None
    }


def pokemon_search_entries(forms: Iterable[tuple[str, str]]) -> list[dict[str, Any]]:
    """Serialize one search row per ordinary form or grouped family."""
    form_rows = tuple(forms)
    names = dict(form_rows)
    available_ids = set(names)
    representatives = group_representatives(available_ids)
    representative_to_base = {
        representative: base for base, representative in representatives.items()
    }
    entries: list[dict[str, Any]] = []
    for form_id, name in form_rows:
        group_base = representative_to_base.get(form_id)
        if form_id in GROUPED_VARIANT_IDS and group_base is None:
            continue
        form_group = available_form_group(form_id, available_ids)
        if form_group is not None and len(form_group["options"]) < 2:
            form_group = None
        entries.append(
            {
                "form_id": form_id,
                "name": GROUPED_SEARCH_NAMES.get(
                    group_base or form_id, FORM_DISPLAY_NAMES.get(form_id, name)
                ),
                "form_group": form_group,
            }
        )
    return entries

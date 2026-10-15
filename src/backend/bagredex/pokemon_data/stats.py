"""Exact Pokémon Champions level-50 stat arithmetic."""

from typing import Literal

Nature = Literal["hindering", "neutral", "increasing"]


def level_50_stat(*, base: int, sp: int, hp: bool, nature: Nature = "neutral") -> int:
    """Return the exact Champions stat for a base value and 0–32 stat points."""
    if base <= 0:
        raise ValueError("base must be positive")
    if not 0 <= sp <= 32:
        raise ValueError("SP must be between 0 and 32")
    if hp:
        return base + sp + 75
    percentages: dict[Nature, int] = {
        "hindering": 90,
        "neutral": 100,
        "increasing": 110,
    }
    try:
        percentage = percentages[nature]
    except KeyError as error:
        raise ValueError(f"unsupported nature: {nature}") from error
    return ((base + sp + 20) * percentage) // 100

# Basic team builder human-review report

## Outcome

The completed Team Builder now has a stable left-anchored library, direct keyboard-first team
creation, compact saved-team summaries, aligned member editing, and accessible collapsed-card
workflows. The Pokémon picker reuses shared Pokédex search and table patterns with filtering,
stat sorting, category navigation, responsive density, and reliable scrolling.

This supplemental browser-feedback cycle follows the original
[basic team builder report](2026-10-17-basic-team-builder.md) and the
[human-review refinement plan](../plans/2026-10-23-basic-team-builder-human-review.md). It does not
alter the original feature report or commit.

## Material changes

- Replaced prompt-based creation with a compact `+` action that opens an unsaved `Team #` draft
  and selects its name. Removed redundant creation copy, stabilized the library/workspace layout,
  added six-slot roster miniatures, and aligned the toolbar and responsive member form.
- Added centered loading treatment, branded discard/delete dialogs, one-shot unload coordination,
  compact SP inputs, and strict autocomplete state that survives collapsed editors and reordering.
- Added accessible 10-character inline nickname editing, collapsed saved-member summaries,
  deterministic expand/collapse focus, `1`–`6` slot navigation, Pokédex-style Shiny/Mega controls,
  Mega Ability presentation, and decorated Nature labels.
- Added shared Ability/Move information UI and the user-supplied information icon in both Pokédex
  and Team Builder, with byte-identical provenance. Item information remains deliberately deferred.
- Reworked the Pokémon picker into a vertically scrolling, keyboard-navigable stat table with
  Pokémon/type identity, HP through BST sorting, categorized Move/Ability/Type filters, responsive
  column sizing, and synchronized grid/listbox combobox semantics.
- Advanced the team bootstrap and builder dataset contracts to v2. Django now supplies the user's
  next team number, ordered pinned-version roster sprites, and regulation-effective Ability/Move
  descriptions and Move facts. Authoritative nickname writes now allow at most 10 characters while
  retaining legacy storage readability.

## Review disposition

Backend, Web, and architect integration reviews cleared all blocking findings. Review iterations
corrected collapsed-card save validation, stale Item validation, aggregate-SP focus recovery, picker
table accessibility, popup-role metadata, responsive column geometry, and their regression tests.

Two nonblocking residuals remain: Move-flag isolation across multiple moves is implemented by keyed
profile but lacks a dedicated multi-move regression, and Unicode nickname-length semantics are not
explicitly defined across clients. Neither changes the accepted feature behavior.

Authoritative held-item descriptions do not exist in the current normalized data. Their future
data/import/backend/Web work is recorded in the focused
[Item information task](../tasks/2026-10-23-item-information.md).

## Verification

- `.codex/lint.sh` passed.
- `./bagredex.sh check` passed in full: all 9 Vitest files and 126 tests, the production Web build,
  Ruff format and lint across 55 files, mypy across 55 files, Django checks, all 241 PostgreSQL
  pytest tests, shell checks, and all 64 Bats tests.
- `git diff --check` passed.
- The Playwright matrix was attempted earlier but remains unverified: Chromium is prohibited by the
  managed sandbox, and Firefox lacked the authenticated fixture credentials. No browser-matrix pass
  is claimed.

## Commit status

This report and the reviewed human-review changes are intended for the pending separate supplemental
cycle commit. The original feature commit remains unchanged.

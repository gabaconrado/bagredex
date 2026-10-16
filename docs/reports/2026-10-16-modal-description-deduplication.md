# Modal description deduplication report

## Outcome

Ability and move information modals now show exactly one descriptive paragraph using the full
`description` field. Move Target and Flags are presented as compact, wrapping, noninteractive pills:
targets are humanized for display, while flag values preserve their original text, casing, and
order.

See the [modal description deduplication plan](../plans/2026-10-16-modal-description-deduplication.md).

## Changes

- Removed modal rendering of `short_description` without changing data, API, or browser contracts.
  Unequal summaries no longer repeat their meaning; equal fields still produce one paragraph.
- Added presentation-only target formatting, including `adjacentFoe` -> `Adjacent Foe`, without
  mutating the stored identifier.
- Rendered one informational pill per flag in source order, retained exact casing, and preserved the
  visible `None` fallback for moves without flags.
- Reused the established ability-chip visual language through noninteractive span styling. Target
  and Flag labels, accessible reading order, wrapping, modal metadata, focus, and dismissal
  behavior remain intact.

## Review cycles

Web review covered unequal and equal ability descriptions, unequal and equal move descriptions,
target humanization, exact flag fidelity, empty flags, noninteractive semantics, and responsive
wrapping. Architect integration review confirmed the parser still requires and retains both
description fields, raw metadata is unchanged, and the implementation is limited to the four
planned Web files. Final review found no blocking or nonblocking findings.

## Verification

- All 95 frontend unit, component, contract, accessibility, asset, and performance tests passed.
- The offline production build, formatting, documentation lint, and diff checks passed.
- Focused dialog validation passed across all configured browser engines and layouts, covering one
  full description with no short summary, target pills, exact ordered/cased flag pills, `None`,
  wrapping, noninteractive semantics, labels, focus, close button, Escape, backdrop dismissal, and
  focus restoration.
- The full sequential Chromium and Firefox browser matrix passed all 30 tests. Existing modal
  metadata, selection, sorting, responsive geometry, light/dark presentation, and prior Pokédex
  flows remained green.
- Temporary build and browser artifacts were cleaned after validation.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

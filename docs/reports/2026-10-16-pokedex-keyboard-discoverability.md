# Pokédex keyboard discoverability report

## Outcome

The Pokédex keyboard layer is now easier to discover and use. Eligible ArrowUp/ArrowDown keys move
the selected detail pane in predictable 48-pixel steps, Shift+C confirms clearing the query and all
filters, the shortcut reminder remains visible near result counts, and exactly one suggestion shows
the Enter hint that matches current activation behavior.

Authenticated pages also show the server-owned version label beneath the Bagredex brand:
`development` locally and the existing validated `vMAJOR.MINOR.PATCH` value in production.

See the [Pokédex keyboard discoverability plan](../plans/2026-10-16-pokedex-keyboard-discoverability.md).

## Changes

- Added a narrow Django context processor that exposes only `bagredex_version_label`; changed the
  base label from `dev` to `development` and retained the production semantic-version contract.
- Rendered the escaped label inside the existing global brand link without adding it to Pokédex
  bootstrap JSON or browser state.
- Added ready/selected/overflow-gated detail arrow scrolling with strict modifier, editable,
  interactive, dialog, loading, error, and nonoverflow exclusions.
- Lifted query state to coordinate a one-dialog Shift+C confirmation. Confirm clears query and every
  filter atomically, closes suggestions, and focuses search; all cancellation routes preserve state
  and restore focus.
- Added the split-key Shift+C help entry, persistent noninteractive shortcut reminder, and a derived
  Enter hint shown only on the row Enter would select.
- Preserved selection, sort, Shiny state, existing shortcuts, filter semantics, pointer/touch
  behavior, and all backend/data interfaces outside the documented template context.

## Review cycles

Backend review covered the one-key context boundary, exact local and production labels, ordinary
template escaping, zero query behavior, and bootstrap exclusion. Web review covered shortcut
priority, dialog coexistence, atomic clear state, focus restoration, arrow boundaries, exactly-one
hint behavior, server-shell parity, themes, and responsive geometry.

Real-browser review corrected two E2E assumptions: `/` is now exercised as the physical Slash key
from a verified eligible focus target, and arrow tests establish a genuinely ready, selected,
overflowing detail pane before asserting Bagredex claims the key. Final architect integration review
found backend/template agreement, no ownership drift, and no blocking or nonblocking findings.

## Verification

- Backend static checks and the full PostgreSQL suite passed all 184 tests.
- All 101 frontend unit, component, contract, accessibility, asset, and performance tests passed;
  the offline production build, formatting, documentation lint, and diff checks also passed.
- Focused physical-Slash validation passed 4/4 tests across Chromium and Firefox layouts.
- Focused corrected arrow-gate validation passed 4/4 tests across Chromium and Firefox layouts,
  covering exact increments, page-scroll prevention, boundaries, and excluded states.
- The full sequential Chromium and Firefox matrix passed all 30 tests. Evidence covered exact
  version labels and escaping, reminder geometry, arrow eligibility, Shift+C confirm/cancel/focus,
  one-dialog behavior, moving/absent Enter hints, loading/error states, responsive light/dark
  layouts, and all prior Pokédex keyboard, modal, selection, sorting, and filtering flows.
- Temporary build and browser artifacts were cleaned after validation. No Git mutation was
  performed during review.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

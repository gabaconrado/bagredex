# Pokédex keyboard navigation report

## Outcome

The Pokédex now provides a complete browser-local keyboard layer. Different Pokémon selections
reset the detail scroller before loading or ready content paints; `/` focuses search; `?` opens an
accessible shortcut guide; and autocomplete supports individual, category, activation, and escape
navigation while retaining the combobox focus pattern. Numeric sorts now start descending, while
textual move sorts retain ascending-first behavior.

See the [Pokédex keyboard navigation plan](../plans/2026-10-16-pokedex-keyboard-navigation.md).

## Changes

- Routed row, search-result, and base/Mega selection through one immediate plus layout-timed detail-
  scroll reset. Same-form reselection remains a no-op and preserves scroll and selected state.
- Added guarded global `/` and `?` shortcuts, compact search/suggestion `<kbd>` hints, and a native
  shortcut dialog with focus containment, all close routes, and invoker restoration.
- Added Tab/Shift+Tab option traversal, Enter-first activation, Alt+Up/Alt+Down nonempty-category
  jumps, active-option scrolling, and Escape close/blur with query and filters preserved.
- Changed Pokémon stat/BST and move Power cycles to descending -> ascending -> disabled. Move Type
  and Category remain ascending -> descending -> disabled, with existing comparisons and fallbacks.
- Preserved pointer/touch activation, regulation reload behavior, browser modifier shortcuts,
  browser-local state, and all backend/data contracts.

## Review cycles

Web review covered shortcut eligibility/default prevention, sparse and empty suggestion groups,
combobox state, dialog semantics, scroll timing, sort direction, hints, themes, and responsive
geometry. Architect review found one focus edge: opening help from an information-dialog close
button initially stored an invoker that was unmounted with that dialog. The Web owner changed the
transition to retain the connected underlying move/ability invoker and added component and real-
browser coverage for the one-dialog invariant and every help close route.

Final architect review confirmed the correction, the updated E2E preconditions and locators, and a
scope limited to the seven planned `src/web` files. No blocking or nonblocking findings remain.

## Verification

- All 98 frontend unit, component, model, contract, accessibility, asset, and performance tests
  passed.
- The offline production build, formatting, documentation lint, and diff checks passed.
- Focused Chromium and Firefox keyboard validation passed all 4 tests across the exercised layouts,
  including information-dialog-to-help transitions, exactly one open dialog, and focus restoration
  through Escape, close button, and backdrop.
- The full sequential Chromium and Firefox browser matrix passed all 30 tests. Evidence covered
  `/`, `?`, modifier exclusions and default prevention, Tab/Shift+Tab, arrows, Alt category jumps,
  Enter-first, Escape blur, help and visible hints, sparse/zero suggestions, loading/error states,
  selection scroll reset through every route, same-selection preservation, and all sort cycles.
- Light/dark desktop, tablet, phone, boundary, and wide layouts retained focus visibility, hint and
  clear-control separation, active-option visibility, stable geometry, touch behavior, and prior
  Pokédex critical flows. `Ctrl+S`/`Cmd+S` remained unhandled by Bagredex.
- Temporary build and browser artifacts were cleaned after validation.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

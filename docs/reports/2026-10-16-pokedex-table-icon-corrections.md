# Pokédex table and icon corrections report

## Outcome

The Pokédex table now keeps long form names and type badges in separate stable columns, including
phone and 900 px layouts. Its sort indicators, selected-form icons, stats information control, move
categories, and whole-row selection are clearer without changing data or sorting semantics.

See the [Pokédex table and icon corrections plan](../plans/2026-10-16-pokedex-table-icon-corrections.md).

## Changes

- Corrected the overlap visible in the supplied screenshot with explicit table tracks, single-line
  name ellipsis, complete accessible and hover names, bounded dual-type badges, and stable row and
  column geometry.
- Hid inactive main and move sort arrows while retaining reserved indicator width. Active arrows,
  `aria-sort`, sort cycles, stable ties, pointer scroll origin, and keyboard focus behavior remain.
- Replaced the Mega, Shiny, Physical, Special, and Status drawings with original
  repository-authored `currentColor` SVGs based only on the supplied visual concepts. No official,
  linked, downloaded, or external asset entered the project.
- Made the visible stats information mark compact while retaining a 44 CSS-pixel target, visible
  focus, exact tooltip copy, content-sized presentation, and existing mouse, keyboard, and touch
  dismissal behavior.
- Restored visible sortable `Category` header text and changed row category values to icons with
  hidden accessible names. Plain Mega controls no longer show `M`; X, Y, and Z retain their letter.
- Made every Pokémon data row selectable from sprite, Types, or stat-cell whitespace. The name
  remains the sole native keyboard button, Enter and Space select exactly once, and header sorting
  stays independent.
- Added deliberate horizontal scrolling at the 900 px and phone layouts so stat controls remain
  contained, focusable, touch-sized, and non-overlapping instead of compressing below their usable
  width.

## Review cycles

Initial Web and integration review approved the table, icon, tooltip, Category, and Mega direction
but found that the newly confirmed whole-row requirement was absent from the plan and insufficiently
tested. The plan and implementation tests were expanded to cover semantic body-row activation,
native name-button keyboard behavior, propagation deduplication, exact selection counts, unchanged
sorting, and desktop, tablet, and phone input paths.

Real browser review then exposed narrow stat headers at the 900 px layout and phone controls that
could be clipped or difficult to reveal. The Web owner added stable minimum table tracks,
contained header wrappers, horizontal scrolling, explicit reveal checks, and retained the distinct
pointer-versus-keyboard scroll contract. Final Web and architect reviews found no blocking or
nonblocking findings.

## Verification

- All 78 frontend unit, component, selector, accessibility, and performance tests passed.
- The production JavaScript bundle is 45.51 kB raw and 15.83 kB gzip. CSS is 15.90 kB raw and
  3.67 kB gzip.
- Authoritative isolated Playwright validation passed all 26 tests across six projects, including
  Chromium 151 desktop, tablet, phone, and 900 px coverage plus Firefox 153 desktop and tablet.
- Browser checks covered the screenshot overlap regression, long-name ellipsis and titles, dual-type
  containment, all main and move sort cycles, quiet inactive arrows, one-pixel geometry tolerance,
  row identity, lazy sprite requests, and pointer and keyboard horizontal behavior.
- Browser accessibility checks covered whole-row pointer and touch targets, exactly-once Enter and
  Space selection, independent headers, visible focus, 44-pixel controls, compact tooltip behavior,
  icon-only category names, light and dark themes, reduced motion, and functional phone fallback.
- TypeScript, Prettier, the production Vite build, documentation lint, and `git diff --check`
  passed. Playwright reports, screenshots, traces, and other temporary browser artifacts were
  removed after validation.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

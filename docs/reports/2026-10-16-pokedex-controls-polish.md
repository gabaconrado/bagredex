# Pokédex controls polish report

## Outcome

The selected Pokémon pane now presents smaller, clearer sprite and form controls, an accessible
stats explanation, and locally sortable move details. The list and details layout remains stable
through first selection and every main stat-sort cycle in Firefox and Chromium, with distinct
pointer and keyboard scroll behavior.

See the [Pokédex controls polish plan](../plans/2026-10-16-pokedex-controls-polish.md).

## Changes

- Moved Shiny and Mega controls below the selected sprite. Compact icon controls retain complete
  action labels, native titles, focus, active state, and the existing base-to-Mega and Mega-to-base
  behavior.
- Replaced Shiny, Mega, and move-category drawings with original repository-authored SVGs. Mega
  controls use compact `M`, `X`, `Y`, or `Z` markers, and category rows retain visible text.
- Renamed the selected form's stats section to `Stats` and moved its exact level-50 explanation
  into a heading-adjacent tooltip available by hover, focus, click, and touch.
- Added ascending, descending, and inactive sorting for move Type, Category, and Power. Only one
  column is active, inactive restores source alphabetical order, ties remain deterministic, and
  Status moves retain an em dash in a terminal power bucket.
- Preserved geometry with reserved pane heights, root and panel scrollbar gutters, fixed table
  layout, stable sort indicators, fixed sprite placeholders, and keyed rows with native lazy
  loading.
- Restored the search field's complete focus edge above the adjoining table and suggestion panel.
  Pointer stat sorting returns to the user's settled horizontal origin, while keyboard sorting
  preserves the browser's focus-revealing viewport and visible focused header.
- Added component, selector, timing, accessibility, and browser regression coverage without a
  backend, data, dependency, lockfile, deployment, or external-asset change.

## Review cycles

The initial Web and integration reviews found incomplete evidence for the reported Firefox
flickers: ready details could change pane height, stat-sort tests omitted column and Chromium
geometry, and the search test proved only that an outline existed. The Web owner reserved the full
layout, expanded all seven stat columns through their three states, and added focus-edge geometry,
screenshots, and layout-shift evidence across the browser matrix.

A second review rejected eager preloading of every row sprite and layout-shift instrumentation that
discarded recent-input entries. The correction restored native lazy loading, stable placeholders,
keyed row identity, and per-URL repeat-request checks, then bracketed interactions while retaining
both recent-input and other layout shifts.

Real Firefox runs exposed two final differences hidden by synthetic checks: document scrollbar
appearance could move the application, and sorting after horizontal pointer movement could change
the viewport while keyboard focus needed browser-native reveal behavior. Stable root gutters and
separate pointer-versus-keyboard handling resolved both. Final Web and architect reviews found no
blocking or nonblocking findings.

## Verification

- All 76 frontend unit, selector, component, accessibility, and performance tests passed.
- The production JavaScript bundle is 44.72 kB raw and 15.58 kB gzip. CSS is 13.90 kB raw and
  3.29 kB gzip.
- Authoritative isolated Playwright runs passed all 20 tests across Chromium desktop, tablet, and
  phone plus Firefox 153 desktop and tablet projects.
- The browser runs covered empty-to-loading-to-ready selection, all 21 main stat-sort transitions,
  complete table and column geometry within one CSS pixel, bracketed layout shifts, search focus
  with suggestions closed and open, pointer scroll restoration, keyboard focus and scroll
  visibility, keyed row identity, and absence of repeat sprite requests.
- Move Type, Category, and Power sorting met the one-frame local interaction target in the focused
  frontend measurement.
- TypeScript, Prettier, the production Vite build, documentation lint, and `git diff --check`
  passed. Playwright reports, screenshots, traces, and other temporary browser artifacts were
  removed after validation.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

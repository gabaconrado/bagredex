# Pokédex interaction refinements report

## Outcome

The regulation-aware Pokédex now keeps its layout stable while loading, makes complete selected-form
details available from one background request, and presents moves and abilities through clearer,
accessible interactions. Firefox desktop and tablet behavior is covered alongside the existing
Chromium desktop, tablet, and phone flows.

See the [Pokédex interaction refinements plan](../plans/2026-10-16-pokedex-interaction-refinements.md).

## Changes

- Replaced the regulation links and upstream format heading with a labelled native selector using
  compact Bagredex labels. A change immediately reloads the selected explicit regulation URL.
- Added exact normal sprites to legal-form rows and pointer feedback to interactive Pokémon names,
  abilities, and moves while retaining native keyboard and focus behavior.
- Added one normalized, authenticated bulk-details response for the current active data version.
  The island starts it after the legal list renders, retains it only for the page lifetime, and
  performs no priority request when a Pokémon is selected.
- Kept the initial details pane empty. A selection made during background loading shows stable
  loading geometry, while failed bulk loading leaves the list usable and offers a selected-detail
  retry.
- Reworked shiny and exact base/Mega controls into aligned icon toggles. Base forms expose each
  applicable Mega choice, while a selected Mega exposes only its active return-to-base control.
- Replaced the inline information pane with an accessible move or ability dialog, and presented the
  full learnset as structured name, type, category, and power rows using native Bagredex icons.
- Reserved shell, toolbar, list, scrollbar, sprite, and details geometry across server, loading,
  ready, error, and retry states. Responsive phone behavior, light and dark themes, and reduced
  motion remain supported.
- Preserved the existing data models, imported release, sprite source, per-form compatibility
  endpoint, search and AND-filter semantics, stat sorting, authentication, and full-page state
  reset on regulation changes.

## Review cycles

Backend review approved the normalized contract, deterministic ordering, shared move and ability
metadata, complete form references, authentication, active-version handling, ETags, and bounded
queries. Web review approved the background-load state machine, local interaction behavior,
responsive presentation, dialog semantics, and accessibility after owner corrections.

Integration review returned observed Firefox layout movement, a phone column selector regression,
modal dismissal and focus issues, premature details-error presentation before selection, and icons
whose fill did not follow the active control color. The Web owner aligned server, loading, and
loaded toolbar geometry; reserved list and details dimensions; corrected the phone selector;
stabilized dialog backdrop, Escape, focus containment, and restoration behavior; kept the initial
pane empty after a background failure; and changed native icons to `currentColor` with tests.

A second review confirmed those corrections. Final Firefox-derived geometry fixes passed both
browser families, and the architect found no remaining blocking or nonblocking integration issue.

## Verification

- The focused PostgreSQL Pokédex suite passed all 21 tests in 4.90 seconds. The complete backend
  suite passed all 177 tests in 17.93 seconds.
- Against active bundle `showdown-3a766f2c-s1-i1-923ba416555c`, both M-C and M-B bulk responses
  returned HTTP 200 with 353 forms, 217 abilities, and 510 moves. Each of six runs per regulation
  used exactly 12 database queries.
- M-C measured 931,180 bytes raw and 111,511 bytes gzip. Serialization runs were 234.27, 176.69,
  159.17, 192.71, 158.40, and 184.34 milliseconds, with a 176.69 millisecond warm median.
- M-B measured 931,236 bytes raw and 111,563 bytes gzip. Serialization runs were 167.39, 175.79,
  141.99, 186.80, 147.64, and 180.60 milliseconds, with a 175.79 millisecond warm median.
- All 71 frontend tests passed. The production JavaScript bundle is 42.22 kB raw and 14.72 kB
  gzip; CSS is 11.79 kB raw and 2.89 kB gzip.
- Firefox 153 with Playwright 1.62.1 passed all eight configured tests in 17.1 seconds. Desktop and
  tablet loading-state geometry stayed within the documented one-pixel tolerance.
- Chromium desktop, tablet, and phone projects passed all 12 configured tests. The runs covered
  regulation reload, delayed detail loading, row sprites, Mega and shiny controls, structured
  moves, modal keyboard and backdrop behavior, and the functional phone fallback.
- Documentation lint, frontend type and format checks, the production Vite build, and
  `git diff --check` passed. Generated Playwright output and other temporary validation artifacts
  were removed after review.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

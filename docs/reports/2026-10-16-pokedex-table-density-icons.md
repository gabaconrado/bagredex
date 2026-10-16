# Pokédex table density and icons report

## Outcome

The Pokédex now centers all non-sprite table content and fits all ten columns without horizontal
scrolling on desktop and tablet. Phones retain deliberate horizontal scrolling with every column
available. Miniature sprites use their transparent WebP background, the Shiny stars remain white
and visible in both toggle states, and the supplied Special and Status icons replace the preceding
assets exactly.

See the [Pokédex table density and icons plan](../plans/2026-10-16-pokedex-table-density-icons.md).

## Changes

- Rebalanced the fixed table tracks and centered Pokémon names, type groups, stat headings, reserved
  arrows, and numeric values. Full and abbreviated labels retain complete accessible names and
  stable 44-pixel controls.
- Removed desktop/tablet minimum widths that forced overflow, added focused 641-pixel and 1680-pixel
  coverage, and retained a ten-column scrollable phone table rather than hiding Types.
- Removed only the painted miniature-sprite backing so existing transparent pixels reveal normal,
  hover, and selected row surfaces without changing sprite assets, URLs, loading, or geometry.
- Applied a Shiny-only white rendering treatment with distinct inactive and active Indigo backings.
  Accessible labels, pressed state, focus, touch, and base/Mega behavior remain unchanged.
- Replaced Special and Status with the user-supplied SVG bytes, updated their provenance and safety
  fingerprints, and excluded the reference `Zone.Identifier` metadata. Both remain local decorative
  move-category images with existing accessible text.

## Review cycles

Web review covered centered layout, dense-track readability, semantic row activation, breakpoint
behavior, Shiny presentation, and supplied-asset safety. The first architect integration review
approved the implementation direction but found that no-overflow evidence did not cover filtered
and selected states. The Web owner added one responsive range assertion to the AND-filter and
whole-row-selection flows, preserving positive overflow on phone.

The user then supplied a corrected Status SVG. The plan, implementation, provenance, fingerprints,
source checks, and runtime asset checks were expanded from Special to both categories. Final Web,
browser, and architect review found no blocking or nonblocking findings.

## Verification

- TypeScript and Prettier checks passed, and all 90 frontend unit, component, asset-safety,
  accessibility, selector, and performance tests passed.
- The production Vite build passed. JavaScript is 45.07 kB raw and 15.44 kB gzip; CSS is 16.80 kB
  raw and 3.89 kB gzip. Special and Status emitted as separate content-hashed SVG assets.
- Authoritative isolated Playwright validation passed all 30 tests across Chromium and Firefox,
  including desktop, tablet, 900-pixel, 641-pixel boundary, phone, and 1680-pixel wide coverage.
- Browser checks proved all ten columns and 44-pixel targets fit with no horizontal range above
  40 rem across ready, filter, selection, and sort states. Phone retained positive overflow and
  scroll access to Types and every stat.
- Rendered-box checks covered centered names, one- and two-type groups, stat values, full and short
  sort groups, hidden reserved arrows, one-pixel geometry tolerance, focus, reduced motion, and
  unchanged exactly-once whole-row selection.
- Light and dark review covered transparent row sprites and white Shiny stars in active and inactive
  states. Asset review found no broken image, console failure, external request, or metadata file.
- Special matched
  `541a9bf1efb9a94ec9a292ea33afcd95ac6c4d7b38ebddbbbd506693048a77a9`; Status matched
  `8cc0aec5fe120ab7c21034cbe84e8f18f5349dcba7453c25c1313cb57381e331`.
  Source and emitted runtime assets passed local HTTP and decode checks.
- Documentation lint and `git diff --check` passed. Temporary build and browser artifacts were
  cleaned after validation.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

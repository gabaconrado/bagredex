# Pokédex supplied icons and alignment report

## Outcome

The Pokédex stat headings are no longer clipped and remain aligned with their numeric tracks at
wide and constrained widths. Selected-form controls now stay fixed to the left edge of a stable
sprite frame, and the Mega, Shiny, Physical, Special, and Status presentation uses the five
user-created SVGs supplied for Bagredex.

See the [Pokédex supplied icons and alignment plan](../plans/2026-10-16-pokedex-supplied-icons-alignment.md).

## Changes

- Replaced overflow-prone fixed header buttons with full-track, 44-pixel controls, deliberate
  full/abbreviated labels, complete accessible names and titles, and permanently reserved inactive
  sort indicators. Rendered label, arrow, and numeric text anchors now have direct browser
  regression measurements.
- Added a stable square sprite frame and aligned the Shiny/Mega row to its left edge. Normal,
  Shiny, base, Mega, and materially different Pokémon artwork no longer change that control origin.
- Packaged the five supplied `viewBox="0 0 48 48"` files byte-for-byte as Vite inputs and replaced
  the former inline paths with decorative image assets. Category names, form-action labels,
  active states, plain/X/Y/Z markers, and keyboard/touch behavior remain intact.
- Recorded the assets as user-created and supplied on 2026-10-16, including exact SHA-256
  fingerprints and no third-party source or license claim. Source checks reject active or external
  SVG content and `Zone.Identifier` artifacts.
- Declared and documented `/static/web/dist/` as Vite's public base so emitted icon URLs use the
  existing Django static path. No package, dependency, build entry, backend, data, or deployment
  contract changed.

## Review cycles

Web review covered asset safety and mapping, accessibility, responsive header containment, stable
sprite anchoring, and preservation of the existing sort, row, Category, and Mega contracts.

The first architect integration review found that the browser test compared only shared table-cell
edges and exercised only Charizard artwork. The Web owner added explicit rendered-glyph anchors and
cross-form sprite-frame measurements. A second review approved those corrections. Final browser
review also verified the emitted static URLs, HTTP responses, SVG decoding, focus containment,
light/dark presentation, and responsive geometry. Final Web and architect review found no
remaining findings.

## Verification

- TypeScript and Prettier checks passed, and all 89 frontend unit, component, asset-safety,
  accessibility, selector, and performance tests passed.
- The production Vite build passed. JavaScript is 44.98 kB raw and 15.41 kB gzip; CSS is 16.79 kB
  raw and 3.86 kB gzip. All five SVGs were emitted as separate content-hashed assets.
- Authoritative isolated Playwright validation passed all 26 configured tests across Chromium and
  Firefox desktop, tablet, phone, and 900-pixel coverage, plus focused asset and alignment checks.
- Browser evidence covered full and abbreviated labels, glyph containment, 44-pixel targets,
  one-pixel text/geometry tolerance, all stat sort cycles, horizontal scrolling, focus, reduced
  motion, diverse sprite/form transitions, Shiny/Mega state, and unchanged whole-row selection.
- Every SVG matched its supplied SHA-256, loaded from the local `/static/web/dist/` path with a
  successful HTTP response, and decoded without a broken image or external request. Light and dark
  review retained the supplied colors without recoloring.
- Documentation lint and `git diff --check` passed.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

# Status move icon contrast report

## Outcome

Status move rows now render the existing icon with the approved deep blue-gray `#4F6F82` half and
outline while preserving its white half, geometry, title, category semantics, and 20-pixel layout.
The icon remains clearly distinguishable from light and dark move-row surfaces.

See the [Status move icon contrast plan](../plans/2026-10-16-status-icon-contrast.md).

## Changes

- Replaced only the packaged Status SVG's two `#B7D9EB` declarations with `#4F6F82`.
- Retained the user-supplied reference unchanged and recorded the derivative SHA-256
  `ae7641f6491569187a35ea6b805772a90439caa1a0530ee71e0a7d022d4bd359` in provenance and asset
  safety tests.
- Added real move-row coverage for the emitted asset URL, decorative semantics, exact rendered
  size, image loading, both-theme contrast, and screenshots.
- Corrected the browser assertion for Firefox's valid empty-string serialization of a present
  decorative `aria-hidden` attribute while continuing to accept `"true"`. Application behavior was
  not changed.

## Review cycles

Web and architect review confirmed that the reference asset, white half, paths, dimensions, title,
mapping, and table layout are unchanged. The packaged derivative contains the approved fill and
stroke only, and its provenance, source tests, production bytes, and emitted URL agree. Final review
found no blocking or nonblocking findings.

## Verification

- All 91 frontend unit, component, accessibility, asset-safety, and performance tests passed.
- The offline production build, formatting, lint, and diff checks passed.
- The supplied reference retained SHA-256
  `8cc0aec5fe120ab7c21034cbe84e8f18f5349dcba7453c25c1313cb57381e331`; the packaged and emitted
  derivative matched `ae7641f6491569187a35ea6b805772a90439caa1a0530ee71e0a7d022d4bd359`.
- The production content-hashed URL returned HTTP 200 with exact bytes and decoded successfully.
- Sequential Chromium and Firefox validation passed all 30 browser tests across the configured
  desktop, tablet, phone, 900-pixel, 641-pixel, and wide viewports.
- Light and dark checks measured the icon at 20 by 20 CSS pixels. Deep-blue-gray-to-row contrast was
  at least 3:1, and white-to-deep-blue-gray contrast was 5.3455:1. Existing move sorting, modal,
  focus, responsive geometry, and prior Pokédex flows remained green.
- Temporary build and browser artifacts were cleaned after validation.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

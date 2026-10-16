# Version label layout report

## Outcome

The global version label now renders on an explicit second line directly beneath Bagredex. Both
lines share a left edge and compact gap inside one brand link, while the version is smaller, lower
weight, and more muted without sacrificing readable light/dark contrast.

See the [version label layout plan](../plans/2026-10-16-version-label-layout.md).

## Changes

- Replaced the brand's implicit grid with an authored `inline-flex` column aligned to the start and
  added explicit child classes and line heights.
- Reduced the version label to a 0.7rem, weight-500 muted treatment while retaining the existing
  escaped `bagredex_version_label` text and single home-link hit target.
- Added bounded long-identity wrapping so the account area remains contained beside the two-line
  brand across supported widths.
- Added rendered browser assertions for authored/computed layout, gap, shared edge, containment,
  contrast, focus outline, link semantics, long identity, responsive header geometry, and server-
  shell-to-loaded stability.

## Review cycles

Web review covered explicit rather than incidental line placement, subordinate visual hierarchy,
actual composited contrast, single-link semantics, keyboard focus enclosure, header/account
alignment, long identity containment, and responsive behavior. Final architect review confirmed the
change is limited to the three planned Web files and leaves the backend context/value contract
untouched. No blocking or nonblocking findings remain.

## Verification

- All 101 frontend unit, component, contract, accessibility, asset, and performance tests passed.
- The offline production build, formatting, documentation lint, and diff checks passed.
- Focused brand validation passed all 5 tests across the configured Chromium and Firefox layouts.
- The full sequential Chromium and Firefox matrix passed all 30 tests, covering desktop, tablet,
  phone, light/dark presentation, server shell, focus, long identity, responsive containment, and
  prior Pokédex flows.
- Browser evidence confirmed explicit authored `inline-flex`, computed column/start alignment, a
  positive 1-4 pixel gap, left edges within one pixel, contained text/focus boxes, distinct smaller
  and lower-weight label styling, and at least 4.5:1 rendered contrast in both themes.
- One warm-sort check produced a transient initial idle result; its immediate isolated rerun passed,
  and the authoritative full matrix completed green without a source correction.
- Temporary build and browser artifacts were cleaned after validation.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

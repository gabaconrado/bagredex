# Damage calculator layout refinement report

## Outcome

The Damage Calculator now leads with its working controls in a centered, top-aligned layout. Its
primary navigation identifies the current section, and every Field Effects choice is a full-cell,
accessible toggle with a visible selected background.

The implementation follows the
[damage calculator layout refinement plan](../plans/2026-10-24-damage-calculator-layout-refinement.md).

## Changes

- Removed the ready-state format/regulation line, large calculator heading, and browser-tab
  explanation while retaining identifiable loading, unavailable, and error states.
- Added one semantic `aria-current="page"` primary-navigation link for Pokédex, Team Builder, and
  Damage Calculator route families, with persistent selected styling.
- Centered the calculator, Field Effects, and paired Pokémon panels in the available page width and
  top-aligned the content below the site header. Existing desktop pairing and phone stacking remain.
- Replaced weather and terrain selects with pressed-button cells. Each group remains mutually
  exclusive, and activating its selected cell clears the group to none.
- Replaced directional checkboxes with independent Left and Right pressed-button cells. Native
  buttons make the entire cell operable by pointer, touch, Enter, or Space and expose state through
  `aria-pressed` as well as color.
- Kept the existing `FieldState`, calculation engine, summary, and reset paths unchanged. The
  active Damage Calculator human-review marker remained operational state outside the source diff.

## Review cycles

The first Web GUI review found one blocker: tests proved visual toggling and pressed state but did
not prove that the new UI controls reached the damage engine. The Web owner added a deterministic
Arcanine-versus-Charizard browser case showing that Sun, Electric Terrain, and Helping Hand each
change damage and that toggling each off restores the exact baseline. The owner also strengthened
the browser assertions for exactly one current navigation link and a materially different selected
cell background.

Web GUI re-review found no remaining actionable issue. Final architect review confirmed the diff is
limited to the approved Web paths and artifacts, does not change backend, Pokémon data, deployment,
or formula contracts, and preserves Team Builder beyond the shared selected-page indicator. The
user's separate screenshot change and existing commit `0a80b2e` remain outside this cycle.

## Verification

- `npm run check` passed before review and after the reviewer correction.
- Focused Vitest passed all 7 Damage Calculator component tests before review and after correction.
- The complete Web Vitest suite passed 177 tests with 21 intentionally skipped before review and
  after correction.
- The production Vite build passed before review and after correction.
- With user-authorized local browser elevation, focused Chromium passed all 17 Damage Calculator
  tests.
- The complete configured Damage Calculator Playwright matrix passed all 85 tests across Chromium
  and Firefox desktop, tablet, phone, boundary, light-theme, and dark-theme projects.
- `.codex/lint.sh` and `git diff --check` passed before review and after correction.
- Final architect inspection found no backend, data, or deployment drift and no unresolved blocking
  finding.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit. Existing user commit `0a80b2e` is preserved
unchanged.

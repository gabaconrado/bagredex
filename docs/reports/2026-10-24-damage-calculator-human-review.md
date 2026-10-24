# Damage calculator human-review report

## Outcome

The Damage Calculator now keeps its complete two-panel workspace stable from the empty state
through populated and Mega-preview states. Set controls are denser and aligned, staged stats and HP
changes communicate their effective values correctly, keyboard navigation is faster, and Field
Effects remains reachable as a bounded bottom-sticky bar without creating blank page space.

This supplemental browser-feedback cycle follows the original
[layout refinement plan](../plans/2026-10-24-damage-calculator-layout-refinement.md),
[layout refinement report](2026-10-24-damage-calculator-layout-refinement.md), and base commit
`4b57ca9`. Its 11 accepted rounds are recorded in the
[supplemental human-review plan](../plans/2026-10-24-damage-calculator-human-review.md). The original
artifacts and commit remain unchanged.

## Changes

- Grouped the collapsed Field Effects summary by Field, Left, and Right; humanized effect names;
  and qualified terrain names while retaining the existing mechanics and toggle labels.
- Stabilized the full-width paired-panel layout, removed redundant visible side headings, and
  reorganized Nature, Current HP, Status, SP, and stage controls into compact accessible grids that
  remain aligned in Firefox and responsive layouts.
- Put the live HP percentage inside its number control. HP SP changes now preserve the prior ratio
  with integer-floor scaling, while direct HP edits, resets, other SP changes, and form transitions
  retain their distinct existing semantics.
- Displayed effective staged stats with the engine's existing exact stage helper while keeping
  unstaged stats and stages separate for calculation, preventing double application.
- Reused the shared Mega icon in a stable slot beside an enlarged sprite. Mega preview now displays
  its exact locked Ability without overwriting or broadening the stored base Ability selection.
- Added guarded `1` and `2` shortcuts for the Left and Right Pokémon comboboxes and one-press Escape
  behavior that reconciles a focused calculator control before releasing focus.
- Moved Field Effects after the matchup and made it a calculator-width bottom-sticky card with a
  viewport-bounded internal scroller. The final max-scroll correction removed duplicate matchup
  padding and expanded-height reservation, leaving the card's normal-flow height and ordinary gap
  as the page separation.

## Review cycles

Web GUI review iterations tightened HP ratio edge semantics, Escape behavior and coverage, browser
coverage, and the staged-damage regression. The final regression independently derives the exact
positive- and negative-stage damage rolls from the unstaged stat, so a double-applied stage fails
rather than being masked by reuse of the production helper. Runtime Playwright selectors were then
corrected to match the final accessible interface.

Final Web GUI re-review found no actionable findings. Architect integration review confirmed the
11-round implementation remains within the approved Web boundary, preserves normalized data,
backend, deployment, and damage-engine contracts, and satisfies the HP, stage, Mega Ability,
shortcut, sticky-layout, accessibility, and responsive requirements.

The two user-owned screenshots remained evidence only. Agents did not edit them, and they are
excluded from this supplemental commit.

## Verification

- `npm run check` passed.
- Focused Damage Calculator Vitest passed all 14 tests.
- The complete Vitest suite passed 184 tests across 14 files, with 21 intentionally skipped.
- The production build passed and emitted the bundles after transforming 31 modules.
- The damage audit ran against the active release path and passed all 205 evidence entries with
  every reported failure array empty.
- After correcting final test selectors, the elevated Damage Calculator Playwright matrix passed
  all 110 tests across the eligible configured Chromium and Firefox desktop, tablet, phone, theme,
  and reduced-motion projects.
- `.codex/lint.sh` and `git diff --check` passed.
- The supported human-review teardown succeeded. The temporary ordinary runtime used for final
  validation was stopped, while its database volume was preserved.
- Final Web GUI and architect reviews found no unresolved actionable issue.

## Deferred tasks

None.

## Commits

This report is included in the pending separate human-review follow-up commit. The original base
commit `4b57ca9` and its plan and report remain unchanged.

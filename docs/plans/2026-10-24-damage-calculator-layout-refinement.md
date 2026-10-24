# Damage calculator layout refinement

## Summary

Refine the Damage Calculator after browser review so the working controls, rather than repeated
introductory copy, lead the page. Center the calculator content, identify the current primary page,
and replace Field Effects selects and checkbox rows with accessible, full-cell toggle controls.

This is an ordinary feature cycle opened from human-review feedback. The user confirmed that the
review target is Damage Calculator, and the supported lifecycle now records that target. Source
implementation must not rewrite, finish, or retarget the marker silently. Scope remains the Damage
Calculator plus the shared primary navigation selected-page indicator.

## Goals

- Remove redundant calculator format, regulation, title, and browser-state introduction copy from
  the ready page.
- Give Pokédex, Team Builder, and Damage Calculator links a clear visual and semantic selected-page
  state without changing their destinations or regulation query propagation.
- Keep Field Effects and both Pokémon panels in one centered content column instead of the observed
  left- and lower-biased layout.
- Present weather, terrain, and directional field effects as touch-friendly cells whose complete
  surface activates them and whose selected state has a visible background.
- Preserve immediate local recalculation, keyboard access, responsive behavior, light and dark
  themes, and existing calculator mechanics.

## Non-goals

- Changing damage formulae, field-effect meanings, contextual inputs, reset behavior, regulation
  legality, data contracts, Django views, URLs, authentication, or persistence.
- Adding a saved calculator, URL state, a new client state library, a component library, or a new
  dependency.
- Removing the page title from the document `<title>`, or removing useful headings from loading,
  unavailable, and error states where they identify the state.
- Redesigning Team Builder or Pokédex content. Their only visible change is the shared primary-nav
  current-page indicator.
- Retargeting or finishing the active Damage Calculator human-review session through source work.

## User-visible behavior

### Page shell and layout

- The ready calculator no longer displays `Level 50 · VGC doubles · …`, the large `Damage
  Calculator` heading, or `Compare six moves in either direction. State stays in this browser tab.`
- Loading and failure presentations continue to name the Damage Calculator so page purpose and
  error context remain understandable before the interactive controls exist.
- The primary navigation marks exactly one current application section with `aria-current="page"`
  and a persistent accent treatment distinct from hover and focus. Pokédex routes mark Pokédex,
  Team Builder routes mark Team Builder, and the calculator page marks Damage Calculator.
- The calculator main area occupies the available width up to its existing desktop cap, is centered
  with equal inline margins, and begins below the site header instead of being artificially
  centered lower in the remaining viewport. Field Effects and the paired Pokémon panels share the
  same centered width.
- Desktop retains two equal Pokémon columns. Tablet and phone breakpoints retain comfortable
  spacing and the existing single-column phone fallback without horizontal page overflow.

### Field-effect cells

- Weather contains four cells: Sun, Rain, Sand, and Snow. Terrain contains four cells: Electric,
  Grassy, Psychic, and Misty. No separate `None` cell is shown.
- Each weather or terrain group has zero or one selected value. Activating an unselected cell
  selects it and replaces the previous selection in that group; activating the selected cell again
  clears the group to none.
- Left and Right keep their independent boolean effects and existing labels. Each becomes a full
  clickable cell rather than a checkbox-only row. Activating a cell toggles only that side and
  effect.
- Cells use native buttons with `aria-pressed`, visible focus, and group labels. Pointer, touch,
  Enter, and Space all operate the same control without nested interactive elements or duplicate
  events. The selected background and contrasting text work in both themes and are not the only
  state signal.
- Field Effects remains collapsible. Its summary and calculation inputs continue to use the same
  canonical values, active-state names, reset-on-Pokémon-change behavior, and immediate local
  recalculation. Clearing the last active cell restores `None active`.

## Decisions and assumptions

- The completed `grill-me` handoff is authoritative. Clicking an active weather or terrain cell
  clears that group to none; a visible `None` choice is unnecessary.
- The supplied repository screenshot is layout evidence only and remains a user-owned reference
  file. It must not be edited, staged, or committed in this cycle.
- Native toggle buttons are preferable to visually hidden checkboxes or radio buttons: they make
  the entire cell interactive, expose toggle state directly, and support deselecting the only
  active weather or terrain value.
- The primary navigation is Django-owned shell markup. The template can derive the current section
  from `request.resolver_match.url_name`; no backend context change is needed. Detail routes remain
  associated with their parent section.
- The observed bias comes from the calculator main/container sizing and generic main centering.
  The Web owner should use explicit width, inline auto margins or grid justification, and
  top-aligned flow rather than viewport-specific offsets.
- Existing `FieldState` strings and booleans remain the calculation-engine boundary. This is a
  presentation and input-control change, not a mechanics change.
- Generated Vite output is validation evidence, not a new hand-maintained source contract; follow
  the repository's existing ignore and packaging behavior.

## Scope and ownership

### Web GUI owner

`web_gui_coder` exclusively owns implementation in:

- `src/web/templates/base.html` for semantic current-page navigation state;
- `src/web/src/damage-calculator/app.tsx` for ready-page copy removal and Field Effects controls;
- `src/web/static/web/css/site.css` for the shared current-page navigation treatment;
- `src/web/static/web/css/damage-calculator.css` for centered layout and selectable cells;
- `src/web/src/damage-calculator/app.test.tsx` for component state and accessibility regressions;
- `src/web/tests/e2e/damage-calculator.spec.ts` for rendered navigation, layout, keyboard, pointer,
  toggle, reset, theme, and responsive behavior; and
- other `src/web` test helpers only if the existing test boundary requires a narrow shared change.

The Web owner must preserve Team Builder and Pokédex behavior, the active Damage Calculator
human-review marker, and the user-owned screenshot.

### Review and delivery owners

- `web_gui_reviewer` reviews the complete Web diff without editing it.
- `architect` owns this plan, cross-scope and plan-compliance review, and
  `docs/reports/2026-10-24-damage-calculator-layout-refinement.md` after review.
- `deployment_agent` owns final validation, any approved local-only Bagredex runtime check, staging,
  and the local commit.

No backend, Pokémon-data, or deployment implementation is planned. Evidence of a missing server
contract must return to the architect rather than expanding Web ownership implicitly.

## Data and interface impact

### Navigation contract

The three primary links keep their current URLs and regulation query strings. Add
`aria-current="page"` only to the link matching the rendered application section. The CSS selected
state must remain visible when the link is neither hovered nor focused, while `:focus-visible`
retains an obvious keyboard outline or equivalent focus indicator.

Route-family mapping is explicit:

- `home`, `pokedex-index`, `pokedex-details`, and `pokedex-form-detail` map to Pokédex;
- `teams-page` and `teams-detail` map to Team Builder; and
- `damage-calculator-page` maps to Damage Calculator.

Data and sprite endpoints do not render the base template and require no selected state.

### Field-state contract

Do not change `FieldState`, `emptyField`, `calculationField`, or engine values. A weather/terrain
cell computes its next value as `current === option ? "" : option`. A directional cell negates only
its corresponding boolean under `left` or `right`. Continue passing a new immutable state object to
`onChange` so Preact rerenders and damage results update through the existing path.

Use stable visible labels rather than exposing canonical casing. Fieldset legends or equivalent
group labels must give Weather, Terrain, Left, and Right accessible names. Every cell must have an
observable pressed state and at least the existing minimum touch-target height.

### Layout contract

The ready island should have no decorative intro header. The calculator wrapper and main class
must explicitly fill the available inline size up to the desktop maximum, center themselves, and
top-align the document flow. Field Effects precedes the paired panels and matches their total width.
Do not use absolute positioning, fixed pixel offsets, viewport-height padding, or JavaScript layout
measurement.

## Implementation sequence

1. The Web owner adds focused component expectations for weather/terrain select, replacement,
   deselection, directional independence, `aria-pressed`, and the empty summary.
2. Replace the two selects and checkbox labels with reusable native pressed-button cells while
   retaining the existing immutable `FieldState` and summary/reset paths.
3. Remove only the ready-state intro markup. Keep loading, unavailable, stale-data, and calculation
   errors identifiable.
4. Add route-family-aware `aria-current` attributes in `base.html` and selected/focus styling in
   `site.css` without altering URLs or regulation propagation.
5. Correct the calculator/main sizing and alignment, then style responsive weather, terrain, Left,
   and Right cell groups in `damage-calculator.css` using existing color and spacing tokens.
6. Update Playwright coverage for current navigation state, absence of removed copy, mouse and
   keyboard cell toggling, mutual exclusion and toggle-off, directional independence, summary
   updates, calculation response, centered desktop geometry, and phone containment.
7. Run Web checks and focused browser tests. Return every finding to the Web owner until clean.
8. Dispatch `web_gui_reviewer`, then the architect for integration review. Resolve all actionable
   findings and repeat affected checks and reviews.
9. The architect writes the cycle report. The deployment agent runs final checks, stages only this
   cycle, and creates the local commit without changing the active human-review marker.

## Review and verification

The Web owner runs and reports:

- `npm run check` from `src/web`;
- focused Vitest for `src/damage-calculator/app.test.tsx`, followed by the complete `npm test` Web
  suite;
- `npm run build`, confirming the Damage Calculator entry and manifest are emitted;
- focused authenticated Playwright for `tests/e2e/damage-calculator.spec.ts` across the configured
  desktop projects when the established local environment is available;
- phone coverage at the existing `390 × 844` viewport; and
- `.codex/lint.sh` plus `git diff --check` before review handoff.

Component and browser evidence must prove:

- weather and terrain allow at most one value, replace the prior selection, and clear when the
  active cell is activated again;
- Left and Right effects remain independent, expose correct pressed state, update the summary, and
  reset when either Pokémon changes;
- pointer and keyboard activation use the same native controls and visible focus is retained;
- relevant damage output changes when a weather, terrain, or directional modifier is selected and
  returns when cleared;
- only the current primary navigation link carries `aria-current="page"`, with Pokédex and Team
  Builder route-family regression coverage;
- removed ready-state copy is absent while loading and failure states remain understandable;
- desktop geometry has approximately equal left and right free space around the shared content
  column, Field Effects aligns with the two-panel width, and no content is pushed toward the bottom;
  and
- light and dark selected cells, desktop/tablet layouts, and the phone fallback have no overlap,
  clipping, inaccessible control, or horizontal page overflow.

`web_gui_reviewer` checks semantic navigation, native control behavior, pressed/focus contrast,
touch target size, DOM ownership, recalculation latency, responsive geometry, theme behavior, and
test quality. The architect confirms there is no backend/data contract drift, shared navigation
does not alter other pages beyond the approved indicator, and the Damage Calculator review session
was not silently retargeted or finished by source work.

The deployment agent reruns `.codex/lint.sh`, `git diff --check`, Web check/test/build, and available
authenticated browser validation before committing. It must not use a Git remote, registry, or
operational external service.

## Risks

- Using styled wrappers around hidden controls could create two click targets or inconsistent
  keyboard behavior. Make the cell itself the native button.
- A generic URL-prefix check could mark no link or multiple links on detail routes. Use the explicit
  resolver-name mapping and assert exactly one current link.
- Removing the ready heading could accidentally remove state identification from loading or error
  output. Limit removal to the successfully loaded interactive view.
- Width changes could trade the desktop bias for phone overflow. Use intrinsic grid constraints,
  `minmax(0, 1fr)`, and existing breakpoints; validate geometry at representative widths.
- Selected backgrounds alone are insufficient for accessibility. Preserve text, `aria-pressed`,
  border/contrast, and visible focus signals.
- The active human-review marker is operational state outside the source diff. Do not mutate or
  finish it as part of Web implementation; runtime refresh after the ordinary commit requires an
  explicit supported lifecycle decision by the parent workflow.

## Completion criteria

- The ready Damage Calculator omits both requested information/header blocks.
- Exactly one primary navigation link is semantically and visibly selected on all three application
  sections without URL or regulation propagation regressions.
- Field Effects and both Pokémon panels occupy one centered, top-aligned responsive content column.
- Weather and terrain are full-cell, mutually exclusive, toggle-off controls; directional effects
  are full-cell independent toggles; every selected cell has an accessible pressed state and visible
  background.
- Existing summary, reset, and local recalculation behavior remains correct, with automated pointer,
  keyboard, desktop, theme, and phone evidence.
- Web GUI and architect reviews report no unresolved blocking findings; all required checks pass or
  any environment limitation is reported precisely without claiming success.
- The cycle report and one justified local commit are complete, with no backend/data change,
  unrelated screenshot change, remote operation, or human-review marker mutation.

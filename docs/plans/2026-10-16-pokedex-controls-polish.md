# Pokédex controls polish

## Summary

Polish the selected-Pokémon controls and move table inside the existing Preact Pokédex island.
Shiny and Mega controls move beneath the selected sprite and become compact icon controls, the
stats explanation moves into an accessible information tooltip, and move type, category, and power
become browser-local sortable columns. The cycle also fixes the search field focus border where it
meets the list table.

This is a Web-only presentation and interaction change. It reuses the loaded bulk details and
existing native controls, plain CSS, page-lifetime state, and Playwright configuration. It does not
change Django, Pokémon data, endpoints, dependencies, or assets outside `src/web`.

## Goals

- Put the selected sprite first and its Shiny and Mega controls immediately below it in one
  side-by-side, wrapping control row.
- Replace the current Shiny, Mega, and move-category drawings with clearer original Bagredex SVGs
  without copying official or external artwork.
- Keep icon controls visually compact while retaining complete accessible names, tooltips, focus,
  active state, and existing form-switch semantics.
- Reduce visible stats copy to a `Stats` heading plus a small accessible information control that
  exposes the exact current explanation on mouse, keyboard, and touch.
- Add deterministic three-state sorting to move Type, Category, and Power headers, with only one
  active sort and a return to the existing alphabetical move order.
- Keep move sorting within one animation frame after details are loaded.
- Restore an unobscured search-field bottom focus border in Firefox and Chromium, in both themes
  and across supported layouts.
- Eliminate the remaining Firefox flicker when the first Pokémon is selected and when any main
  Pokémon-table stat sort changes direction or returns inactive.

## Non-goals

- Changing Pokémon-list stat sorting, search suggestions, filters, selected-form data, move
  metadata, or modal contents.
- Sorting moves by name, accuracy, PP, priority, target, flags, or learn method.
- Changing base-to-Mega, Mega-to-base, shiny sprite, selection, or modal-closing behavior.
- Copying Pokémon, Showdown, or third-party icons; adding an icon library, tooltip library, CSS
  framework, state library, dependency, font, image, or network request.
- Changing Django templates, backend serialization, database models, migrations, imported data,
  sprites, deployment packaging, or regulation behavior.
- Persisting move sort or tooltip state across a Pokémon selection, regulation reload, or visit.

## User-visible behavior

### Sprite and form controls

- The selected form heading and types remain above its sprite. The sprite is followed immediately
  by one centered `.form-toggles` row containing Shiny first and the applicable Mega controls after
  it. The row wraps without overlap on phone widths.
- Shiny is visually an original three-stars SVG with no adjacent `Shiny` text. Its native button
  retains the current action-specific `aria-label`, `title`, `aria-pressed`, pointer behavior,
  visible focus, and active background.
- Mega uses a new original double-helix/DNA-inspired SVG whose geometry is authored in this
  repository and does not trace an official Mega Evolution mark. A compact visible marker
  distinguishes `X`, `Y`, `Z`, or unqualified `M`; the full imported form name remains in the
  button's action-specific `aria-label` and `title`.
- A base form still shows every applicable Mega choice. A selected Mega still shows only its own
  active control and activating it returns to the base. Shiny remains available for every form and
  independent of Mega selection. Existing active color and background styling remains.
- Icon-only presentation must not reduce the existing 44 CSS-pixel touch target or make the
  controls dependent on color alone. Active state continues through `aria-pressed`, background,
  border, and the accessible label.

### Stats information

- `Stats at level 50` becomes `Stats`. The always-visible formula paragraph is removed.
- A small native information button sits immediately after the heading. Its visible content is an
  `i`, while its accessible name explains that it shows level-50 stat calculation information.
- Hovering or focusing the information button shows a nonmodal tooltip containing exactly:
  `Real: 0 SP, neutral nature. Min: 0 SP, hindering nature. Max: 32 SP, increasing nature.`
- Clicking or tapping toggles a pinned tooltip so touch users can read it. A second activation,
  Escape, or pointer activation outside the control/tooltip dismisses it. Pointer leave or focus
  leave dismisses an unpinned tooltip. The tooltip contains no interactive content.
- The button exposes expanded state and a programmatic relationship to the tooltip. Opening it
  does not move focus; closing it returns or retains focus naturally. Selecting another form
  dismisses it, and the tooltip never opens the move/ability information dialog.

### Move sorting and category presentation

- Move rows retain their existing Name, Type, Category, and Power fields and continue opening the
  move information dialog when activated.
- The Category column heading is visually only the new category-symbol treatment. It remains a
  native sort button with accessible name `Sort moves by category`, and its containing column
  header exposes `aria-sort`. Type and Power use equivalent labelled native buttons. Name remains
  a static, unsortable heading.
- Category row icons become original, repository-authored familiar shapes: a compact impact/burst
  for Physical, concentric energy or wave geometry for Special, and a neutral status/condition
  mark for Status. Visible category text remains in each row, so icons reinforce rather than
  replace the value. SVGs use `currentColor`, are decorative in rows, and add no duplicate spoken
  label.
- Activating Type, Category, or Power cycles ascending, descending, then inactive. Activating a
  different column starts that column ascending and clears the former sort. Direction is conveyed
  by `aria-sort`, visible direction treatment, and an accessible button label rather than color
  alone.
- Inactive order is the backend-provided `move_ids` order, which is the existing move-name then
  identifier order. The implementation does not mutate that array; it derives a sorted copy.
- Type ascending compares the canonical display type name using the existing normalized,
  locale-independent comparison; descending reverses the primary comparison. Equal types use move
  name then canonical move identifier ascending as stable deterministic ties in both directions.
- Category ascending uses the explicit domain rank Physical, Special, Status; descending reverses
  that rank. Equal categories use move name then canonical identifier ascending.
- Power sorts damaging moves by canonical numeric `base_power`, ascending or descending. Status
  moves continue to display an em dash and always follow damaging moves in both directions, so a
  hidden numeric value never gives the em dash a misleading position. Equal numeric powers and all
  Status ties use move name then canonical identifier ascending.
- Selecting another Pokémon or form resets move sorting to inactive alphabetical order. Shiny
  toggling and opening or closing an information dialog preserve the current move sort.

### Search focus border

- The focused search text field's full focus indication, including its bottom edge, remains visible
  above the adjacent table border. The correction uses deliberate spacing, stacking, or outline
  geometry rather than removing either border.
- The fix applies to keyboard focus and the selected/focused input state in Firefox and Chromium,
  light and dark themes, without creating a gap, overlap, or clipped suggestion panel at desktop,
  tablet, or phone widths.

### Firefox selection and stat-sort stability

- The outer application, list pane, details pane, toolbar, and their principal scroll gutters keep
  the same rectangles when the initial empty details pane changes to a first-selection loading
  skeleton and then ready details. Content changes inside the reserved details rectangle without
  moving the list or toolbar.
- Every sortable main Pokémon-table stat header retains its current three-state behavior. Cycling
  ascending, descending, and inactive may reorder existing keyed rows but must not change the table,
  header, column, list pane, details pane, or toolbar geometry.
- Sort direction indicators reserve their maximum width in every state. Numeric columns use fixed
  or otherwise stable sizing, and scrollbar space remains reserved, so text metrics and reordered
  content cannot recalculate the table width.
- Existing form identifiers remain row keys. Sorting must not replace row identities or reload row
  sprite images merely because their order changes; selected state and decoded images are preserved
  where the browser and Preact keyed reconciliation allow it.
- The implementation diagnoses and corrects the actual source, including minimum/content height,
  overflow and scrollbar changes, intrinsic column sizing, row remounts, or indicator width. It does
  not mask movement with transitions, delayed visibility, transforms, or screenshots.
- Stability applies with normal and reduced motion. The accepted automated tolerance is at most one
  CSS pixel per measured rectangle edge or dimension, matching the preceding Pokédex geometry
  contract, with no unexpected browser layout-shift entry attributable to the interaction.

## Decisions and assumptions

- Current `BulkForm.move_ids` and normalized move maps already contain every required sort value;
  no transport or parser change is needed.
- Move sort is local state inside the selected details presentation. A small `MoveSort` value with
  key `type | category | power` and direction `ascending | descending`, or `null`, is sufficient;
  no reducer or state library is required unless implementation evidence shows the existing
  component boundary needs one.
- Stable tie direction deliberately remains alphabetical for both ascending and descending primary
  sorts. This avoids rows with equal values jumping merely because the primary direction changed.
- Status moves form an explicit terminal power bucket because the UI represents their power as not
  applicable. Numeric comparison applies only to Physical and Special moves.
- The tooltip is a small owned Preact interaction, not a native `title` replacement alone. The
  information button may retain a concise `title`, but the complete formula must be visible and
  accessible through the owned tooltip for hover, focus, and touch.
- SVG components remain in `src/web/src/icons.tsx`, use the shared icon wrapper and `currentColor`,
  and contain only new path/shape definitions authored for Bagredex. The implementation records no
  external source because none is used.
- The existing selected-detail DOM is owned entirely by the Preact island. No Django shell change
  is required for controls that appear only after selection.
- Existing one-frame measurements use a deterministic DOM mutation boundary after warm-up. Move
  sort timing must be measured in-page rather than across Playwright process or animation-frame
  scheduling overhead.
- The current keyed `PokemonRow` boundary is the intended identity-preservation mechanism during
  main-table sorting. If instrumentation shows remount or image request behavior, fix the state or
  prop identity that defeats it rather than introducing a cache or preload layer.

## Scope and ownership

### Web GUI coder

Own all implementation and tests under `src/web`:

- Update `src/web/src/icons.tsx` with original three-star, double-helix Mega, and Physical, Special,
  and Status category geometry. Keep the common SVG contract, `currentColor`, and decorative versus
  labelled behavior explicit.
- Update `src/web/src/app.tsx` to move controls below the selected sprite, render only compact Mega
  differentiators, add stats-tooltip state and dismissal, and add move-sort state, cycle logic,
  comparators, accessible headers, and reset/preservation behavior.
- Update `src/web/static/web/css/pokedex.css` for the new control position, icon-only sizing, marker
  placement, tooltip, sortable move headers, direction indication, and search/table focus-border
  fix across themes and viewports. Reserve the selection and main-table sorting geometry without
  animation-based concealment.
- Extend `src/web/src/app.test.tsx`, `src/web/src/performance.test.tsx`, and
  `src/web/tests/e2e/pokedex.spec.ts` as appropriate. Tests should assert public behavior rather
  than SVG path strings or incidental component structure.
- Do not edit `src/backend`, `src/data`, `deploy`, package manifests, lockfiles, generated Vite
  output, or documentation.

### Web GUI reviewer

Review `src/web` read-only for interaction correctness, semantics, keyboard and touch access,
responsive layout, original icon implementation, one-frame local sorting, regression coverage,
and plan compliance. Return actionable findings to the Web GUI coder until no blocker remains.

### Architect

Own this plan, the post-review plan-consistency check, and the cycle report. No backend or data
review is required because their interfaces are unchanged. The architect must stop the cycle if
implementation reveals that a backend value or contract change is actually required.

### Deployment agent

No deployment file change is expected. After review, the deployment agent owns final repository
checks, real Firefox and Chromium validation against the local review stack, cleanup of browser
artifacts, and the local commit. It does not edit application code to resolve Web findings.

## Data and interface impact

- No backend endpoint, bootstrap, bulk-details schema, data version, database, importer, sprite, or
  authentication behavior changes.
- No package, lockfile, Vite entry, manifest contract, runtime image, environment variable, or
  external asset changes.
- New browser state is limited to the selected pane's move sort and transient stats-tooltip state.
  Both are released on page unload; neither uses browser storage or crosses regulation reloads.
- Existing move identifiers, type names, categories, and numeric power are consumed without
  reinterpretation except for the explicitly defined presentation sort buckets.
- Compatibility risk is confined to selected-detail markup and CSS selectors. Existing search,
  filtering, Pokémon-list sorting, modal activation, and Playwright locators must remain valid or
  be deliberately updated to their accessible public labels.

## Implementation sequence

1. The Web GUI coder adds pure move-sort types, cycle logic, and deterministic comparators with
   focused unit coverage before changing markup.
2. Replace the icon geometry and add semantic category sort controls. Verify icon accessibility,
   category text, `aria-sort`, inactive order, each cycle, single-active behavior, status bucketing,
   and stable ties.
3. Move the Shiny/Mega group below the sprite and change visible labels to the approved compact
   markers without altering selection, active, title, tooltip, or accessible-name behavior.
4. Replace the stats explanation with the heading-adjacent information control and implement
   hover, focus, click/touch pinning, outside activation, Escape, selection reset, and reduced-motion
   behavior.
5. Instrument the two reported Firefox flickers before correcting them. Compare empty, delayed
   first-selection loading, and ready detail geometry; then compare every state of every main stat
   sort. Inspect minimum heights, overflow, scrollbar gutters, intrinsic column widths, indicator
   width, keyed row identity, sprite requests, and browser layout-shift observations.
6. Correct the search/table border interaction and the observed selection/sort geometry causes with
   the smallest CSS or Preact changes that pass real browser inspection. Do not use animation or
   delayed paint as a stability mechanism.
7. Expand component, accessibility, performance, and Playwright coverage, then run the complete Web
   checks and production build.
8. The Web GUI reviewer performs the scope review. After corrections, the architect confirms that
   no backend/data/deployment contract drift occurred and that all approved behaviors are covered.
9. The architect writes the cycle report. The deployment agent performs final local checks and
   browser validation, removes temporary artifacts, stages reviewed files, and creates the local
   commit without any remote operation.

## Review and verification

### Component and accessibility checks

- Prove the control group follows the selected sprite in DOM and visual order, Shiny comes first,
  base forms expose every Mega, and a Mega exposes only its active return control.
- Prove icon controls have no redundant visible Shiny/full-Mega text, retain full `aria-label`,
  `title`, `aria-pressed`, focusability, active styling, and at least 44-by-44 CSS-pixel targets.
- Verify the original SVGs inherit `currentColor`, remain sharp at rendered sizes, and expose no
  duplicate accessible names. Review source geometry to confirm no copied asset or external file.
- Verify the `Stats` heading and immediately adjacent information button; exact tooltip copy;
  hover, focus, click/touch, second-click, Escape, outside activation, and form-change dismissal;
  expanded/relationship attributes; and absence of focus theft or keyboard traps.
- Cover each Type, Category, and Power ascending, descending, and inactive cycle; switching columns;
  inactive source order; deterministic equal-value ties; category rank reversal; numeric zero;
  Status em-dash and terminal bucket; and reset/preservation rules.
- Verify Name stays unsortable, row activation still opens the correct modal, row category text is
  present, category icons are decorative, and the visually icon-only Category header has a usable
  accessible name and correct `aria-sort`.
- Add an in-page warm measurement for representative full-learnset Type, Category, and Power sorts.
  The deterministic sorted DOM state must be observable within 16 milliseconds for repeated runs.

### Browser and visual checks

- Run Playwright in configured Firefox and Chromium desktop, tablet, and phone projects against the
  local active data. Cover icon control placement and wrapping, multiple Mega choices, both Mega
  directions, shiny independence, tooltip mouse/keyboard/touch dismissal, all move sort cycles,
  Status placement, modal regression, and phone usability.
- In Firefox and Chromium, inspect the focused search field at desktop and tablet widths in light
  and dark themes. Assert or capture that the bottom focus edge is not occluded by the table border
  and that opening suggestions does not reintroduce clipping. Check the phone fallback separately.
- Verify keyboard order from selected heading through sprite controls, stats information, abilities,
  move sort headers, and move rows. Confirm visible focus, zoom resilience, touch targets, and
  reduced-motion behavior.
- Confirm selected-pane width and list/detail geometry remain stable when the controls wrap, the
  tooltip opens, moves reorder, and a Mega form is selected.
- In Firefox, intercept and delay the bulk-details response, select the first Pokémon, and compare
  outer app, list, detail, toolbar, and scroll-gutter rectangles in empty, loading, and ready states.
  Each x, y, width, and height delta must be no more than one CSS pixel; deterministic screenshots
  must show no visible jump, and a `PerformanceObserver` layout-shift check must report no
  interaction-attributable unexpected shift when supported.
- In Firefox, cycle ascending, descending, and inactive for HP, Attack, Defense, Sp. Atk, Sp. Def,
  Speed, and BST. At every transition compare the table, header row, each column boundary, toolbar,
  list, detail, and scrollbar geometry within the same one-pixel tolerance. Record row DOM identity
  across reorders and assert no new row-sprite request caused solely by sorting. Repeat the critical
  geometry and request assertions in Chromium as a regression check.

### Repository checks

- Run frontend TypeScript, Prettier, Vitest, the production Vite build, manifest verification, and
  all configured Playwright projects.
- Run `.codex/lint.sh` and `git diff --check`. Confirm no backend, data, deployment, dependency,
  lockfile, generated distribution, or external asset change entered the diff.
- Record browser versions, test counts, bundle sizes, move-sort timings, and any temporary artifact
  cleanup in the cycle report. Never claim a browser or visual check that was not observed.

## Risks

- Icon-only controls can obscure meaning. Full action labels, native titles, visible focus, compact
  differentiators, active state, and minimum touch targets keep them understandable and operable.
- Hover-only tooltips exclude keyboard and touch users. Shared focus and pointer behavior plus an
  explicit pinned click state and multiple dismissal paths cover those modes without a dependency.
- Sort direction can make equal rows appear unstable or place an em dash misleadingly among numeric
  values. Fixed tie order and a terminal Status bucket make every order deterministic and visible.
- Whole-row move buttons can overlap sort headers if markup or stacking changes indiscriminately.
  Header buttons remain outside rows, and browser tests must exercise sorting followed by modal
  activation.
- Raising the search control above the table can accidentally obscure suggestions or sticky table
  headers. The fix is scoped to the focus edge and verified with the suggestion panel open across
  browsers and viewports.
- New control placement may lengthen the detail pane for multi-Mega forms. Flex wrapping, preserved
  scrolling, and desktop/tablet/phone inspection control that risk without shrinking touch targets.
- Firefox may recompute intrinsic table widths from reordered extrema, add a scrollbar when detail
  content replaces the empty state, or expose a width change when sort arrows appear. Reserved
  pane heights and gutters, stable table layout, fixed indicator space, and direct per-column
  measurements address those causes without freezing responsive widths.
- Automated screenshots alone can miss transient layout movement, while rectangle checks can miss
  a repaint that reloads sprites. Delayed responses, synchronous rectangle sampling, layout-shift
  observation, row identity checks, request counting, and screenshots provide complementary
  evidence.

## Completion criteria

- Shiny and applicable Mega controls render directly below the selected sprite, side by side when
  space permits, with approved original icon geometry, compact markers, complete accessible labels,
  visible focus, active backgrounds, and unchanged base/Mega/shiny behavior.
- The selected pane says `Stats`; its exact formula copy is available from the adjacent accessible
  information control by hover, focus, and touch/click, and every dismissal path works.
- Type, Category, and Power are the only sortable move headers. Each follows
  ascending-to-descending-to-inactive, only one is active, inactive restores source alphabetical
  order, ties are stable, and Status power display and placement follow the documented rules.
- Category is icon-only in the header but retains an accessible sort name; row category icons and
  labels use original Bagredex shapes without an external asset or duplicated spoken content.
- The focused search field's bottom edge remains clearly visible in Firefox and Chromium light and
  dark themes at desktop, tablet, and phone widths, including while suggestions are open.
- Empty-to-first-selection loading/ready transitions preserve outer app, list, detail, toolbar, and
  scrollbar geometry within one CSS pixel in Firefox, with no unexpected interaction-attributable
  layout shift.
- All seven main Pokémon stat columns preserve table, column, header, pane, toolbar, and scrollbar
  geometry throughout ascending, descending, and inactive cycles. Keyed rows and row sprites are
  reordered rather than unnecessarily remounted or re-requested; Firefox and Chromium regression
  checks pass.
- Representative loaded move sorts meet the measured one-frame target, and existing search,
  filters, Pokémon-list sorting, modal, sprites, responsive layout, and regulation reload behavior
  remain green.
- Web GUI review and architect consistency review have no blocking findings. Required frontend,
  browser, accessibility, performance, build, documentation, and diff checks pass; the cycle report
  exists; and the deployment agent reports the final local commit.

There are no remaining material product questions.

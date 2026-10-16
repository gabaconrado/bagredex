# Pokédex table and icon corrections

## Summary

Correct the remaining Pokédex table collisions and refine the selected-form iconography shown in
the supplied dark-theme screenshot at
`references/screenshots/Screenshot 2026-10-16 090533.png`. The Web GUI receives explicit table
column ownership, single-line name truncation, quiet inactive sort indicators, more recognizable
original Bagredex SVGs, a compact stats information affordance, and an accessible icon-only move
category presentation.

This is a presentation-only refinement inside the existing Preact island and plain CSS. Current
sorting, selection, Mega, Shiny, tooltip, browser-local state, geometry, scrollbar, pointer, and
keyboard contracts remain authoritative.

## Goals

- Prevent type badges from covering long Pokémon names at every supported viewport while keeping
  rows and columns geometrically stable.
- Hide inactive main-table and move-table sort arrows visually while reserving their full width.
- Replace the current icon paths with new original Bagredex designs that more closely communicate
  the user-supplied Mega, Shiny, Physical, Special, and Status visual styles.
- Make the stats information affordance look compact without reducing its keyboard, touch, or
  screen-reader usability.
- Restore a visible `Category` move-table header while showing icon-only category values in rows
  with complete accessible names.
- Remove the visible `M` marker from an unqualified Mega toggle while preserving `X`, `Y`, and `Z`
  differentiation.
- Make the entire Pokémon data row clickable and tappable while retaining the name as the native
  keyboard and focus selection control.
- Preserve the established one-pixel geometry tolerance across selection and sorting interactions.

## Non-goals

- Changing Pokémon or move sorting keys, cycles, direction, tie-breaking, Status power placement,
  pointer-versus-keyboard scroll behavior, search, filters, selection, or modal behavior.
- Wrapping Pokémon names, type badges, stat headings, or move rows onto additional lines.
- Copying, tracing, downloading, embedding, or redistributing official Pokémon, third-party, or
  user-linked icon assets. Visual references are inspiration only.
- Adding an SVG file, raster image, icon font, dependency, package, component library, tooltip
  library, external request, or new build entry.
- Changing Django templates, endpoints, transport contracts, backend or data code, database state,
  sprites, authentication, regulation state, deployment, or generated Vite output.
- Redesigning the overall page, changing the Indigo theme, or revisiting completed loading and
  responsive architecture.

## User-visible behavior

### Pokémon table

- Sprite, Pokémon, Types, and all seven stat columns have deliberate non-overlapping column tracks.
  A semantic `<colgroup>` or an equivalently explicit fixed-table contract assigns the space rather
  than relying on cell content to negotiate widths after paint.
- A Pokémon name remains on one line inside its own cell. When it cannot fit, it ends with an
  ellipsis before the Types column; it never paints under a type badge or changes row height.
- The full form name remains the button's accessible name and is available to pointer users through
  a native `title`. Keyboard focus exposes the same complete name through the accessible control;
  truncation changes only visible rendering.
- Type badges remain entirely inside the Types cell. They stay on one line in table rows and clip or
  fit within the allocated track without entering the name or HP columns. Desktop and tablet retain
  both type badges; the existing phone rule may hide the entire Types column.
- Row sprite size, row height, sticky header, horizontal scroll, keyboard focus reveal, pointer sort
  origin, scrollbar gutters, and fixed geometry remain unchanged. Column width choices may vary by
  responsive breakpoint, but they do not vary by row content, selection, sort direction, or state.
- Main stat header buttons reserve one indicator box in every state. Inactive indicators are
  visually hidden, not replaced with a visible bidirectional arrow; active state shows only the
  appropriate ascending or descending arrow. `aria-sort` remains the semantic source of direction.
- Clicking or tapping sprite, name, Types, or stat-cell whitespace selects that exact row. The full
  body row shows pointer, hover, and selected treatment; header cells remain independent and only
  their native buttons change sorting.
- The Pokémon name remains a native button in the row header and is the row's only tab stop. Enter
  or Space on it selects exactly once. The row itself is not given a second button/link role or
  tabindex, and the implementation prevents the name button's activation from bubbling into a
  duplicate row selection.
- Row-wide activation does not create nested interactive content, invalid table markup, an
  accidental sort, or a second detail transition. Pointer and touch users gain a larger target
  without changing the table's native row, row-header, cell, and column-header semantics.

### Original icons and Mega markers

- `ShinyIcon` becomes an original three-star cluster with one primary sparkle and two smaller,
  clearly separated sparkles. It remains monochrome `currentColor`, decorative inside the labelled
  Shiny button, and legible at the existing rendered size.
- `MegaIcon` becomes an original compact Mega-stone/DNA silhouette: an enclosing stone or orbital
  contour with a stylized double-helix or crossing energy core. It may evoke the familiar concept
  but must not reproduce or trace the official Mega Evolution emblem.
- Physical uses an original asymmetric impact/burst shape, Special uses original concentric or
  radiating ripple geometry, and Status uses a complementary clear condition/support symbol that
  is visually distinct from both attack categories at small size.
- All icons are authored as inline SVG components in the repository, use a consistent view box,
  inherit `currentColor`, maintain contrast in light and dark themes, and introduce no asset or
  network provenance. The user-linked pages are design inspiration only, not sources.
- Plain Mega buttons show only the Mega icon. Mega X, Y, and Z buttons show the icon plus exactly
  `X`, `Y`, or `Z`. No plain `M` appears. Full switch/return action names, titles, `aria-pressed`,
  focus, touch targets, and base↔Mega behavior remain unchanged.

### Stats information control

- The visible stats information mark is approximately 1.25–1.5 rem and sits immediately after the
  `Stats` heading without looking like a peer action button.
- Its native button retains an effective target of at least 44 by 44 CSS pixels through a
  transparent button box, invisible padding, or wrapper. Visible focus surrounds or clearly points
  to the compact mark, and hover/pointer behavior does not expose an unexplained dead area.
- The existing accessible name, `aria-expanded`/relationship, exact explanatory copy, hover,
  focus, click/touch pinning, outside click, second activation, Escape, and form-change dismissal
  behavior do not change.
- The tooltip sizes to its copy up to a responsive maximum instead of occupying an unnecessarily
  broad fixed width. It remains readable, viewport-contained, above adjacent content, and compact
  in both themes.

### Move table

- The header visibly reads `Category` and remains the native sortable button for that column. Type,
  Category, and Power keep the existing ascending→descending→inactive cycle, single-active rule,
  stable ties, and inactive alphabetical fallback.
- Every move row shows only the corresponding Physical, Special, or Status icon in the Category
  cell. The words are visually hidden, but the cell and full-row action expose the exact category
  to assistive technology without duplicating or weakening the move's accessible name.
- Category icon alignment and reserved cell width are identical across all three values. Changing
  sort order cannot resize a column or row.
- Move sort indicators follow the main-table treatment: inactive arrows are visually hidden while
  their box remains reserved; active ascending or descending arrows are visible. Accessible labels
  and `aria-sort` retain the direction.

## Decisions and assumptions

- The supplied screenshot is evidence of a table-track defect: the fixed-layout table has a sprite
  width but no explicit name or Types allocation, while name content is not clipped. The correction
  should define column tracks and overflow boundaries rather than shorten data or add wrapping.
- A `<colgroup>` with stable classes is preferred because one declaration can govern matching
  header and body columns. CSS custom properties or fixed/rem widths may adjust at existing desktop,
  tablet, and phone breakpoints. The Web owner must measure the current 351-row M-C table before
  selecting final values.
- The Pokémon name button keeps its real text node for its accessible name. CSS applies
  `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`, and `min-width: 0` at every
  necessary wrapper; `title={form.name}` supplies the complete hover label.
- Row type lists use `flex-wrap: nowrap` and remain bounded by their table cell. No badge is
  absolutely positioned, and overflow must not cover neighboring content.
- Inactive indicator elements stay in the DOM with the same width and use `visibility: hidden` or
  equivalent non-layout-changing presentation. Removing the node, clearing its width, or using a
  visible `↕` does not meet the requirement.
- Move Category header text is literal visible text. Its category-style icon is removed from the
  header because it could be mistaken for a current row value; only the reserved sort direction
  indicator accompanies the word.
- Row category accessibility uses one deliberate source, such as visually hidden text within the
  cell, while the SVG remains `aria-hidden`. The existing full-row button label continues to name
  category as part of the move action.
- Icon originality is reviewed from the committed path geometry and development notes. Similarity
  is limited to general concepts such as stars, a stone, helix, impact, and ripples; no external SVG
  path, bitmap, DOM, font glyph, or downloaded file enters the workspace.
- No state or domain-model change is needed. Existing `form_label` is sufficient to derive X/Y/Z;
  the absence of such a suffix renders no visible marker.
- Whole-row selection uses event delegation from the semantic body `<tr>` or an equally sound
  non-nested design. The existing name button explicitly stops or otherwise deduplicates row
  activation. Sort buttons remain outside body rows, so their pointer and keyboard handlers never
  enter the row-selection path.
- Selection correctness is observable as one selection transition per pointer, touch, Enter, or
  Space activation. Re-selecting the already selected row may be a state no-op, but it must not
  issue a request, reopen or close unrelated UI twice, or change sort state.
- Existing browser geometry helpers, isolated Playwright project execution, screenshot attachments,
  row identity checks, lazy sprite request checks, and pointer/keyboard scroll checks are reused and
  extended rather than replaced.

## Scope and ownership

### Web GUI coder

Own all implementation and tests under `src/web`:

- Update `src/web/src/app.tsx` with explicit table column markup, full-name title behavior, inactive
  indicator state classes, compact info-control markup if needed, visible Category header, hidden
  accessible row category text, plain-versus-X/Y/Z Mega marker rendering, and deduplicated semantic
  whole-row pointer/touch selection with the native name-button keyboard path.
- Replace only the locally authored SVG geometry in `src/web/src/icons.tsx`. Preserve the shared
  wrapper, `currentColor`, decorative semantics, and existing public components unless a small prop
  refinement is required for correct accessibility.
- Update `src/web/static/web/css/pokedex.css` with bounded table tracks, name ellipsis, type-cell
  containment, reserved hidden indicators, compact visible info mark with a 44-pixel target,
  content-sized tooltip, and aligned icon-only category cells in light/dark responsive layouts.
- Extend `src/web/src/app.test.tsx` and `src/web/tests/e2e/pokedex.spec.ts`; adjust focused
  performance tests only if markup locators change. Assert behavior and geometry, not exact SVG path
  strings.
- Do not edit `src/backend`, `src/data`, `deploy`, package files, lockfiles, generated Vite assets,
  reference screenshots, or documentation.

### Web GUI reviewer

Review `src/web` read-only for table containment, readable truncation, semantic table structure,
icon originality and small-size clarity, tooltip and touch accessibility, sort semantics, responsive
behavior, and regression evidence. Return every actionable finding to the Web owner until no
blocker remains.

### Architect

Own this plan, the final cross-scope and plan-compliance review, and the completed cycle report. No
backend or data reviewer is required unless implementation unexpectedly changes an interface.

### Deployment agent

No deployment change is planned. The deployment agent owns final repository checks, isolated real
Firefox and Chromium validation against the local review stack, temporary browser-artifact cleanup,
and the local commit. It must return Web defects to the Web owner rather than edit `src/web`.

## Data and interface impact

- No endpoint, bootstrap, normalized detail schema, model, migration, imported data, sprite,
  regulation, authentication, cache, or active-version behavior changes.
- No package, lockfile, build entry, manifest contract, runtime image, environment variable,
  external asset, or external request changes.
- The rendered table may gain a semantic `<colgroup>`, title attributes, state classes, and visually
  hidden category text. These are internal Web markup contracts covered by component and browser
  tests, not server interfaces.
- Sorting continues to consume the same loaded values and remain page-local. Icon and truncation
  presentation does not alter identifiers, display names, form labels, type names, or categories.
- Rollback is limited to the Web source commit because the cycle adds no persistence or data-format
  change.

## Implementation sequence

1. Reproduce the screenshot collision with long base and Mega form names at desktop and tablet
   widths. Record current name, Types, and HP cell boxes before choosing explicit column tracks.
2. Add column markup and containment CSS. Verify one-line ellipsis, title and accessible name,
   full type-badge containment, unchanged row height, phone Types hiding, sticky header, and
   pointer/keyboard horizontal behavior before changing icons.
3. Extend body rows to select from sprite, Types, and stat whitespace while preserving the native
   name button for Enter/Space. Deduplicate bubbling, keep the row out of tab order, and prove header
   sort controls never enter the selection path.
4. Change main and move sort indicator presentation so inactive state is hidden but measured width
   remains identical to both active states. Preserve event handling and `aria-sort`.
5. Author the new Shiny, Mega, Physical, Special, and Status SVG geometry locally, then inspect each
   at actual light/dark rendered sizes. Remove the plain Mega marker while preserving X/Y/Z.
6. Compact the stats information mark and tooltip without changing its state machine, copy,
   relationships, target size, focus, or dismissal behavior.
7. Restore visible move Category header text, make row category values icon-only visually, and add
   the single intended accessible category label.
8. Expand component and Playwright regressions, run complete frontend checks and the production
   build, and compare new screenshots with the supplied reference problem.
9. The Web reviewer checks the complete scope. After owner corrections, the architect verifies
   plan compliance, unchanged cross-scope contracts, and adequate browser evidence.
10. The architect writes the cycle report. The deployment agent performs final isolated browser and
   repository checks, removes temporary artifacts, stages reviewed files, and makes the local
   commit without a remote operation.

## Review and verification

### Component and accessibility checks

- Use representative short, long, base, Mega, hyphenated, and dual-type names. Prove visible names
  remain one line, overflow becomes ellipsis, full text remains the accessible name and `title`, and
  type badges never become name descendants or overlays.
- Prove main and move indicator elements retain the same measured width in inactive, ascending, and
  descending states; inactive is visually hidden, active shows exactly one direction, and
  `aria-sort` completes the full cycle.
- Verify move Name remains unsortable; Type, Category, and Power semantics and exact order remain
  unchanged, including stable ties, zero power, terminal Status placement, and inactive fallback.
- Verify `Category` is visible in the header. Each row exposes category to assistive technology but
  has no visible Physical, Special, or Status text, and row activation still opens the right modal.
- Verify a plain Mega has no visible marker and each X/Y/Z form has exactly its letter. Full labels,
  titles, active state, selection direction, Shiny independence, and minimum touch targets remain.
- Prove sprite, Types, and every stat-cell whitespace path selects the intended Pokémon exactly
  once by pointer/touch, while Enter and Space on the native name button each select exactly once.
  The row has no interactive role or tabindex, the name remains the only row selection tab stop,
  and button bubbling cannot cause a second transition.
- Prove whole-row activation leaves the active main-table sort and header focus unchanged, starts no
  sort activation, and does not issue a detail request beyond the existing single background-load
  design. Header pointer and keyboard sorting must not select a row.
- Verify the stats mark's visible box is approximately 1.25–1.5 rem while its effective button box
  is at least 44 by 44 CSS pixels. Retest exact copy, relationships, hover, focus, click/touch,
  outside click, second activation, Escape, form reset, and viewport-contained content sizing.
- Review SVG source and repository diff for originality and absence of copied paths or external
  assets. At rendered size, confirm all icons use `currentColor`, remain distinguishable without
  color, and retain sufficient contrast in both themes.

### Browser and screenshot checks

- Run the complete isolated Playwright set in Chromium desktop/light, tablet/dark/reduced-motion,
  and phone/light plus Firefox 153 desktop/light and tablet/dark/reduced-motion.
- Reproduce rows shown in the supplied screenshot, especially long Mega names with dual types.
  Attach deterministic before/problem-reference and after screenshots at equivalent desktop
  geometry, then inspect name ellipsis, badge containment, header indicators, icons, stats info,
  and move Category cells.
- At desktop, tablet, and phone widths, measure sprite, name, Types, HP, all stat column, row, table,
  scrollport, list, detail, toolbar, and application rectangles. Cells must not intersect adjacent
  cells; sort and selection transitions remain within one CSS pixel of their baseline geometry.
- In Chromium desktop, tablet, and phone projects, click/tap independently on sprite whitespace,
  Types whitespace when visible, and representative HP/BST stat whitespace. Use different rows or
  an observable selection counter/transition so each action proves exactly one selection, the
  intended row, and unchanged `aria-sort`. On phone, where Types is hidden, cover sprite and stat
  whitespace and assert the hidden cell is not an alternate focus target.
- In Firefox and Chromium, focus the native name button and activate it separately with Enter and
  Space. Confirm one selection per key, retained visible focus, no row double activation, no
  unwanted sort, and no extra network request. Click a stat header afterward to prove header sorting
  remains independent of body-row selection.
- Cycle all seven main stat columns and all three move sort columns through ascending, descending,
  and inactive. Confirm inactive arrows are visually hidden while widths remain stable, sorted
  values are unchanged, row identity persists, and already-requested lazy sprites are not requested
  again.
- Exercise pointer sorting from a horizontally scrolled table and keyboard sorting with the focused
  header at the scroll edge. Pointer restores its settled origin; keyboard preserves visible focus.
- Test the stats tooltip by mouse, keyboard, and touch-sized activation in light and dark themes;
  inspect compact visible size, 44-pixel hit target, focus ring, content-sized panel, dismissal, and
  viewport containment.
- Check icon-only move categories and form toggles at 100% and 200% zoom. Confirm screen-reader
  names through the accessibility tree and verify the phone table and details pane remain usable.

### Repository checks

- Run frontend TypeScript and Prettier checks, all Vitest tests, focused timing checks, the
  production Vite build, manifest verification, and all configured Playwright projects.
- Run `.codex/lint.sh` and `git diff --check`. Confirm the diff contains only this architect plan
  and Web-owner source/tests until the report is added, with no downloaded asset or package change.
- Record test counts, browser versions, bundle sizes, screenshot comparisons, geometry results,
  icon-origin review, and temporary artifact cleanup in the cycle report. Never claim a visual or
  assistive-technology check that was not observed.

## Risks

- Fixed table tracks can solve overlap by making important content unreadably narrow. Explicit
  desktop/tablet measurements, name ellipsis with full labels, retained dual-type space, and
  controlled phone hiding balance density and comprehension.
- `text-overflow` fails unless every containing box can shrink. The button, row header, cell, and
  relevant flex/grid wrappers must all receive compatible width and `min-width: 0` rules.
- Hiding an indicator with `display: none` or conditional rendering would reintroduce Firefox
  flicker. A permanently reserved indicator box with visibility-only state avoids geometry changes.
- Familiar icon concepts can drift too close to official artwork. Original geometry, conceptual
  rather than path-level inspiration, no external files, and explicit reviewer inspection control
  legal and provenance risk.
- Icon-only category rows can remove meaning for nonvisual users. One hidden textual value per cell
  plus the complete row-action name preserves meaning without duplicate announcements.
- A visually small info mark can accidentally become a small target, while an oversized transparent
  target can overlap the heading. Separate visible and hit boxes, controlled stacking, and pointer
  tests protect both requirements.
- New column widths could disrupt the completed pointer/keyboard scroll correction. All browser
  projects must rerun the scroll-origin, focus visibility, column geometry, CLS, and lazy-request
  assertions rather than relying only on screenshots.
- A click handler on both row and name button can select twice, while making the entire row a button
  would create invalid nested interaction and poor table semantics. Keep the `<tr>` semantic and out
  of the tab order, retain one native name button, and explicitly deduplicate its bubbled activation.
- Row-wide pointer handling can accidentally capture text selection or be confused with header
  sorting. Scope the handler to body rows, preserve normal header controls, and test sprite/type/stat
  whitespace plus headers independently on touch and pointer projects.

## Completion criteria

- Long Pokémon and Mega names stay on one line, ellipsize within their own cell, expose the full
  name accessibly and by hover title, and never intersect type badges at any supported viewport.
- Table row heights, column boundaries, scrollbars, toolbar, list, detail, and application geometry
  stay stable within one CSS pixel through selection and every main and move sort state.
- Inactive main and move sort arrows are visually hidden with unchanged reserved width; active
  arrows and accessible directions remain correct.
- New original Bagredex Mega, Shiny, Physical, Special, and Status SVGs are recognizable at actual
  size, use `currentColor`, pass light/dark contrast review, and include no copied or external asset.
- The stats information mark is visually compact with a 44-pixel effective target, unchanged exact
  tooltip behavior and copy, and a content-sized viewport-contained tooltip.
- The move header visibly says `Category`; row categories are icon-only visually and exact for
  assistive technology. Existing sort order and modal activation remain correct.
- Plain Mega has no visible marker; Mega X/Y/Z show only their exact letter, with unchanged complete
  accessible action names and form-switch behavior.
- Every Pokémon body row is clickable/tappable across sprite, visible Types, and stat whitespace,
  with full-row pointer/hover/selected styling. The native name button remains the sole keyboard
  focus control and Enter/Space each select exactly once without invalid nested interaction,
  duplicate activation, sorting, or additional requests.
- Header sorting remains independent of row selection, and whole-row behavior passes explicit
  desktop, tablet, and phone pointer/touch plus Firefox/Chromium keyboard regressions.
- Firefox 153 and Chromium desktop/tablet/phone screenshot, focus, keyboard, touch, zoom, geometry,
  sorting, row identity, and lazy-sprite regressions pass. Frontend, build, documentation, and diff
  checks pass with no backend, data, dependency, deployment, or external-asset change.
- Web review and architect integration review have no blocking findings, the cycle report exists,
  and the deployment agent reports the final local commit.

There are no remaining material product questions.

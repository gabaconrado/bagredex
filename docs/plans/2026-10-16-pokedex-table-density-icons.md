# Pokédex table density and icons

## Summary

Refine the regulation Pokédex table so all ten columns are centered and fit without horizontal
scrolling on desktop and tablet, while retaining deliberate horizontal scrolling only on phones at
40 rem or narrower. Remove the visible backing from miniature row sprites, make the Shiny control's
star icon white and consistently visible, and replace the Special and Status move icons with the
newly supplied user-created SVGs.

This is a Web-only presentation cycle. It preserves the current Preact island, local table state,
sorting, complete-row selection, selected-detail behavior, supplied sprite assets, and Django/Vite
interfaces.

## Goals

- Center every Pokémon table header and cell except the sprite column and its image.
- Fit sprite, Pokémon, Types, six base stats, and BST in the available table width without
  horizontal overflow above the 40 rem phone breakpoint.
- Keep all ten columns readable, non-overlapping, geometrically stable, keyboard reachable, and
  touch usable at desktop and tablet widths.
- Retain intentional horizontal scrolling on phone while keeping all ten columns available.
- Let each miniature sprite's existing transparent WebP alpha reveal the row background.
- Render the Shiny control icon white with clear active/inactive contrast in light and dark themes.
- Package the replacement Special and Status move SVGs byte-for-byte and update their provenance
  and safety contracts without importing a `Zone.Identifier` metadata file.

## Non-goals

- Changing sprite files, generating new sprites, modifying alpha channels, or changing row-sprite
  URLs, loading behavior, dimensions, or selected-detail sprites.
- Removing columns, hiding Types on phone, wrapping table rows, or making desktop/tablet columns
  horizontally scrollable.
- Changing stat or move sort keys, direction cycles, tie-breaking, inactive fallback, sort state,
  selected-row behavior, row-wide pointer/touch activation, or the native name-button keyboard path.
- Recoloring or replacing the Mega or Physical assets, or changing the bytes of the existing Shiny
  SVG. The white Shiny presentation is a Web rendering treatment.
- Changing backend endpoints, payloads, normalized data, regulation behavior, authentication,
  dependencies, packages, lockfiles, Vite entries, or deployment.

## User-visible behavior

### Table alignment and density

- The Pokémon, Types, HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, and BST headers are visually
  centered in their respective tracks. The corresponding name, type badges, and numeric values are
  centered on the same horizontal anchors.
- The sprite header/cells and row image retain their existing dedicated presentation; the centering
  change does not reposition the miniature artwork within that column.
- The Pokémon name remains a single-line native button with ellipsis and complete accessible/title
  text when needed. Centering applies to its visible text without changing its role, 44-pixel
  target, focus treatment, or exactly-once selection behavior.
- One- and two-type badge groups are centered as a unit and stay inside the Types track. Badges do
  not wrap, overlap the name or HP column, or alter row height.
- Sort labels and their permanently reserved arrow slots form one centered group. Inactive arrows
  remain visually hidden but measured; active arrows never move the label, resize a column, or
  change the centered anchor.
- At every viewport wider than 40 rem, the table has no horizontal overflow:
  `.table-scroll.scrollWidth <= .table-scroll.clientWidth` after layout and after every sort,
  filter, and row-selection state used by the critical flow. All ten columns remain present.
- At 40 rem and narrower, all ten columns remain present and the table may be wider than its
  viewport. Horizontal scrolling reveals the complete Types and stat tracks; focus and pointer
  sorting continue to reveal targets without clipping.
- Responsive tracks use full stat labels only where they fit. Deliberate abbreviations (`HP`,
  `Atk`, `Def`, `SpA`, `SpD`, `Spe`, `BST`) may be used at denser desktop/tablet/phone widths while
  complete names remain in `aria-label` and `title`.

### Miniature row sprites

- Row sprites have no painted tile or canvas behind them. Their existing transparent WebP pixels
  reveal the normal, hover, and selected row background directly.
- The image remains 48 by 48 CSS pixels, `object-fit: contain`, lazy-loaded, decorative, and
  non-interactive. Removing the background does not alter row height, click coverage, selection, or
  image requests.

### Shiny, Special, and Status icons

- The Shiny star cluster renders white inside its toggle. It stays visibly distinct against both
  inactive and active toggle backgrounds in light and dark themes, while border/background state
  still communicates `aria-pressed` visually without relying on color alone.
- The existing Shiny SVG bytes and asset fingerprint remain unchanged. A Shiny-specific image class
  may apply a deterministic CSS filter or equivalent presentation layer; generic move/Mega images
  must not inherit that treatment.
- The Special category uses the newly supplied `references/icons/special-move.svg` exactly as
  provided. It retains its `viewBox="0 0 48 48"`, pale-blue ellipse geometry, fills, and strokes.
- The Status category uses the corrected `references/icons/status-move.svg` exactly as provided. It
  retains its supplied view box, geometry, fills, strokes, and color declarations.
- The separate `references/icons/special-move.svg:Zone.Identifier` file is not copied, packaged,
  referenced, or committed. No Status `Zone.Identifier` or other metadata companion may be copied.
  The owned icon directory continues to contain only the five reviewed `.svg` filenames.
- Special and Status remain decorative in their icon-only move rows while the existing hidden
  category text and move actions provide accessible names. Both local emitted URLs must return
  successfully and decode without an external request.

## Decisions and assumptions

- “All ten columns” means Sprite, Pokémon, Types, HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, and
  BST. Phone may scroll, but it does not hide Types or any stat column.
- The breakpoint is exact: layouts above `40rem` must not horizontally scroll the table; layouts at
  or below `40rem` may. This supersedes the current tablet/mid-width minimum table widths and the
  phone rule that collapses the Types track.
- The existing fixed-layout `<colgroup>` remains the shared header/body sizing authority. The Web
  owner should assign a compact fixed sprite track, bounded name and Types tracks, and seven equal
  stat tracks using percentages or `calc()` so their total, padding, and borders fit the scroll
  container. Content must not determine column width after paint.
- Forty-four-pixel sort targets are preserved through header height and full-track buttons; their
  column widths need not exceed 44 pixels when the full button box remains at least 44 CSS pixels in
  both dimensions. The narrowest accepted tablet layout must prove this geometrically.
- Centering uses cell/button flex or text alignment inside the existing semantic table. It does not
  add a second row role, nested interactive element, or absolute overlay.
- Full versus abbreviated stat labels should be selected by an explicit responsive rule that
  reflects available split-pane width, not by clipping text. In every variant, label plus reserved
  arrow stays contained and centered.
- Removing `background: var(--color-canvas)` from `.pokemon-table__sprite img` is sufficient because
  the canonical compact WebP sprites already have alpha. No asset or request path changes.
- The Shiny SVG declares `currentColor`, but an external `<img>` does not inherit its parent button's
  CSS color into the SVG document. A component modifier plus a white-rendering CSS treatment is the
  smallest change that preserves reviewed bytes. Its inactive/active backing must be measured for
  visible contrast in both themes; do not apply the filter to the other four icon assets.
- The replacement source fingerprints are:

  - Special:
    `541a9bf1efb9a94ec9a292ea33afcd95ac6c4d7b38ebddbbbd506693048a77a9`.
  - Status:
    `8cc0aec5fe120ab7c21034cbe84e8f18f5349dcba7453c25c1313cb57381e331`.
- `src/web/ASSET_PROVENANCE.md` and the asset-safety test replace only the prior Special and Status
  hashes; the other three fingerprints and user-created 2026-10-16 provenance remain authoritative.
- Existing geometry, rendered-glyph, lazy-sprite, exactly-once row activation, and asset HTTP/decode
  tests are extended rather than replaced.

## Scope and ownership

### Web GUI coder

Own all implementation and test changes under `src/web`:

- Update `src/web/static/web/css/pokedex.css` with centered non-sprite table content, compact
  desktop/tablet column allocation, phone-only overflow, visible phone Types, transparent miniature
  sprite backing, and Shiny-specific white/contrast presentation.
- Update `src/web/src/app.tsx` only if a Shiny icon modifier, responsive label markup, or centering
  wrapper is required. Preserve semantic table markup and row/name activation paths.
- Update `src/web/src/icons.tsx` only as needed to expose a stable Shiny-specific class while keeping
  the shared decorative-image contract.
- Replace only `src/web/src/assets/pokedex-icons/special-move.svg` and `status-move.svg` with the
  exact supplied SVGs. Do not copy any `Zone.Identifier` companion.
- Update `src/web/ASSET_PROVENANCE.md`, `src/web/src/assets.test.ts`, component tests, performance
  tests only if their locators change, and `src/web/tests/e2e/pokedex.spec.ts`.
- Do not edit `src/backend`, `src/data`, `deploy`, packages, lockfiles, Vite configuration, generated
  Vite output, reference inputs, or unrelated documentation.

### Web GUI reviewer

Review `src/web` read-only for semantic centered layout, dense-track readability, exact breakpoint
behavior, touch/focus targets, whole-row selection, transparent sprite presentation, Shiny
contrast, exact Special/Status bytes, provenance and safety, and regression evidence. Return every
actionable finding to the Web owner until none remain.

### Architect

Own this plan, the final cross-scope and plan-compliance review, and the completed cycle report.
Confirm the implementation remains Web-only and does not weaken the prior asset or interaction
contracts.

### Deployment agent

No deployment change is planned. The deployment agent owns final repository checks, production
build validation, isolated Chromium and real Firefox browser runs against the local review stack,
temporary artifact cleanup, and the local cycle commit. It returns Web defects to the Web owner
rather than editing `src/web`.

## Data and interface impact

- No endpoint, payload, model, migration, normalized data, sprite, regulation, authentication,
  cache, or active-version behavior changes.
- No dependency, package, lockfile, Vite entry/configuration, manifest, template, runtime image,
  environment variable, or deployment change.
- The existing Special and Status asset URL imports remain stable at source level; their content
  hashes and emitted filenames naturally change because the reviewed SVG bytes change. Static
  serving remains under `/static/web/dist/`.
- Table classes may gain centering or Shiny-specific modifiers. They are internal Web contracts
  covered by component and browser tests, not backend interfaces.
- No persisted or cross-visit state changes. Rollback restores the preceding Web CSS/component,
  Special and Status SVGs, provenance, and tests without data migration or operational cleanup.

## Implementation sequence

1. Record current column widths, table/container `scrollWidth` and `clientWidth`, target sizes, text
   boxes, and sprite backgrounds at each supported browser viewport before changing layout.
2. Reallocate the `<colgroup>` and cell padding for ten contained tracks. Center name, Types,
   stat headers, reserved arrow groups, and numeric values; choose explicit label breakpoints that
   fit actual split-pane widths.
3. Remove desktop/tablet minimum widths that force overflow. Retain a fixed phone table width and
   horizontal scrolling at 40 rem or below, but restore the phone Types track so all ten columns
   remain available.
4. Remove only the miniature row-image background and verify alpha exposes normal, hover, selected,
   light, and dark row surfaces without layout or request changes.
5. Add the Shiny-only white rendering and inactive/active backing treatment. Verify contrast,
   focus, pressed state, and Mega isolation before replacing any asset.
6. Copy the new Special and corrected Status SVGs byte-for-byte, update both fingerprints and their
   provenance, and prove the owned asset directory excludes `Zone.Identifier` and all unsafe or
   external content.
7. Expand component and browser regressions, run the full frontend suite and production build, and
   capture representative light/dark screenshots across the complete viewport matrix.
8. The Web reviewer checks the complete change. After owner corrections, the architect reviews
   plan compliance and cross-scope boundaries.
9. The architect writes the cycle report. The deployment agent performs final isolated checks,
   removes temporary artifacts, and creates the local commit without a remote operation.

## Review and verification

### Component and asset checks

- Verify every non-sprite header and body cell receives centered presentation while the sprite
  column/image retains its exception. Assert name ellipsis/title/accessibility, centered one- and
  two-type groups, centered numeric spans, and unchanged semantic table structure.
- Exercise every stat through ascending→descending→inactive. Assert one active sort, exact
  ordering and `aria-sort`, a centered label-plus-indicator group, identical reserved indicator
  dimensions, no clipping, and inactive National Dex fallback.
- Prove row clicks from sprite, name, Types, and stat whitespace plus Enter/Space on the name still
  select exactly once and never trigger sorting.
- Assert the miniature image has no painted CSS background while retaining source URL, dimensions,
  lazy loading, empty alt, row geometry, and request count.
- Assert the Shiny image alone receives its white-rendering modifier. Preserve empty alt and parent
  action labels, `aria-pressed`, active background, focus, base/Mega transitions, and minimum target.
- Assert the replacement Special SVG matches
  `541a9bf1efb9a94ec9a292ea33afcd95ac6c4d7b38ebddbbbd506693048a77a9`,
  and the replacement Status SVG matches
  `8cc0aec5fe120ab7c21034cbe84e8f18f5349dcba7453c25c1313cb57381e331`.
  Assert both retain their supplied view boxes and declarations, pass the existing active/external-
  content checks, map only to their respective categories, and are the sole matching filenames in
  the five-file owned directory. Assert no `Zone.Identifier` filename exists there.

### Browser matrix and geometry

- Run all established isolated projects: Chromium desktop light, tablet dark/reduced-motion,
  900-pixel light, and phone light/reduced-motion; Firefox desktop light and tablet dark/reduced-
  motion. Record exact browser versions and project counts.
- In every desktop, tablet, and 900-pixel project above 40 rem, assert all ten headers and a
  representative row are visible and
  `tableScroll.scrollWidth <= tableScroll.clientWidth`. Repeat after each stat sort state, a filter
  combination, a row selection, and loading-to-ready where covered. Horizontal scroll offset stays
  zero because no horizontal range exists.
- At phone width at or below 40 rem, assert
  `tableScroll.scrollWidth > tableScroll.clientWidth`, Types and all seven stat columns exist and can
  be scrolled fully into view, and pointer/keyboard sort reveal remains functional.
- Measure header content and matching name/type/numeric content centers with rendered boxes. Require
  at most one CSS pixel difference, contained glyphs/badges, no overlap, and unchanged column/row
  boxes across inactive, ascending, and descending sorts.
- Assert every sortable header and native name button retains at least a 44 by 44 CSS-pixel target,
  visible contained focus, correct accessible name/title, and usable keyboard order at the narrowest
  non-phone and phone widths.
- Capture light/dark screenshots showing transparent miniature sprites over normal/hover/selected
  rows and the white Shiny icon in inactive and active states. Confirm the white stars remain
  distinct from their backing and the backing states remain distinguishable; do not infer contrast
  from source colors alone.
- Assert the Special and Status asset requests use the local static origin, return HTTP success,
  match their emitted content hashes, decode to nonzero dimensions, and produce no broken image,
  console error, failed request, or external request.
- Re-run existing geometry/CLS, lazy-sprite, modal, move Category, Mega/plain/X/Y/Z, selection,
  filtering, search, and responsive-detail critical flows.

### Commands and evidence

The Web owner runs the existing locked frontend commands from `src/web`: `npm run check`, the full
Vitest suite, and `npm run build`. The deployment agent runs the isolated Playwright matrix against
the local review stack and records browser versions, test counts, overflow measurements, target and
center geometry, screenshots, asset responses, console/network errors, and bundle sizes. The
architect and deployment agent each run `.codex/lint.sh` and `git diff --check` at handoff. No
external request is part of verification.

## Risks

- Ten columns can fit mathematically while labels or 44-pixel controls overflow internally.
  Explicit track budgets, abbreviation breakpoints, rendered-glyph containment, and narrowest-tablet
  browser measurements mitigate this.
- Centering the name button or type group can weaken ellipsis/containment if intermediate wrappers
  lack `min-width: 0`. Component and rendered-box tests cover long names and dual types.
- Restoring Types on phone increases the intentional scroll width. End-to-end reveal and keyboard
  tests ensure the complete table remains usable rather than merely present offscreen.
- A white icon disappears on a light inactive button unless its backing changes deliberately.
  Theme screenshots and measured contrast/state distinction gate acceptance while the SVG bytes
  remain unchanged.
- Reference metadata could be copied by a broad filesystem operation. Copying the two explicit SVG
  paths and asserting the exact owned directory listing prevent `Zone.Identifier` packaging.

## Completion criteria

- Every non-sprite table header and cell is centered on its matching track, with no overlap,
  clipping, wrapping, sort movement, semantic regression, or loss of full accessible text.
- All ten columns fit with `scrollWidth <= clientWidth` in every supported desktop/tablet/900-pixel
  Chromium and Firefox run; horizontal overflow exists only at 40 rem or narrower.
- Phone retains all ten columns and can scroll to Types and every stat with functional pointer,
  touch, focus, and keyboard behavior.
- Miniature sprites expose their existing alpha over row backgrounds without asset, loading,
  geometry, request, or selection changes.
- The Shiny icon renders white and remains visible in active/inactive light/dark states while all
  labels, focus, touch, pressed, and form behaviors pass.
- The Special and Status SVGs are byte-identical to the newly supplied files, have the recorded new
  fingerprints, pass safety/HTTP/decode checks, and no `Zone.Identifier` artifact enters `src/web`.
- Complete frontend checks, production build, browser matrix, Web review, architect review,
  documentation lint, final validation, cycle report, and local commit complete with no unresolved
  finding or unrecorded deferral.

Remaining material questions: none.

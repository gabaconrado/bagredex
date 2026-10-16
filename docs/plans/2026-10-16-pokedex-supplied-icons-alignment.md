# Pokédex supplied icons and alignment

## Summary

Correct the Pokémon-list stat headings shown clipped and misaligned in
`references/screenshots/Screenshot 2026-10-16 131051.png`, anchor the selected-form controls to a
stable sprite frame, and replace the locally authored inline icon geometry with the five SVGs
supplied by the user under `references/icons`.

This is a Web-only presentation refinement. It preserves the current Pokédex data, sorting,
selection, row activation, form switching, responsive table, and accessibility contracts while
making the supplied assets reproducible and attributable inside the Web bundle.

## Goals

- Make every stat heading readable and horizontally aligned with its numeric column without
  changing geometry when a sort becomes active or inactive.
- Keep the stat controls at least 44 CSS pixels and retain stable horizontal scrolling at desktop,
  tablet, 900-pixel, and phone widths.
- Position the Shiny and form controls at the fixed left edge of the stable selected-sprite frame,
  independent of transparent artwork bounds, form, or Shiny state.
- Package the supplied Mega, Shiny, Physical, Special, and Status SVGs as first-party Web build
  inputs without changing their geometry or color declarations.
- Record the supplied assets as user-created Bagredex inputs with no third-party provenance claim.
- Preserve all behavior completed in the preceding Pokédex table and icon correction cycle.

## Non-goals

- Redrawing, simplifying, optimizing, recoloring, inlining, or otherwise editing the supplied SVG
  content during this first review.
- Treating an SVG's colors as `currentColor`, applying CSS filters, or adapting its palette per
  theme. The supplied file declarations remain authoritative even where a file itself contains
  `currentColor`.
- Adding an external asset, request, icon service, dependency, package, lockfile change, build
  entry, or network lookup.
- Changing stat or move sort keys, direction cycles, stable ties, fallback order, row selection,
  keyboard behavior, Category presentation, move modal behavior, or Mega/Shiny semantics.
- Changing the overall table columns, wrapping labels or values, hiding additional columns, or
  replacing the established phone and mid-width horizontal-scroll behavior.
- Changing Django templates, backend endpoints, transport schemas, normalized data, sprites,
  authentication, regulations, deployment, or generated Vite output by hand.

## User-visible behavior

### Pokémon stat columns

- On widths where the table has room, the seven sortable columns visibly read `HP`, `Attack`,
  `Defense`, `Sp. Atk`, `Sp. Def`, `Speed`, and `BST`. No first or last character is clipped.
- At constrained widths, deliberate visible labels `HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`, and
  `BST` may be used. Each control retains its full stat name and sort action in its accessible name
  and exposes the full label through `title`.
- Each stat header and its body values occupy the same fixed column track. The header content uses
  the same right-side inset as the numeric cells so its content group and numbers share a
  predictable horizontal anchor; tests compare their right edges or intended centers rather than
  relying on visual approximation.
- The native header button fills its column and remains at least 44 by 44 CSS pixels. Text,
  indicator, padding, and borders are included inside the track with `box-sizing: border-box`; no
  positive inline margin can push the button outside its cell.
- Every header always reserves one identical indicator slot. An inactive arrow is visually hidden
  but remains measured; ascending and descending arrows occupy that same slot. Sort activation
  therefore changes neither column widths nor scroll position.
- Wide and constrained labels stay on one line and remain contained. Phone and mid-width tables
  continue to scroll horizontally with their established fixed minimum width; sorting does not
  reset or jump a pointer user's horizontal position, and keyboard focus still reveals the control.

### Selected-form controls

- The selected sprite is placed in a stable, square frame with the current maximum size and
  `object-fit: contain`. Transparent pixels or narrow/wide artwork do not affect layout.
- The Shiny and available Mega controls form a row immediately beneath that frame. The row has the
  same responsive width as the frame and is left-aligned to the frame's outer left edge, evoking
  the earlier left-positioned Mega control rather than centering beneath visible artwork.
- The control row's x position and its vertical start remain fixed across normal/Shiny changes,
  base-to-Mega changes, Mega-to-base changes, and forms with different intrinsic artwork. Its
  contents may differ by form, but the first control starts at the same coordinate within one
  viewport.
- Existing 44-pixel targets, focus indicators, titles, accessible names, `aria-pressed` state,
  active background, Shiny independence, and base↔Mega behavior do not change. Plain Mega shows no
  letter; X, Y, and Z variants show only their respective marker.

### Supplied icons

- The Web bundle uses these exact mappings:

  - `mega-evolution.svg` for every Mega control;
  - `shiny.svg` for the Shiny control;
  - `physical-move.svg` for Physical move rows;
  - `special-move.svg` for Special move rows;
  - `status-move.svg` for Status move rows.
- All five keep their supplied `viewBox="0 0 48 48"`, vector geometry, gradients, fills, strokes,
  and color declarations. They are rendered as image assets through Vite-generated URLs, not copied
  into the DOM as inline paths; host `color`, `fill`, `stroke`, or filter styles do not recolor them.
- Icon images inside already-labelled controls or cells are decorative, use empty `alt`, and are
  excluded from the accessibility tree. The surrounding button or visually hidden cell text
  remains the single accessible name.
- The move table still visibly labels its sortable header `Category`, while row category values
  remain icon-only visually. All five images load locally with no failed or external request.
- Light and dark review records the supplied colors at actual rendered size. Poor palette adaptation
  is reported as an observation for user review, not silently corrected in this cycle.

## Decisions and assumptions

- The supplied screenshot demonstrates a sizing defect, not missing text: a stat header currently
  contains an overflow-hidden wrapper around a separately fixed and margined button. At narrow
  tracks, the right-aligned box clips its leading characters. The correction makes the control fill
  the column and places label and permanently reserved indicator inside that one box.
- Full and abbreviated visual labels are explicit markup variants or a typed label mapping selected
  at a CSS breakpoint. CSS clipping is not used as an abbreviation strategy. The accessible label
  is always based on the full stat name plus current sort action/direction.
- The existing `<colgroup>` remains the source of shared header/body widths. Responsive CSS may
  adjust stat-track width or the label variant, but it must not give corresponding header and body
  cells different tracks.
- The sprite image and form controls move into one stable stage wrapper. A square frame with a
  reserved aspect ratio supplies the positioning reference; the controls align to that wrapper,
  never to intrinsic image pixels or the number of available Mega choices.
- The authoritative build inputs will be copied byte-for-byte into
  `src/web/src/assets/pokedex-icons/` and imported as URLs from TypeScript. Vite emits content-hashed
  files into its existing generated `static/web/dist` graph; generated files remain unedited.
- The input fingerprints are:

  - Mega: `299f931e037e96aedc68ccd40c5038a8258a40c339a1ad49c53a61de193c15ac`;
  - Physical: `4f73e0b23df40523c63d57e34eaf3af958e9c32310a609136375575b99caaae6`;
  - Shiny: `bf78e73fbbb38103302779d89792bb80d2ccd3b4beaccf9e557bf7b38b7c5430`;
  - Special: `c4adeb63d4767a301515fcb6f083e6b9412f83250b0eb59b0a1d07be66291ab0`;
  - Status: `7df5db865c299dbd75b7188aedc14db404565c187b3c057e54c3da5592bb9a1a`.
- These fingerprints define the first-review assets and make accidental editing detectable. They
  are not third-party provenance. The new `src/web/ASSET_PROVENANCE.md` records that the user
  created and supplied the five files to Bagredex on 2026-10-16.
- Asset validation rejects scripts, event-handler attributes, `foreignObject`, remote/data URLs,
  and external `href`/`url()` targets while allowing Mega's internal fragment gradient references.
  Files and copied filenames must not include Windows `Zone.Identifier` alternate-stream artifacts.
- The supplied SVGs already contain their own accessibility metadata in some cases, but rendering
  them through decorative `<img alt="">` elements makes the surrounding Bagredex control/cell the
  accessibility authority and prevents duplicate announcements.
- Existing sort and row-selection reducers require no change. Browser geometry helpers and isolated
  Playwright execution from prior cycles are extended rather than replaced.

## Scope and ownership

### Web GUI coder

Own every implementation and test change under `src/web`:

- Copy the five reference SVGs exactly into `src/web/src/assets/pokedex-icons/`, import them through
  the existing Vite graph, and replace the corresponding inline geometry in
  `src/web/src/icons.tsx` with decorative image rendering. Remove obsolete path geometry rather than
  retaining two icon sources.
- Add `src/web/ASSET_PROVENANCE.md` with filenames, user-created/supplied date, the recorded
  fingerprints, and an explicit statement that no third-party source or license claim applies.
- Update `src/web/src/app.tsx` only as needed for full/short stat labels, accessible sort names,
  image-based icon mappings, and a shared sprite-stage/frame/control-row structure.
- Update `src/web/static/web/css/pokedex.css` for contained stat controls, shared alignment and
  reserved arrows, responsive label selection, stable scrolling, the fixed sprite frame, and its
  left-aligned control row.
- Set the existing Vite build's public base to `/static/web/dist/` in
  `src/web/vite.config.ts` so emitted icon URLs use the same Django static-server prefix as the
  entry bundle, and document that internal asset contract in `src/web/README.md`. Do not add a new
  entry or change the manifest/output directory.
- Extend `src/web/src/app.test.tsx` and `src/web/tests/e2e/pokedex.spec.ts`. Add a focused asset-safety
  unit test under `src/web/src` if that keeps file validation separate from component behavior.
- Do not edit `src/backend`, `src/data`, `deploy`, package files, lockfiles, reference inputs, or
  generated Vite output manually.

### Web GUI reviewer

Review `src/web` read-only for byte-preserved asset mapping and safety, accessible image semantics,
header containment/alignment, control sizing, sprite-stage geometry, responsive scrolling, theme
legibility observations, and regressions in sorting, row selection, and form state. Return all
actionable findings to the Web owner until no blockers remain.

### Architect

Own this plan, the final plan-compliance review, and the cycle report. Confirm that implementation
remains Web-only and that provenance accurately describes user-created inputs without inventing an
external source or license.

### Deployment agent

No deployment change is planned. The deployment agent owns final repository checks, production
build validation, isolated real Chromium and Firefox runs against the local review stack, temporary
browser-artifact cleanup, and the eventual local commit. It returns Web defects to the Web owner
rather than editing `src/web`.

## Data and interface impact

- No backend, endpoint, bootstrap/detail payload, model, migration, normalized-data, sprite,
  regulation, authentication, cache, or active-version behavior changes.
- No package, lockfile, build entry, template contract, deployment, or runtime dependency changes.
  The existing Vite configuration declares `/static/web/dist/` as its public base so the five
  imported files become hashed build outputs under the existing manifest/static contract instead
  of resolving at a site-root `/assets/` URL.
- Preact icon components retain their current caller-facing purpose; implementation may narrow them
  to decorative images because accessible labels remain on their parent controls/cells.
- New full/short label mappings are presentation metadata only. Stat keys, values, sorting order,
  tie-breaking, `aria-sort`, and local state do not change.
- `src/web/ASSET_PROVENANCE.md` is the authoritative provenance record for these five Web assets.
  Rollback removes the new source assets and restores the prior Web components/CSS without any data
  migration or operational cleanup.

## Implementation sequence

1. Reproduce the clipped header state from the supplied screenshot at desktop, tablet, 900-pixel,
   and phone widths. Record each stat column, button, label, indicator, and representative numeric
   value box before selecting final insets and breakpoints.
2. Refactor the stat header so its button fills the `<colgroup>` track and contains an explicit
   label slot plus permanently measured arrow slot. Add deliberate full/short markup and verify
   alignment, 44-pixel sizing, horizontal-scroll preservation, and unchanged sort semantics.
3. Introduce the stable sprite-stage wrapper and square frame, then align the form-control row to
   its left edge. Verify stable x/y placement before changing icon rendering.
4. Copy the five SVGs byte-for-byte into the owned asset directory, record their provenance and
   fingerprints, validate their safety, and replace inline icon paths with Vite URL imports and
   decorative images.
5. Verify move Category, icon-only row values, plain/X/Y/Z Mega markers, active states, whole-row
   selection, keyboard paths, and sorting remain unchanged.
6. Expand component and browser regressions. Run static tests and the production build, then capture
   comparable light/dark screenshots at all required browser/viewports.
7. The Web reviewer inspects the implementation and evidence. After owner corrections, the
   architect checks scope, interface stability, provenance, and plan completion.
8. The architect writes the report. The deployment agent runs the final isolated browser and
   repository checks, removes temporary artifacts, and creates the local cycle commit without any
   remote operation.

## Review and verification

### Asset and component checks

- Assert all five owned SVG files exist, retain `viewBox="0 0 48 48"`, and match the recorded input
  fingerprints. Assert the expected file maps to each Mega, Shiny, Physical, Special, and Status
  use; no old inline icon geometry remains.
- Parse or inspect raw SVG input to reject script, inline event handlers, `foreignObject`, remote or
  data URLs, and non-fragment references. Verify no `Zone.Identifier` file or filename is present.
- Verify icon elements are decorative images with empty alt text inside controls/cells that retain
  exact accessible names. Ensure no duplicate image title is announced.
- Exercise all seven stat sort buttons through ascending→descending→inactive. Assert one active
  sort, correct `aria-sort`/accessible action, unchanged deterministic ordering, and inactive
  National Dex fallback.
- Verify wide visible labels and constrained abbreviations map to the full accessible labels and
  titles. The indicator node remains present and measured in all three states.
- Prove Category remains visible and sortable, move rows remain icon-only with accessible category
  names, plain Mega has no marker, X/Y/Z retain only their marker, and whole-row pointer plus native
  name-button keyboard selection still activate exactly once without sorting.

### Browser and visual checks

- Run isolated Chromium and real Firefox projects at desktop, tablet, phone, and the established
  900-pixel regression viewport. Cover both light and dark themes and reduced motion where current
  projects support it.
- For every stat at every viewport, assert the visible label box is contained by its header/button,
  no first or last glyph is clipped, the control is at least 44 by 44 pixels, and the intended
  header/numeric right edge or center alignment differs by no more than one CSS pixel.
- Cycle every stat sort at a nonzero horizontal scroll offset. Assert table, columns, header, list,
  detail, toolbar, scrollbar, and scroll offset stay within the existing one-pixel geometry
  tolerance; inactive/active indicator boxes have equal dimensions.
- Select diverse short, wide, tall, base, Mega, X/Y/Z, normal, and Shiny sprites. Measure the sprite
  frame and first toggle before and after each transition; their left edges and the row's vertical
  start differ by no more than one CSS pixel at a fixed viewport.
- Click/tap the controls on desktop, tablet, and phone, and verify touch size, visible focus,
  accessible labels, active backgrounds, exact form transition, and Shiny independence.
- Observe all five supplied icons at actual rendered size in both themes without applying a
  recolor. Assert every emitted local asset request succeeds, the browser makes no icon request to
  another origin, and screenshots contain no broken-image marker.
- Recheck sprite/type/stat-whitespace row selection, Enter/Space on the name control, header
  independence, sticky header, lazy row sprites, phone/mid-width scrolling, and selected-row state.

### Commands and evidence

The Web owner runs the repository's existing locked frontend commands from `src/web`, including
format/lint/type checks where defined, the complete unit/component suite, and `npm run build`. The
deployment agent runs the established isolated Playwright projects against the local review stack;
it records browser versions, project counts, geometry measurements, screenshots, console/network
errors, and generated bundle sizes. The architect and deployment agent each run `.codex/lint.sh`
at their handoff. No external request is part of verification.

## Risks

- A fixed-width label plus arrow can reproduce the clipping if margins are reintroduced. Filling
  the cell, including padding in its box, and testing actual glyph containment mitigates this.
- Responsive abbreviations could diverge from accessible text. One typed stat-label mapping with
  explicit full, short, and action labels prevents parallel ad hoc strings.
- An SVG can be visually local while referencing external content. Raw asset safety tests and
  browser request assertions cover both source and runtime boundaries while allowing internal
  gradient fragments.
- A byte-for-byte SVG copy may not adapt ideally to both themes. The explicit requirement to keep
  supplied colors takes precedence; screenshots record the result and any future palette revision
  requires separate user approval.
- Control placement may still move if tied to image height or control count. A reserved square frame
  and a same-width sibling control row provide a stable coordinate system.
- Imported assets increase emitted files and requests. The files are small local vectors, remain
  cacheable/content-hashed, and require no new dependency; the final build records their sizes and
  confirms every request succeeds.

## Completion criteria

- The supplied screenshot defect is corrected: no stat label clips, every header aligns with its
  value track, controls remain at least 44 pixels, and inactive arrows stay hidden but reserved.
- Full labels appear where space permits; deliberate constrained labels retain full accessible
  names/titles and stable horizontal scrolling.
- The toggle group's position is anchored to the stable sprite-frame left edge and remains within
  one pixel across representative form, Mega, and Shiny transitions at all required viewports.
- All five supplied SVGs are packaged through Vite from owned source files, match the recorded
  fingerprints, pass source/runtime safety checks, retain supplied colors/geometry, and generate no
  failed or external request.
- Provenance records the files as user-created and supplied on 2026-10-16 with no third-party source
  claim; no `Zone.Identifier` artifact exists.
- Category/icon-only move rows, plain/X/Y/Z Mega display, sorting, row activation, focus, touch,
  theme, responsive, reduced-motion, and one-pixel geometry contracts pass without regression.
- Complete frontend checks, production build, isolated Chromium and Firefox projects, Web review,
  architect review, Markdown lint, final local validation, cycle report, and local commit complete
  with no unresolved blocking finding or unrecorded deferral.

Remaining material questions: none.

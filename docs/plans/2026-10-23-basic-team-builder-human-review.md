# Basic team builder human-review refinements

## Outcome

Apply the accepted browser-review rounds to the completed basic team builder. Make team creation
immediate, keep the team library anchored and visually stable, enrich saved-team cards with roster
miniatures, align the builder form, and refine loading, confirmation, and autocomplete validation
after the user's second pass. The third pass compacts each member card, reuses Pokédex form
controls and information patterns, and makes selected mechanics clearer. The fourth pass tightens
the nickname contract, embeds information actions, and adds compact keyboard-navigable member
cards. The fifth pass replaces the persistent nickname field with accessible inline editing and
makes numeric slot navigation center the post-expansion layout in one press. The sixth pass adopts
the supplied information icon, keeps field Tab order compact with an equivalent keyboard command,
and exposes all valid autocomplete choices on empty-field focus. The seventh pass aligns expanded
nickname ordering with collapsed cards. The eighth pass replaces the Team Builder's bespoke
Pokémon-picker field and card grid with shared Pokédex search-field and result-list primitives while
retaining Team Builder selection rules. The ninth pass makes save validation independent of whether
collapsed member editors happen to be mounted. The tenth pass completes the picker list with base
stats, reliable scrolling, explicit filter categories, and Pokédex-style category navigation. The
eleventh pass presents Pokémon results as an accessible stat-sortable table without changing the
filter or add transaction. The twelfth pass keeps Pokémon identity and Types on the same horizontal
table line as the stat headings and values. The thirteenth pass folds smaller Types metadata beneath
the Pokémon name so the stat table fits normal phone widths without horizontal scrolling. The
fourteenth pass reallocates table width from oversized stat columns to readable Pokémon identity and
stacks each sort indicator beneath its stat label.

This is a focused refinement of the completed feature, not a new feature cycle. Keep the active
human-review session and its data intact. After implementation, run focused checks and reload the
session for another user pass. Independent review, full validation, the supplemental report, and a
follow-up commit remain deferred until the user explicitly finishes human review.

## Evidence and current behavior

- `references/screenshots/Screenshot 2026-10-22 203541.png` shows the team-name toolbar wider than
  the member card below it. Within the member card, labels and inputs begin on inconsistent columns:
  Nickname and Ability share a row but have different label placement, Item occupies only the left
  portion, and the move and nature controls do not follow one stable field grid.
- The current New Team action uses `window.prompt`, so it interrupts the page rather than opening a
  draft and moving keyboard focus to the editable name.
- The empty library repeats creation with a **Create your first team** control, and the empty
  workspace contains another New Team control.
- The library card exposes a Pokémon count but no roster imagery. Its bootstrap summary lacks the
  member facts required to render sprites pinned to retained data versions.
- The team-builder shell overrides the centered `.site-main` only through `:has()`. The island also
  replaces the entire two-column application with a centered loading state when no dataset has yet
  loaded. Those layout modes can move or temporarily remove the sidebar during initial load or
  team selection.
- After the first round, opening a team still renders a `Loading <team>` notice instead of one
  centered visual progress indicator, and the sidebar repeats the regulation already shown in the
  application header.
- Dirty-state navigation is guarded independently by browser confirms and `beforeunload`. A
  confirmed in-app navigation can therefore encounter a second native prompt as the actual
  navigation begins. Delete also still uses a browser confirm.
- Autocomplete text currently clears the stored identifier as soon as display text diverges, then
  silently becomes blank on blur. Invalid non-empty Nature, Ability, Item, or Move text is not kept
  visible with a field error, even though the backend correctly validates submitted canonical IDs.
- The member header conditionally replaces the species name with a nickname, while the Nickname
  field consumes a full body-grid cell. Shiny and Mega preview remain labeled checkboxes rather
  than the round icon controls already established by the Pokédex.
- Mega preview changes the sprite and stats, but the disabled Ability input continues to show the
  stored base ability while the Mega ability is repeated separately below the stats.
- Nature records already contain exact increased/decreased stat IDs, and Mega relations already
  identify the target ability. The builder dataset exposes only names for Ability, Move, and Item.
  Normalized Ability and Move descriptions exist in the database, but normalized Item records have
  no description field in the current bundle or model.
- The current header nickname displays a non-persisted species fallback beside the species heading
  and still permits 12 characters. The requested control is above the species name, visually
  unlabeled, empty by default, and limited to 10 characters.
- Every populated member currently renders its complete editor. There is no per-slot collapsed
  summary or numeric slot shortcut, so larger saved teams remain visually long.
- The server-rendered island fallback contains a visible **Team Builder / Loading your teams…** live
  region. It must exist only before the island owns the root; stale fallback or duplicate status
  output must not remain at the end of the mounted page.
- The round-four nickname is a persistent bordered text field, which is visually heavy in the card
  header. The desired presentation is plain inline text until editing, without removing nickname
  editing from keyboard focus order.
- The current `1`–`6` handler requests expansion and scrolls in the next animation frame. That frame
  may still observe collapsed geometry, causing an initial jump and requiring a second key press to
  center the expanded card.
- The user supplied `references/icons/information-circle.svg`. Current Pokédex information marks
  use text `i`, and Team Builder field controls also render text `i`; neither uses the approved
  first-party geometry.
- Team Builder autocompletes open on focus, but their listbox is rendered only when query text is
  non-empty and results are capped at 30. An empty Ability, Item, or Move therefore shows no initial
  valid-choice list.
- In the current expanded-card header, the inline Nickname control precedes the species heading.
  The collapsed identity renders species first and nickname second, so the two states reverse the
  same information hierarchy.
- The current Pokémon picker implements its own plain labeled input and three-column result-card
  grid. The Pokédex independently owns a polished search field, anchored listbox, active-option
  styling, live result feedback, scrolling, and keyboard interaction. The picker already has all
  required regulation-pinned forms, sprites, types, moves, abilities, and types in `BuilderData`;
  it does not need another request or contract field to adopt that presentation.
- Save currently calls `assignExact` for each autocomplete by looking up its input ID in the live
  DOM. Collapsed members do not mount those inputs, so the lookup supplies empty text and rewrites
  their valid canonical Ability, Item, Move, and Nature IDs to null in the cloned payload. Nature
  then fails required validation. Expanding the cards mounts inputs initialized from the canonical
  IDs, which explains why the same unchanged team saves only after expansion. Reordering is not the
  cause, but changes position-derived input IDs and exposes the same mount-dependent flaw.
- The round-eight picker list is inside a max-height CSS grid whose parent clips overflow, but the
  list grid item has its default intrinsic `min-height: auto` and no explicit shrinking row. The
  list therefore grows to its content height and is clipped by `.pokemon-palette` instead of
  receiving a bounded used height for its own `overflow: auto`; wheel/touch scrolling appears not
  to work. Active-option `scrollIntoView` exists, but cannot repair that sizing failure.
- Picker forms already contain all six base stats. BST is not a separate BuilderData field, but is
  the deterministic sum of those six values, so the requested row details require no contract or
  backend change. Current filter matches are flattened under **Matching filters** even though the
  Pokédex groups them as **Moves**, **Abilities**, and **Types**, and the picker does not implement
  the Pokédex's Alt+Arrow category jumps.
- The Pokédex already renders a native Pokémon table with sortable stat-column buttons, `aria-sort`,
  descending → ascending → default cycling, horizontal overflow containment, and compact stat
  labels. Its components are coupled to Pokédex form/detail selection, so the reusable boundary is
  table structure/sort metadata and stat presentation rather than importing the whole Pokédex
  component into the Team Builder island.
- The round-eleven markup already puts Pokémon, Types, and every stat in one semantic header row and
  one `<tr>` per form. The remaining defect is CSS sizing: the name and joined type text have no
  explicit non-wrapping/minimum-column invariant, so the browser can wrap or visually stack them
  while squeezing the table. This round corrects layout only; it does not require different data or
  flattened table semantics.
- Round twelve retained a dedicated Types column and treated horizontal scrolling as the narrow
  viewport solution. The user prefers the earlier picker's compact identity treatment: sprite and
  name, with smaller Types below the name. Types are descriptive metadata for the Pokémon row rather
  than an independently sortable measure, so placing them inside the row-header cell is semantically
  honest and removes one wide table column.
- `references/screenshots/Screenshot 2026-10-23 205417.png` (1515 × 1029) shows the picker at a wide
  desktop viewport: each of the eight columns is rendered at roughly equal width, stat cells consume
  far more space than their two/three-digit content needs, and the sprite leaves the Pokémon identity
  copy only enough room for an initial plus ellipsis on both name and Types. The fixed-layout CSS
  assigns `clamp()` widths to `<col>` elements whose combined result is not producing the intended
  identity/stat ratio in the browser; the rendered geometry, not missing text, causes unreadability.

## Goals

- Replace the oversized labeled New Team control in the library header with one compact `+`
  floating-action-style button.
- Remove the redundant **Create your first team** empty-list control.
- Open a new local draft directly, with a server-derived default name and the whole team-name value
  focused and selected.
- Keep the left team library at the left edge of the page and preserve its geometry while opening a
  team or loading a retained dataset.
- Make saved-team cards larger and show name, last-saved date, and up to six ordered Pokémon
  miniatures; remove the Pokémon-count copy.
- Align member fields into an intentional responsive grid and make the team-name toolbar share the
  same content width as member cards.
- Replace text-only team loading with one centered visual spinner and remove the duplicate sidebar
  regulation label.
- Use accessible branded confirmations for discard and delete, with exactly one confirmation for a
  confirmed in-app navigation.
- Keep autocomplete text honest: each affected field is blank or resolves to one current option;
  invalid non-empty text remains visible and is identified before Save.
- Put an accessible inline nickname editor with the species name in the member header, use Pokédex
  icon toggles for Shiny/Mega, show the active Mega ability in the Ability field, and annotate
  Nature labels with their stat changes.
- Add consistent information affordances to Ability and Move fields using the Pokédex's accessible
  preview/dialog interaction. Defer the Item information control by explicit user decision.
- Open saved members as compact read-only cards with deliberate expand/collapse and `1`–`6`
  navigation, while newly inserted members remain ready for immediate editing.
- Limit supported nickname writes to 10 characters and remove the visible header label/species
  fallback.
- Present Nickname as an accessible inline edit aligned with species, and make one numeric shortcut
  press expand and center its populated slot after layout commits.
- Reuse the supplied information-circle asset across Pokédex and Team Builder, preserve clean field
  Tab order with equivalent keyboard access, and show every valid option when an empty Ability,
  Item, or Move receives focus.
- Match expanded and collapsed identity ordering by placing the inline Nickname control directly
  beneath the species heading without changing its editing behavior or the other header controls.
- Reuse shared Pokédex search-field, stat-table, and filter-list primitives in the Team Builder
  Pokémon picker while preserving available-species exclusion, filters, default alphabetical
  ordering, dialog lifecycle, and add-member behavior.
- Validate and serialize every member from persistent island state, so valid saved values remain
  valid through collapse and reorder without mounting an editor as a normalization side effect.
- Make picker rows decision-complete and navigable: show all base stats plus BST, restore bounded
  scrolling, label each result category, and mirror Pokédex Alt+Arrow group navigation.
- Present Pokémon picker matches in a sortable table while preserving one coherent active-result
  keyboard model across the Pokémon table and Move/Ability/Type filter suggestions.
- Keep Pokémon identity, Types, and all stat columns aligned on one horizontal header/row line;
  narrow viewports scroll the intact table instead of stacking identity/types above stats.
- Integrate compact Types metadata into the Pokémon identity cell and fit Pokémon plus all seven stat
  columns within the dialog at supported phone widths without hiding values or normal horizontal
  scrolling.
- Prioritize readable identity width and make stat columns content-compact; use two-line sort headers
  so an inline arrow never widens a stat column.

## Non-goals

- Changing team persistence, validation rules, regulation pinning, list ordering, or explicit-save
  semantics.
- Reserving or persisting a new team before the user presses Save.
- Adding drag-and-drop, a component library, a new frontend framework, or new Pokémon data.
- Reworking the application header or unrelated Pokédex layouts.
- Changing Pokédex search results, filters, sorting, shortcuts, or detail selection as a side effect
  of extracting the shared search/list presentation.
- Changing canonical Pokémon-data identifiers, fuzzy-search behavior, or backend team legality.
- Fabricating held-item descriptions or widening this focused loop into a Pokémon-data schema,
  importer, generated-release, migration, and activation cycle.
- Running the finish-time review, full validation, report, or Git mutation before the user
  explicitly ends human review.

## User-visible behavior

### Team creation

- The **My Teams** header has a compact circular or rounded-square `+` button placed as the primary
  creation action. Its accessible name remains **New Team**, it has a visible keyboard focus state,
  and its touch target is at least 44 by 44 CSS pixels. The visible glyph is text or an existing
  code-native icon; do not introduce an image asset for it.
- Clicking or activating the control no longer opens a browser prompt. After the existing dirty
  draft confirmation, it opens an empty local draft in the workspace and focuses the Team name
  input. Select the complete default value so typing replaces it immediately.
- The default is `Team #`, where `#` is the signed-in user's current total saved-team count plus one,
  across all regulations and retained versions. Django computes the count for the bootstrap rather
  than inferring it from the regulation-filtered cards.
- Creation remains local until Save. The existing authoritative case-insensitive uniqueness check
  remains responsible for a stale or concurrent count: if another tab creates the same name after
  page render, Save returns the existing field error without losing the draft. Do not silently
  rename a submitted team.
- Within the current page lifetime, increment the next number after a successful creation. A
  deletion must not decrement or reuse the number. This prevents the UI from proposing the same
  default again after its own create/delete sequence while retaining the requested initial
  server-derived count.
- The team-library empty state keeps its explanatory text but has no **Create your first team**
  button. The empty workspace may keep its New Team action as a contextual action; it must invoke
  the same direct-draft and focus behavior, not a prompt.

### Stable left library

- The team-builder page uses an explicit page hook/class from the Django template to make
  `.site-main` full-width, unpadded, and left-aligned. Do not rely on `:has()` as the sole mechanism
  for changing the global centered-main behavior.
- The library is the first column at the viewport's content left edge on desktop, retains a stable
  declared width while team content loads, and does not move left or right when a card is opened.
- Loading a team or a retained dataset keeps the two-column shell and team library mounted. Show
  loading/error feedback inside the workspace and disable only actions that cannot safely proceed;
  do not replace the complete island with a differently sized centered state.
- Keep strong tablet behavior and functional phone fallback. At narrow phone widths the existing
  responsive stack may place the library above the workspace, but it must not overflow or obscure
  controls.
- Remove the regulation eyebrow from the team library because the global header selector already
  communicates the active regulation. Keep **My Teams** as the sidebar heading.
- Vertically and horizontally center the `+` glyph optically within its FAB. Do not rely only on the
  font's line box; verify the rendered glyph at normal browser zoom in both themes.

### Loading and confirmations

- While a team aggregate or its retained dataset loads, show one visual spinner centered in the
  workspace content area. Do not show `Loading <team>` or disclose the selected team name in a
  loading notice. Keep the library visible and stable, mark the workspace busy with
  `aria-busy="true"`, and provide a concise visually hidden live status such as **Loading team**.
- The same spinner treatment may cover initial/active-regulation dataset loading so loading has one
  visual language. Saving and deleting retain their specific button/status copy; error and success
  notices remain textual and announced.
- Replace browser `confirm()` for dirty-draft discard and permanent team deletion with an
  application-styled modal dialog inside the Preact root. Use distinct titles, consequences, and
  confirm labels (**Discard changes** and **Delete team**); cancel is the initial safe action.
- The dialog traps focus, focuses Cancel initially, closes on Escape as cancellation, restores focus
  to the initiating control, and uses `role="alertdialog"`, `aria-modal`, an accessible title, and
  description. Destructive confirmation has the existing danger styling.
- Route New Team, opening another team, delete, application links, regulation changes, and ordinary
  external forms through one asynchronous confirmation coordinator. Do not install competing
  per-action browser confirms.
- Keep native `beforeunload` only for an actual dirty tab close, reload, or browser navigation that
  cannot first be handled in-app. Once the branded dialog confirms an in-app URL or form
  navigation, arm a one-shot bypass before calling the navigation so `beforeunload` does not show a
  second prompt. Clear a bypass that does not result in navigation; never leave unload protection
  disabled while the dirty editor remains on the page.
- The regulation selector's cancelable `bagredex:navigate` event remains the coordination boundary:
  prevent it while confirmation is pending, then use its supplied same-origin URL exactly once
  after confirmation. Intercepted anchors and forms follow the same rule.

### Saved-team cards

- Each saved-team card is large enough for a name/date region and a six-slot miniature strip or
  grid. Show the team name and localized last-saved date. Remove the `n / 6 Pokémon` text.
- Display saved members in position order. Each filled slot shows the saved selected Pokémon form's
  miniature using the exact pinned data version and saved Shiny variant; empty positions use a
  quiet non-image placeholder so all cards retain the same roster geometry. Mega preview is not a
  persisted species choice and does not replace the selected base/non-Mega form in the miniature.
- Sprite images are decorative because the card's purpose is team selection; use empty `alt` text.
  The card itself retains its accessible team name and date, selected state, keyboard activation,
  and visible focus.
- The initial bootstrap and the summary built after Save have the same shape, so a saved roster is
  updated immediately without a reload.

### Builder alignment

- Constrain the toolbar and team-slot column to one shared workspace content width and align their
  horizontal edges. The toolbar must not be wider than the member cards.
- Use one predictable form grid inside each member card. Labels sit consistently above their
  controls; controls stretch to their grid cell; Nickname and Ability form a balanced row, Item and
  Nature use intentional cells, the four moves use a consistent two-column arrangement on desktop,
  and Stat Points spans the form width.
- Remove accidental duplicate declarations/markup encountered in the affected components. Preserve
  the existing keyboard sequence, autocomplete ownership, errors, sprite/stats display, member
  movement, and touch targets.
- At tablet and phone breakpoints, collapse fields without label/input overlap or horizontal
  scrolling. Verify both light and dark themes because the supplied evidence is dark-theme desktop.
- Correct remaining field alignment after the first round: every autocomplete wrapper and direct
  input uses the same label-above-control structure, row height, full cell width, and error-space
  behavior. Remove stray duplicate markup or braces in the touched component/CSS rather than
  compensating for them with layout offsets.
- Size each SP numeric input for the valid two-digit range `0`–`32`, center its text, and center the
  control in the numeric grid column. Preserve the 44-pixel minimum touch height, direct editing,
  linked slider, keyboard sequence, and room for validation errors.

### Autocomplete validity

- For Nature, Ability, Item, and each of the four Move fields, blank display text represents no
  selected identifier while editing. A non-empty value is valid only when it resolves to one of the
  choices currently supplied to that exact control.
- Options remain identified internally and over HTTP by their exact normalized canonical IDs.
  Users type display names: after trimming surrounding whitespace, a case-insensitive exact display
  name resolves to its option and is rewritten with canonical display casing. Clicking a result or
  accepting the highlighted result with Enter also resolves its canonical ID. A partial string is
  not accepted merely because it has one fuzzy result unless the user explicitly selects that
  result.
- On blur or attempted Save, retain invalid non-empty text and show a field-associated message such
  as **Choose a valid ability**. Set `aria-invalid` and connect the message with `aria-describedby`.
  Do not silently clear invalid text, advance keyboard focus, or serialize it as blank.
- Ability choices are the selected form's ability IDs, Item choices are the current pinned
  regulation's item IDs excluding an item held elsewhere, Move choices are the selected form's
  legal move IDs excluding duplicates, and Nature choices are the approved pinned-version nature
  IDs. If another edit removes a previously selected choice, invalidate that field visibly.
- Blank Ability, Item, and Move values remain valid domain values. Blank Nature is a valid editing
  state but remains invalid for Save because the persisted aggregate requires Serious or a
  stat-changing nature; newly added members still default to Serious. Surface that existing
  required-on-save error without changing the model.
- Save performs client validation for every member and focuses the first invalid autocomplete;
  it sends no request until invalid display text and existing local domain errors are resolved.
  Authoritative server errors remain mapped to the same fields and never discard typed text.
- Focusing a blank Ability, Item, or Move combobox opens its listbox immediately and displays every
  option currently valid for that exact field, not an empty panel or the first 30 only. Ability and
  Move remain filtered to the selected form; Item remains filtered to the pinned regulation and
  excludes items held elsewhere; each Move excludes duplicates selected in sibling move fields.
- Keep the valid empty-focus list in deterministic display-name/canonical-ID order and set the first
  option active without selecting it. Arrow keys navigate the complete list, Enter accepts the
  active option, Escape closes/blurs as already specified, and Tab leaves the field without
  inventing a selection. `aria-expanded`, `aria-controls`, active-descendant/listbox semantics,
  scroll-to-active behavior, exact canonicalization, and invalid-text retention remain consistent
  whether the query is empty or non-empty.
- Render only the one open listbox. Measure representative largest legal Move and Item lists before
  adding complexity; use a bounded-height scrolling list and lightweight rows, and virtualize only
  if observed typing/focus performance fails the existing responsiveness target. Non-empty search
  may retain a reviewed result cap only if the UI states that more matches exist; empty focus must
  make the complete valid set keyboard-reachable.

### Pokémon picker search and results

- Extract narrowly shared Web primitives for the Pokédex search text field, anchored suggestion
  surface, list/group rows, active styling, result status, and scroll-to-active behavior. Keep
  consumer-owned query derivation, filters, sorting, selection effects, shortcuts, and dialog
  lifecycle outside the primitives. Both consumers render those primitives; do not copy Pokédex
  markup/CSS into another Team Builder-only variant or couple the two island state trees.
- Replace the picker's three-column Pokémon card grid with the Pokédex text field and a native
  Pokémon results table. Reuse/extract Pokédex table primitives for column/stat metadata, sortable
  headers, cells, type presentation, and scrolling rather than duplicating a lookalike table. Keep
  row activation and Team Builder form types adaptable at the boundary; the dialog title, close
  control, result count, active filter chips, and modal focus boundary remain Team Builder-owned.
- Search continues to match normalized Pokémon display names. Matching Move, Ability, and Type
  suggestions use the shared grouped-list presentation; activating one adds its existing AND filter,
  clears the query, keeps the picker open, and returns focus to the search input. Active chips remain
  removable and are not cleared merely by searching or choosing another filter.
- The Pokémon table contains forms that match the query and every active filter and excludes a base
  species already on the team. Default order is display name then canonical form ID. Each stat
  header cycles default → descending → ascending → default, matching the existing Pokédex control;
  ties use display name then canonical ID in either direction so order is deterministic. Do not add
  name/type sorting because Pokédex does not establish it. Sort choice persists through query and
  filter changes while the dialog is open and resets to default on a new open.
- Opening the picker focuses the search field and shows the available alphabetized Pokémon list even
  when the query is empty. Arrow Up/Down moves through selectable rows with wraparound, keeps the
  active row visible, and updates `aria-activedescendant`; Enter adds the active Pokémon. Pointer
  click adds that Pokémon. Filter suggestions remain distinguishable grouped options and use the
  same activation path without accidentally adding the first Pokémon.
- The search control exposes accurate expanded/controls/active-descendant relationships to one
  results region containing the semantic Pokémon table and grouped filter suggestions. Give each
  Pokémon row a stable selection-control ID that can be the active descendant; mark active styling
  without misusing listbox `option` semantics on native table rows. Filter suggestions remain
  grouped list options. Announce active Pokémon name, types, and sort position through the existing
  live-status boundary. Validate this mixed table/list model with automated accessibility checks and
  real keyboard inspection; do not flatten the table back into faux list rows merely to retain CSS.
- Escape closes the picker. Tab/Shift+Tab enter sortable header/filter-chip/Close controls and stay
  within the modal focus trap without selecting a row; returning to search preserves the active
  Pokémon identity. Do not inherit a Pokédex-only `/` shortcut or change Pokédex keyboard behavior.
- Choosing a Pokémon keeps the existing transaction: add it to the requested empty position with
  Serious defaults, close the dialog, expand the new card, and focus/activate its inline Nickname
  editor. Cancel by Close, Escape, or backdrop adds nothing and restores focus to the exact empty
  slot that opened the picker. A full six-member team does not expose an add trigger.
- Keep distinct states inside the dialog: a concise loading/busy row only if picker data is ever
  pending, the complete available list for blank query, **No available Pokémon match every filter**
  when search/filtering returns none, and **No Pokémon available** when all legal base species are
  already used. Announce result-count changes without duplicating visible state copy. Dataset load
  failures remain the owning workspace's error and must not open an empty picker.
- At desktop, tablet, and supported phone widths the table is one readable vertical surface within
  the bounded dialog, with a sticky header inside the vertically scrolling results viewport. The
  normal layout must not need horizontal scrolling. Input, Close, sort, filter, row-selection, and
  focus targets retain usable dimensions.
- Remove the dedicated Types `<th>`/`<td>` column. The header row contains **Pokémon**, `HP`, `Atk`,
  `Def`, `SpA`, `SpD`, `Spe`, and `BST`. Each body row uses one `<th scope="row">` identity cell with
  sprite beside an identity text stack: species/form name on the first line and smaller type
  badges/names on the second. Types remain readable and part of the row header's accessible name or
  description; do not misrepresent them as a stat cell or duplicate them in hidden table columns.
- Use a compact table layout sized to the picker viewport: a flexible but bounded identity column,
  seven narrow numeric columns with tabular alignment, reduced cell gaps/padding at phone
  breakpoints, and the established short stat labels. Keep every stat visible. Species/form names
  may ellipsize visually only when necessary, with the full name retained in accessible text/title;
  dual types stay together on their smaller second line and must not collide with stats.
- Replace percentage/clamped `<col>` sizing that resolves to near-equal columns with an explicit
  identity-first allocation. Stat columns size to the widest short label or three-digit value plus
  minimal safe padding, remain equal to one another, and do not grow merely to fill surplus width;
  the Pokémon column receives the remaining table width. At the supplied screenshot geometry, the
  identity column must be at least 18rem and each stat column no wider than 4rem, absent an observed
  browser-font constraint documented during implementation.
- Render each sortable header as a compact two-line button: short stat label centered on the first
  line and the current direction indicator centered below it. Reserve the second line in every stat
  header so sorting does not shift height or column width; an inactive transparent/hidden indicator
  keeps geometry stable. The arrow is decorative, while `aria-sort` on `<th>` and the button's
  accessible name continue to expose current direction.
- Preserve a usable sort target without forcing a wide column: the button fills its entire stat
  header cell and provides at least 44 CSS pixels of block height; inline width is the full compact
  column with adequate separation from adjacent targets. Visible focus is drawn inside the cell so
  it is not clipped or used to increase column width.
- At the supplied desktop viewport, common names such as Mr. Mime, Ditto, Meowstic, Aegislash,
  Alakazam, Azumarill, and Cyclizar render legibly rather than as one-character ellipses. Only names
  that still exceed the intentionally prioritized identity column may ellipsize; retain the exact
  full form name in `title` and the row header's accessible text. Never ellipsize merely because
  stat columns expanded beyond their content need.
- Support the existing functional phone baseline of 320 CSS pixels without table-level horizontal
  scrolling or page/dialog overflow. Below that non-target width, preserve all data and contain any
  unavoidable fallback overflow inside the results viewport rather than hiding columns or leaking
  page scroll. Do not stack stats into cards or a second stat row.
- At narrower breakpoints reduce sprite, gap, cell padding, and stat font size only to the documented
  readable token floor before taking width from the identity copy. Types remain smaller beneath the
  name. At 320 pixels all stats and a meaningful species-name segment remain visible with no normal
  horizontal scroll; the below-baseline contained-overflow fallback remains unchanged.
- Keep the entire `<thead>` sticky as one row while vertical scrolling so every stat heading remains
  directly above its cells. Sorting, active-row highlighting, row activation, filter groups below
  the table, and accessible header associations are unchanged.
- Every Pokémon table row shows base `HP`, `Atk`, `Def`, `SpA`, `SpD`, `Spe`, then `BST`, using the
  Pokédex's exact short labels and order. Values are unmodified integer base stats from
  `form.base_stats`; compute BST as their sum with a shared typed helper rather than using member SP,
  Nature, or Mega-preview state. Use a semantic labeled value group inside the option so screen
  readers receive each header/value association once. Align numeric columns consistently and use
  the same full/short accessible labels as the Pokédex sortable headers.
- Replace the generic **Matching filters** group with separate **Moves**, **Abilities**, and
  **Types** groups, in the same Pokémon → Moves → Abilities → Types order and plural labels as the
  Pokédex. Render only non-empty groups. Keep a concise singular category cue in each filter row if
  needed visually, but do not announce redundant unlabeled `move`/`ability` text. Activating any
  filter retains the existing AND-filter behavior and does not add a Pokémon.
- Implement the Pokédex's exact `Alt+ArrowDown`/`Alt+ArrowUp` semantics while the picker search owns
  focus: prevent default, open/retain the list, and move the active descendant to the first option
  of the next/previous non-empty group with cyclic wrap. From no active group, Down starts at the
  first group and Up starts at the last. Ordinary Arrow keys still move one option, Enter activates
  by option kind, and Ctrl/Meta-modified arrows remain unclaimed. Group starts must be derived from
  the same flattened options used by `aria-activedescendant`, so filtering cannot desynchronize
  visual and keyboard categories.
- Track the active result by stable `{kind, id}`, not array index. Arrow Up/Down traverses the
  currently sorted Pokémon rows and then non-empty filter groups with cyclic wrap; Home/End moves to
  the first/last selectable result, Enter adds the active Pokémon or applies the active filter, and
  pointer hover updates the same active identity. Sorting preserves the active species when it
  remains visible and scrolls its new row into view; if filtering removes it, choose the first
  selectable result deterministically. Clicking anywhere on a Pokémon row or activating its name
  control runs the same one-add transaction, without double activation from event bubbling.
- Stat header buttons are normal keyboard-focusable buttons inside `<th scope="col">`. Put
  `aria-sort="ascending"` or `descending` only on the active stat header and `none` on the others;
  accessible names state the stat and current direction, and the visual indicator is not the sole
  cue. Pointer and Enter/Space sorting preserve search text, filters, vertical/horizontal scroll as
  far as practical, active species, and dialog focus.
- Give the picker grid an explicit final `minmax(0, 1fr)` list row and give every intermediate list
  wrapper/grid item `min-height: 0`; the listbox owns `overflow-y: auto`, stable scrollbar space,
  and `overscroll-behavior: contain`. Wheel and touch pan scroll the list when the pointer starts
  over it, reach first and last options, and do not leak motion to the body/backdrop at either edge.
  Keyboard navigation scrolls only enough to reveal the active row/option within this results
  scroller; do not
  use document-level scrolling or move the dialog/page. Preserve body scroll locking and restore it
  on every close path.

### Collapsed-member save validation

- Remove DOM input lookup and `assignExact` from the Save path. Canonical Ability, Item, Move, and
  Nature IDs already stored in each `Member` are the save source of truth; clone the persistent
  draft, run local domain validation over that clone, then serialize it directly. Opening,
  expanding, focusing, blurring, or collapsing a member must not be required to make an unchanged
  canonical value saveable.
- Keep autocomplete display/edit state above conditionally mounted expanded editors, keyed by stable
  member identity plus field path rather than position-derived DOM IDs. This state distinguishes a
  valid blank optional field from non-empty unresolved text, survives collapse/expand and reorder,
  and is cleared or canonicalized only by the existing explicit selection/exact-match rules. Do not
  recover values from rendered inputs at Save time.
- Reorder continues to update only member positions/order in the persistent draft. It must carry the
  same canonical IDs and any genuine transient invalid-text record with that member, regenerate
  position-based DOM IDs only for rendering, and serialize unique positions in the new order.
- On Save, combine island-owned unresolved-text records with `validateLocal` domain errors. If there
  are none, send the request even when every card is collapsed. If a genuine error exists in a
  collapsed member, expand only the first invalid member, wait for the expanded layout to commit,
  then focus its exact field and expose the associated message. Do not show the generic resolve
  notice, expand cards, or move focus for valid hidden values.
- A saved canonical ID that is no longer present in the current pinned member choices is a genuine
  domain error, not silently blank. Preserve it in state for error reporting, expand/focus that
  field on Save, and require explicit correction. Optional nulls remain valid and Nature remains
  required.

### Member header and form controls

- The member header always shows the selected base/non-Mega species name as its heading. In an
  expanded card, render that heading first and the inline Nickname presentation directly beneath
  it, matching the collapsed card's species-then-nickname order. Keep both in the existing identity
  wrapper, preserve the slot number and Collapse/action placement, and keep Nickname out of the
  body grid so Ability and Item retain that space. Remove the persistent bordered text-field
  appearance.
- In idle mode, render a native edit button/control in normal Tab order whose plain, transparent
  text is the saved nickname or the prompt `Nickname` when empty. Give it an option-specific
  accessible name such as **Edit Charizard nickname**, visible focus, and at least a 44-pixel hit
  area without making it look like a full form field. Pointer activation or Enter/Space enters edit
  mode; do not make the observation that it was previously out of Tab order part of the design.
- In edit mode, replace the idle presentation in place with a minimal transparent text input,
  accessible name **Nickname**, 10-character `maxLength`, and `Nickname` placeholder when empty.
  Focus it immediately and select an existing nickname so replacement is fast. The species heading
  stays visible and aligned throughout, with no layout jump between idle and edit modes.
- Keep an edit buffer separate from the persisted draft value. Enter commits the buffer; Tab or
  pointer-driven blur commits then continues normal focus movement; Escape restores the value from
  edit entry and returns focus to the idle edit control. Empty commit clears the nickname. Commit
  only calls `onChange` when the value actually differs, so focus, cancel, or unchanged blur never
  marks the team dirty. Do not trim, truncate, or otherwise silently rewrite user input.
- A legacy 11–12-character value remains visible and may enter edit mode for remediation. It cannot
  commit or Save until shortened to 10; retain the buffer and associated error rather than
  truncating. Server validation errors reopen/preserve edit presentation and remain associated with
  the input.
- Enforce a 10-character maximum in the input, local model validation, JSON
  parsing/serialization, and authoritative Django aggregate service. Keep its field error
  associated with the header input. Existing saved 11–12-character nicknames remain loadable so
  users can shorten them, but Save must reject them with the same 10-character error until
  corrected.
- Preserve a sensible header layout for long species/nicknames, validation copy, and card actions.
  At narrow widths, the inline identity and actions may wrap, but controls retain logical order,
  44-pixel targets, and visible focus.
- Reordering the two identity children must not alter inline-edit state, value/error association,
  the edit button/input's place in the Tab sequence, focus restoration, the 10-character limit, or
  commit/cancel/blur behavior. Species remains non-interactive; keyboard focus therefore reaches
  the nickname editor at the same logical point among the header's interactive controls.
- Replace Shiny and conditional Mega preview checkboxes with the same round, icon-centered
  `aria-pressed` button pattern used in the Pokédex (`ShinyIcon`, `MegaIcon`, `.icon-toggle`, active
  treatment, and descriptive accessible names/titles). Reuse/refactor the existing Web-owned
  components/styles into a shared location rather than duplicating SVGs or drifting CSS.
- Shiny remains independently available. Mega appears only for the exact selected form/item mapping
  and toggles the existing preview state. Both controls update their pressed state, sprite, and
  accessible label immediately, retain 44-pixel targets, and work with keyboard and touch.

### Mega ability and Nature labels

- When Mega preview is off, Ability behaves as the existing optional autocomplete and displays the
  stored base ability. When Mega preview is on, the same field displays the mapped Mega target
  ability name and is visibly non-editable; use a focusable read-only presentation rather than a
  disabled control so its description and keyboard information command remain available. Do not
  overwrite or clear the stored base ability.
- Keep Mega Ability information keyboard-accessible from the non-editable field through the same
  field-level command used by editable controls. Its details target switches with the displayed
  value: base selected ability normally, Mega target ability during preview. Turning Mega off
  restores the exact stored base selection and details target.
- Remove the separate **Mega ability** line below the stats because the Ability field is now the
  single source of visible ability state.
- Nature choices and the accepted input display use `Name (+Boosted/-Reduced)` for every
  stat-changing nature, for example `Jolly (+Spe/-SpA)`. Use the established exact abbreviations
  `Atk`, `Def`, `SpA`, `SpD`, and `Spe`; HP never appears because no nature changes it. Serious stays
  exactly `Serious`, without neutral modifier copy.
- Nature canonical IDs and plus/minus facts remain unchanged. Search, exact-match acceptance, and
  validation operate on the decorated display label so the selected text and list option agree.

### Field information affordances

- Place the circular `(i)` button visually inside the right edge of each Ability and Move input
  frame. Use one positioned control wrapper, reserve enough input padding so text, caret, and error
  states never sit beneath the button, and align the icon to the input's vertical center at every
  breakpoint. The button remains a separate native button outside the label's interactive content,
  with an option-specific accessible name such as **Show Protect move information**.
- Copy `references/icons/information-circle.svg` byte-for-byte into the Vite-owned shared icon
  assets, add its first-party source/date/SHA-256 to `src/web/ASSET_PROVENANCE.md`, and expose one
  decorative `InformationIcon` through the shared Web icon module. Because the SVG uses
  `currentColor`, use an import/rendering technique such as a CSS mask that preserves theme color;
  do not duplicate its path markup or rely on inaccessible SVG-internal labeling.
- Replace text `i` marks with that shared icon in both Team Builder field controls and existing
  Pokédex information affordances, including Stats. Keep the glyph visually small (about
  `1rem`–`1.25rem`) and optically centered inside its control while preserving the control's touch
  target and light/dark contrast. Existing standalone Pokédex information buttons/chips retain
  their established Tab, tooltip/dialog, and focus behavior.
- For Team Builder fields only, set the embedded pointer information button outside sequential Tab
  order so Tab moves directly from one field to the next as requested. Do not make its content
  pointer-only: when a valid option is selected, the combobox/read-only Ability control exposes the
  short description and a visually hidden instruction such as **Press Alt+I for information** via
  `aria-describedby`. `Alt+I` on that field opens the exact same modal; closing restores focus to
  the field. Do not claim `accesskey`, and prevent the command only when the field owns valid info.
- Hovering the embedded icon shows the non-interactive short-description tooltip; pointer click
  opens the Pokédex-style modal. Field focus makes the same short description available to
  assistive technology without adding the icon to Tab order. The modal traps focus and closes on
  Escape/backdrop/close. Neither pointer nor keyboard activation may open autocomplete, change its
  query/selection, submit, or trigger card expansion.
- Do not show an enabled information button while the field is blank, invalid, or its selected ID
  is unavailable. The information state follows explicit autocomplete selection, including the
  displayed Mega ability override, and closes safely if that selection changes.
- Reuse the Pokédex information dialog presentation and content structures. Ability shows its full
  description. Move shows type, category, power, accuracy, PP, priority, target, full description,
  and flags with the same labels/formatting as the Pokédex. Share/refactor Web-owned dialog,
  tooltip, icon, and move-format helpers where practical; do not couple the two island roots or let
  one island mutate the other's DOM.
- Current normalized Item and ItemProfile models contain only identity and legal/source status, so
  they cannot supply an honest effect tooltip/dialog. By explicit user decision, the Item `(i)`
  interaction is deferred from this human-review session. Do not render a placeholder, fabricate
  copy, scrape a live source, or present `source_status` as an effect. Keep the Item field layout
  compatible with a future adjacent control without reserving conspicuous empty space.

## Deferred Item information

Held-item effect information is unavailable in the canonical runtime data. Adding it requires a
new Pokémon-data bundle schema, local Showdown snapshot extraction of item short/full descriptions,
bundle validation and semantic diff coverage, Django normalized model/migration/load changes, a new
pinned release and activation, then a builder dataset contract extension. Under the human-review
workflow, that is a material data-pipeline expansion and cannot be folded silently into this focused
loop.

The user chose to defer only the Item `(i)` information feature. Record the future ordinary feature
cycle in `docs/tasks/2026-10-23-item-information.md`; it is not a blocker or completion condition
for this human-review session. Ability and Move information, plus every other third-round request,
remain in scope. Leave the current review session active and do not begin the deferred task until
the user requests a new feature cycle.

### Collapsed member cards and slot shortcuts

- Track expanded/collapsed presentation locally in the island; it is not persisted and does not
  affect dirty state or the team API. When a saved team finishes opening, every populated member
  starts collapsed. A Pokémon just inserted from the palette starts expanded so the existing
  add-and-focus editing flow remains immediate. Creating an empty team has no populated state to
  initialize; saving or reordering a draft preserves each member's current presentation.
- A collapsed card shows the slot number, Pokémon sprite/icon, species name, optional nickname,
  every filled Ability/Item/Move value, selected Nature, non-zero SP allocations, Shiny state, and
  active Mega preview/form/ability in a compact read-only summary. Omit blank optional values. Keep
  the current **move earlier**, **move later**, and **Remove** controls available and correctly
  disabled/labeled.
- Clicking the collapsed card's non-interactive surface expands it. Give that surface explicit
  button-like keyboard behavior and `aria-expanded` without nesting buttons. Events from
  Move/Remove or another nested native control perform only that action and must not also expand.
- An expanded card matches the full editor established by prior rounds. Replace its Move/Remove
  action group with one **Collapse** control; collapsing never mutates or discards values. Focus the
  collapsed card container after Collapse so keyboard position remains predictable.
- Install one island-scoped shortcut handler for unmodified, non-repeating keys `1` through `6`.
  When no dialog/palette is open and the event was not consumed by an input, textarea, select,
  combobox, contenteditable element, or other text-entry control, the key targets that slot. If it
  is empty, do nothing. If populated, record that slot as the pending navigation target and expand
  it; do not scroll against the collapsed DOM in the key handler or a speculative single animation
  frame. Use `event.key`, preserve slot identity after reorder, and never change the draft.
- After Preact commits the target card's expanded layout, a layout effect resolves the pending slot
  against the current DOM, focuses its expanded card container with `preventScroll`, then calls
  `scrollIntoView({block: "center"})`. Use smooth behavior normally and `auto` when
  `prefers-reduced-motion: reduce` matches. Clear the pending target only after focus/scroll is
  issued or the member disappears. One press must expand and center directly; an already expanded
  target also centers in one press, and stale callbacks from rapid keys must not recenter an older
  slot.
- Escape in a focused ordinary text input blurs it. In an autocomplete, Escape closes suggestions,
  clears transient active-option state, and blurs without changing an accepted value or discarding
  retained invalid text. Preserve native Escape behavior for selects and do not intercept Escape
  owned by an information, confirmation, or palette dialog; dialog Escape closes only that dialog
  and restores focus.

### Island loading fallback lifecycle

- Keep a minimal server-rendered loading fallback for the pre-module/no-hydration interval, but
  mark it as fallback content and replace/remove it atomically before or as Preact mounts. After a
  successful mount, the DOM contains no visible or visually hidden **Team Builder / Loading your
  teams…** fallback at the page end.
- The mounted island owns the only loading status. Its spinner and visually hidden **Loading team**
  live copy exist only while `status.kind === "loading"`, disappear when loading resolves or errors,
  and do not leave duplicate `role="status"`/`aria-live` announcements. The persistent member-action
  announcement region remains empty unless it has a current message.
- If bootstrap parsing or mounting fails, replace the fallback with the existing visible alert;
  never append the alert after stale loading content. Keep `<noscript>` behavior unchanged.

## Architecture and interfaces

Django continues to own authentication, private list selection, initial HTML, and authoritative
team validation. Preact continues to own the mounted team-builder interaction. No model or migration
changes are required.

No second-round backend contract change is required for autocomplete validation. The existing
draft contract already sends canonical IDs rather than display text. The backend resolves Ability,
Item, Move, and Nature IDs against the exact pinned regulation/version, allows null only for the
three optional categories, and rejects unavailable choices; Nature remains required. The Web owner
must add transient display-text/validity state that cannot be represented by a false canonical ID.

Round three requires a narrow backend dataset-contract change for Ability and Move information, but
no persistence change:

- Advance `team-builder-data-v1` to `team-builder-data-v2` in backend and Web constants/parsers.
- Serialize each referenced Ability with `id`, `name`, `short_description`, and `description` from
  its exact regulation-effective `AbilityProfile`.
- Serialize each referenced Move with the same detail fields used by the Pokédex: ID/name, type,
  category, base power, nullable accuracy plus always-hit semantics, PP, priority, target,
  short/full description, and ordered flag IDs from its exact regulation-effective `MoveProfile`.
- Retain the existing per-form Ability/Move ID arrays; richer shared records remain keyed by exact
  canonical IDs. Include Mega target abilities in the same shared Ability collection.
- Nature direction IDs and the existing Mega target ability are already sufficient. Nickname,
  icon-toggle, label formatting, and active-ability presentation require no HTTP or persistence
  change.

Build the team dataset from the same normalized records as the Pokédex and, where sensible, extract
a narrow shared backend serializer so field names/always-hit/flags cannot drift. Do not make one
HTTP request per information click; the retained-version team dataset stays browser-local and
private-cacheable. Item description fields are deliberately absent until an approved data cycle.

Round four changes authoritative nickname validation but not the wire shape. Reduce the supported
nickname maximum from 12 to 10 in the backend aggregate service and its public error message/tests.
Keep the physical `TeamMember.nickname` column at length 12 for compatibility with already-saved
values; teams are not admin-mutable and every supported aggregate write passes through the service.
This avoids silently truncating data or a narrowing migration that could fail on existing 11–12
character rows. Serialization continues to return legacy values, Web parsing permits them for
loading, local validation marks them invalid, and any subsequent Save requires shortening to 10.

Round eight is Web-only. `BuilderData` already provides every field needed by the picker, including
regulation-effective forms, sprites, types, and per-form Ability/Move IDs. Preserve the existing
contracts and `paletteResults` domain function. Refactor the Pokédex field/list presentation into a
shared Web-owned component/style boundary that accepts consumer-supplied groups, option IDs, row
content, active index, and activation callbacks; keep Pokédex `suggestions` and Team Builder
availability/filtering as separate domain adapters. No backend endpoint, bootstrap version, data
pipeline, model, or persistence change is required.

Round nine is also Web-only and does not alter the JSON contract. The persisted `Member` canonical
IDs and positions remain the payload model. Lift only transient autocomplete display/invalid state
to the Team Builder island so conditional editor mounting cannot erase it, and address fields by
stable member identity plus logical path. Save validates this state together with the cloned member
model; the DOM is an output and focus target, never a source for payload reconstruction.

Round ten remains Web-only. `BuilderForm.base_stats` supplies `hp/atk/def/spa/spd/spe`; calculate
BST locally from that typed record, matching the Pokédex definition. Extend the shared list
mechanics only where both consumers benefit (group-start derivation and container-local active-row
scrolling), while the Team Builder row content and modal sizing stay picker-owned. No schema,
endpoint, persistence, or data-pipeline change is required.

Round eleven remains Web-only and uses the same data. Extract the Pokédex's stat keys/labels, sort
cycle, sortable-header presentation, and generic Pokémon stat table structure into shared Web
modules that accept a form adapter and activation callback. Keep Pokédex national-Dex tie-breaking
in its adapter; the picker adapter uses display name then canonical ID because `BuilderForm` has no
national-Dex field. Keep filter-option grouping and picker transaction logic outside the table
primitive. No backend contract expansion is justified.

Round twelve is a Web-only CSS/markup-invariant correction. Preserve the round-eleven native table
DOM and data adapter; add explicit column classes/`colgroup` sizing if needed and non-wrapping
identity/type rules inside the existing contained scroller. No contract, state, or interaction
change is required.

Round thirteen supersedes round twelve's separate Types column and normal horizontal-scroll
expectation. It remains Web-only: move existing form Types presentation into the semantic Pokémon
row header, compact the table's CSS/column geometry, and preserve the same data and interactions.

Round fourteen is also Web-only. Preserve the round-thirteen DOM/data shape and correct CSS table
allocation plus sort-button internals. Do not change stat values, sort state, contracts, or picker
selection behavior.

Extend the versioned bootstrap/summary contract rather than fetching every team aggregate from the
browser:

- Advance `team-builder-bootstrap-v1` to `team-builder-bootstrap-v2` in backend and Web contract
  constants/parsers.
- Add `next_team_number`, a positive integer computed as the current user's total saved-team count
  plus one without applying the page's regulation filter.
- Replace `member_count` in each team summary with `members`, an ordered array of at most six
  records containing `position` (0 through 5) and a same-origin `sprite_url`. Generate each URL with
  the existing Pokédex sprite route, the team's pinned version, the selected non-Mega form, and the
  member's saved normal/Shiny variant.
- Keep summary ID, name, pinned version, regulation, and `updated_at`. Validate local URLs and
  positions in the Web parser. Reject malformed or duplicate positions rather than guessing.
- Update the client-created post-save summary from the canonical saved team plus its loaded pinned
  dataset/sprite facts so it matches the bootstrap contract immediately.

Avoid N+1 queries: the page list queryset already prefetches members and forms through
`team_queryset`; ensure summary serialization consumes the prefetched ordered members and does not
issue one count or relation query per card. The sprite route remains authenticated and uses only
already-loaded local data.

## Ownership and ordered work

1. `backend_coder` owns the narrow contract extension under `src/backend/bagredex/teams/**` and
   focused assertions in `src/backend/tests/test_teams.py`. Add the all-regulation count, ordered
   miniature records, pinned same-origin sprite URLs, schema bump, and query-count protection. Do
   not change models or migrations. In round three, extend the team dataset to v2 with existing
   normalized Ability/Move detail and flags, reusing a narrow Pokédex serializer if appropriate.
   The backend owner also changes authoritative nickname validation/error/tests to 10 while
   deliberately retaining the 12-character storage column for legacy readability; no migration is
   required.
2. After the contract shape is fixed, `web_gui_coder` owns all changes under `src/web/**`: the
   template page hook, contract parser/types, direct draft creation and focus selection, local next
   number progression, stable loading shell, card markup, responsive styling, component tests,
   Playwright flow, and generated Vite outputs. The same owner implements the second-round spinner,
   sidebar/FAB polish, confirmation coordinator/dialog, unload bypass, SP sizing, field alignment,
   transient autocomplete validity, and Save gate. Preserve unrelated in-progress edits.
   The same owner moves Nickname into the header, shares Pokédex icon controls and information UI,
   presents Mega ability in-field, formats Nature labels, and consumes dataset v2 details.
   In round four, the Web owner implements nickname placement/limit, embedded information controls,
   fallback cleanup, per-member presentation state, compact summaries, and keyboard
   shortcut/Escape behavior.
   In round five, the same owner refines Nickname to buffered inline edit/idle states and sequences
   numeric shortcut focus/scroll from committed expanded layout. No backend change is added.
   In round six, the Web owner copies/documents the supplied information SVG, exposes the shared
   icon in both islands, implements field-level keyboard information access with Tab skipping the
   embedded icon, and opens complete valid lists on empty autocomplete focus. No backend/data
   contract change is required.
   In round seven, the Web owner reorders the expanded identity markup and adjusts only the needed
   responsive header CSS so species appears above Nickname, preserving the established inline-edit
   component and every other header control. This is a Web-only presentation change.
   In round eight, the Web owner extracts shared Pokédex search-field/list primitives and migrates
   the Team Builder picker to them while keeping each island's domain state and behavior separate.
   No backend owner is needed.
   In round nine, the same owner removes DOM-derived save normalization, lifts transient
   autocomplete validity above collapsed editors, and sequences expansion/focus only for genuine
   errors. No backend or contract change is required.
   In round ten, the Web owner adds picker stat presentation, categorical filter groups and
   Pokédex-compatible Alt+Arrow handling, and corrects the dialog/list sizing and overscroll chain.
   No backend owner is needed.
   In round eleven, the Web owner replaces picker Pokémon list rows with the shared accessible stat
   table, adds picker-owned sort/active-identity state, and preserves categorized filter options in
   the same bounded results region. No backend work is required.
   In round twelve, the same owner fixes picker table column sizing/non-wrapping and adds focused
   DOM/responsive regressions. No other owner is needed.
   In round thirteen, the Web owner removes the Types column, restores compact type metadata beneath
   the name, and makes the eight-column table fit the supported phone baseline. No backend work is
   required.
   In round fourteen, the same owner gives stat columns intrinsic compact widths, allocates surplus
   to identity, and stacks sort labels/indicators without changing semantics. No other owner is
   needed.
3. During this feedback round, each owner runs only the focused checks below. The
   `deployment_agent` then runs `./bagredex.sh human-review reload` and reports the unchanged session
   connection fields so the user can inspect the same review data.
4. Only after explicit finish, run matching independent reviews and architect integration review,
   resolve findings with their owners, run all finish-time checks, write the supplemental report,
   and ask `deployment_agent` for one separate follow-up commit.

## Focused checks for this round

Backend owner:

- `uv run --project src/backend pytest src/backend/tests/test_teams.py` (or the repository's exact
  established equivalent if local environment setup requires it).
- Assert `next_team_number` counts the owner's teams across regulations but excludes other users.
- Assert summaries preserve saved position order, pinned version, and Shiny sprite variant, omit
  `member_count`, and produce only local sprite URLs.
- Assert rendering several teams stays within an explicit bounded query count.
- Rerun the existing authoritative option-validation tests; no backend file should change solely
  for the second-round browser validation because canonical-ID validation already covers it.
- Assert dataset v2 returns exact retained-regulation Ability descriptions and complete Move
  details/flags with stable ordering, includes Mega abilities, rejects malformed/missing normalized
  relations, and does not increase requests or introduce per-record query growth.
- Assert Nature direction and Mega target ability output remain unchanged, and Item records still
  expose no invented description.
- Assert create/replace reject an 11-character nickname at `members.<index>.nickname`, accept 0–10,
  serialize a pre-existing 11–12-character row for remediation, and roll back the aggregate on
  rejection. Confirm no migration/model-column narrowing is introduced.

Web GUI owner:

- Run the team-builder Vitest files covering bootstrap parsing, creation, summaries, and member
  layout behavior.
- Run the existing frontend type check and production build.
- Extend the team-builder Playwright flow to prove the `+` button's accessible name, absence of a
  prompt, `Team #` default, selected name input, absent redundant CTA/count text, visible miniature
  slots, stable library geometry across team opening, and toolbar/card edge alignment.
- Add component coverage for exact display-name resolution, case-insensitive matching with
  canonical display casing, explicit partial-result selection, retained invalid text and ARIA error
  wiring, blank optional values, required blank Nature at Save, choice invalidation, first-error
  focus, and suppression of the save request.
- Add interaction coverage for a centered busy spinner with no team-name loading text, no sidebar
  regulation label, optical FAB centering, the two branded dialog variants, focus trap/Escape/focus
  restoration, cancel behavior, and one confirmed in-app navigation producing neither a second
  dialog nor native `beforeunload` prompt. Cover the regulation selector event as well as an
  ordinary application link.
- Verify SP numeric inputs remain touch-height, centered, and wide enough for `32` but do not occupy
  the former four-rem column; assert aligned field edges at desktop and tablet breakpoints.
- Add component coverage for Nickname's inline alignment and transparent idle/edit presentation;
  focusable edit-button and input names; `Nickname` empty prompt/placeholder; pointer, Enter, Space,
  Tab, blur, and Escape transitions; selection on entry; 10-character limit; unchanged/canceled
  dirty-state behavior; empty commit; legacy invalid remediation; server-error reopening; body-grid
  absence; and responsive wrapping.
- Assert expanded identity DOM/visual order is species heading then inline Nickname, consistent with
  the collapsed card. Verify the edit control remains keyboard reachable in the expected header
  order, and that entering, committing, canceling, and blurring an edit preserve focus and dirty
  semantics after the reorder. Add desktop and narrow-viewport checks that the identity stack wraps
  without overlapping the slot number or Collapse control.
- Add shared-primitive tests showing Pokédex and Team Builder render the same search-field and stat
  table header/cell/sort semantics while activation adapters remain consumer-specific. Keep shared
  grouped filter rows, empty state, live count, and scroll-to-active mechanics. Retain the existing
  Pokédex search, table sort, filter selection, Pokémon selection, `/`, grouped navigation, and
  clear-focus regression suite.
- Add picker component coverage for blank-query alphabetical results; normalized name search;
  Move/Ability/Type suggestion activation; AND-filter chips and removal; used-base-species exclusion;
  deterministic order; active-option reset/clamping; Arrow Up/Down, Enter, Tab/Shift+Tab, Escape,
  pointer hover/click, ARIA wiring, and result-count announcements. Assert filters/order persist
  through query changes and that filter activation never adds a Pokémon.
- Assert Pokémon activation adds exactly the requested slot with Serious defaults, closes the
  picker, expands the inserted card, and activates its Nickname editor. Assert Close, backdrop, and
  Escape add nothing and restore focus to the originating empty slot. Cover no-match, all-used,
  owning-workspace loading/error, and full-team behavior without duplicate empty/live messages.
- Extend Playwright visual/interaction coverage across desktop, tablet, and phone viewports in both
  themes: the picker uses the Pokédex-style field and stat table instead of the card grid; the table
  owns narrow-screen horizontal overflow without page/dialog overflow; scrolling retains the active
  row; and modal focus, touch targets, selection, cancellation, and post-add focus behave as
  specified.
- Assert every Pokémon row renders `HP/Atk/Def/SpA/SpD/Spe/BST` in that exact order, with values
  from `base_stats` and BST equal to their sum. Cover a representative large and small value, the
  accessible header/value associations, aligned desktop columns, sticky header, and complete
  horizontally reachable tablet/phone columns with no stat omitted.
- Assert filter results render in non-empty **Moves**, **Abilities**, and **Types** groups after the
  Pokémon group. With a query matching all categories, verify `Alt+ArrowDown` cycles Pokémon → Moves
  → Abilities → Types → Pokémon, `Alt+ArrowUp` reverses and wraps, skips empty groups, lands on each
  group's first option, updates `aria-activedescendant`, scrolls it into view, and preserves correct
  filter-versus-Pokémon activation. Verify Ctrl/Meta combinations are not intercepted.
- Add a real-browser scrolling regression with enough picker rows to overflow: assert the results
  scroller's
  `scrollHeight > clientHeight`, wheel and touch/pan change only its `scrollTop`, first/last rows are
  reachable, edge gestures do not move the locked document/backdrop, and Arrow/Alt+Arrow navigation
  reveals the active row without changing page/dialog position. Repeat at desktop and phone heights
  and after filter chips change the group/list height.
- Add sort-cycle coverage for every stat header: first activation descending, second ascending,
  third default alphabetical; only the active header exposes non-`none` `aria-sort`; ties resolve by
  display name then canonical ID. Verify name/types are not sortable, sort persists through query
  and filter changes, a newly opened picker resets it, and pointer plus Enter/Space preserve focus,
  active species identity, search/filter state, and scroll positions.
- Exercise the unified active-result model across sorted table rows and categorized filter options:
  Arrow/Home/End/Enter/Escape, Alt+Arrow group jumps, pointer row/name activation without duplicate
  adds, active-species preservation after sort, deterministic fallback after filtering, and accurate
  controls/active-descendant/live announcements. Run the configured accessibility checker over the
  modal table plus filter groups and assert sortable headers, table caption, scopes, and row
  selection controls have non-duplicated accessible names.
- Add a DOM regression asserting one header `<tr>` and one `<tr>` per Pokémon, with cells in exact
  Pokémon/HP/Atk/Def/SpA/SpD/Spe/BST order. Assert there is no Types column; sprite/name plus smaller
  type metadata live once inside the `<th scope="row">`; every stat remains in that same row; and
  header scopes/associations and full accessible identity/type text remain intact.
- Add computed-layout Playwright checks at representative desktop, tablet, and phone widths using a
  long form name and dual long type names. Assert name is on the first identity-text line, smaller
  Types are on the second, all seven stat columns remain visible/aligned, and the sticky header stays
  aligned during vertical scrolling. At 320 CSS pixels, assert table `scrollWidth <= clientWidth`
  within rounding tolerance and neither results, dialog, nor document has horizontal overflow.
- Verify desktop/tablet/phone compact padding, numeric legibility, long-name ellipsis/full accessible
  name, dual-type containment, and visible focus/active treatment. Re-run stat sorting, Arrow/Enter
  row selection, and filter-option activation at 320 pixels. Add a below-baseline fallback check that
  preserves every column inside results-contained overflow without page leakage or hidden data.
- Add a screenshot-sized Playwright regression at 1515 × 1029 using the supplied roster/result
  names. Assert the rendered Pokémon column is at least 18rem, each stat column is no more than 4rem,
  every stat header/cell edge aligns, and representative names render more than an initial before
  any ellipsis. Capture or compare the picker region in both themes after fonts settle.
- Assert the sort header's stat label and indicator occupy two distinct grid/flex rows, all headers
  reserve identical indicator height, changing direction causes no column/header-height shift, and
  each button fills its cell with at least 44px block height, visible unclipped focus, correct
  accessible name, and matching `aria-sort`. Exercise pointer plus Enter/Space for all three states.
- At desktop, tablet, and 320px widths, measure that stat columns hug label/three-digit content and
  surplus width goes to identity. Cover long form names and dual Types beneath the name; verify full
  title/accessibility text when genuine overflow ellipsizes, no one-character truncation at the
  supplied viewport, all seven stats visible, and no normal horizontal results/dialog/page overflow.
- Keep the picker render/search interaction within the existing Web responsiveness target using a
  representative largest regulation dataset. Record the focused measurement; avoid per-row data
  lookup with repeated linear scans, and add virtualization only if measurement demonstrates it is
  necessary without breaking listbox semantics.
- Add the exact save regression: load a saved team containing Abomasnow first and Charizard second
  with both cards collapsed; use the collapsed controls to move Charizard to position 0; press Save
  without expanding either card. Assert no resolve-fields notice appears, one save request is sent,
  and its members retain every original canonical Ability, Item, Move, and Nature ID while
  Charizard serializes at position 0 and Abomasnow at position 1.
- Add component variants for saving an unchanged all-collapsed team, moving a collapsed member into
  an empty earlier slot, swapping two occupied collapsed slots, valid optional null fields, and a
  collapse/expand cycle after a canonical selection. None may query mounted inputs to construct the
  payload or require blur/effect canonicalization.
- Add genuine-error variants: unresolved non-empty autocomplete text survives collapse and reorder;
  an unavailable canonical ID and missing Nature remain invalid; Save expands the first affected
  card after state commit, focuses its exact field, preserves the message/text, and sends no
  request. Correcting it then saves without expanding unrelated members. Verify position changes do
  not orphan or transfer transient errors between members.
- Prove Shiny/Mega buttons reuse icon-toggle semantics, labels, pressed state, keyboard activation,
  and sprite/state transitions. Verify Mega mode shows the target ability in the non-editable field,
  targets that ability's information, preserves the base choice, restores it on exit, and removes
  the below-stats duplicate.
- Assert every stat-changing Nature renders and accepts the exact decorated label using
  `Atk/Def/SpA/SpD/Spe`, while Serious remains undecorated.
- Cover Ability and Move information-button enablement, tooltip hover/focus dismissal, dialog
  content parity with Pokédex, focus trap/Escape/backdrop/close/focus restoration, selection changes,
  and Mega ability switching. Verify this session adds no Item effect copy, placeholder, or Item
  information control.
- Cover information buttons as right-edge in-input controls: reserved text padding, alignment,
  unclipped focus, tooltip/dialog behavior, and event isolation from autocomplete/card expansion.
- Cover presentation-state initialization (opened saved members collapsed, newly added member
  expanded), complete filled-value summaries, omission of blanks, collapsed Move/Remove actions,
  expanded Collapse-only action, state preservation through edits/save/reorder, focus restoration,
  and no dirty-state changes from expand/collapse.
- Cover `1`–`6` populated/empty slot behavior, scroll/focus/expand, modifier/repeat guards,
  editable/contenteditable/modal suppression, and slot identity after reorder. Cover Escape blur and
  suggestion closure without value loss, plus unchanged dialog/native-select Escape behavior.
- Specifically assert one press on a collapsed populated slot waits for expanded layout, focuses
  with `preventScroll`, and scrolls that expanded card to viewport center; one press on an already
  expanded slot also centers it. Cover reduced-motion `auto`, normal smooth behavior, rapid-key
  stale-target cancellation, and member removal before the post-commit effect.
- Assert the packaged information SVG is byte-identical to
  `references/icons/information-circle.svg`, its provenance/checksum is recorded, one shared icon
  primitive serves Pokédex and Team Builder, and theme rendering remains visible at the intended
  small centered glyph size without reducing touch targets.
- Cover the Team Builder field sequence to prove Tab skips embedded info buttons and moves to the
  next editable field. For a valid Ability/Move (including Mega Ability), assert the focused field's
  description/instruction association, `Alt+I` dialog activation, dialog focus trap/Escape/close,
  and focus restoration to the field; pointer hover/click retains tooltip/dialog behavior. Invalid
  or blank fields expose neither stale description nor an active command. Verify Pokédex standalone
  information controls remain keyboard reachable with unchanged semantics while using the SVG.
- For blank Ability, Item, and each Move, assert focus opens a complete correctly filtered ordered
  list; Arrow/Enter/Escape/Tab and listbox ARIA work from an empty query; held-item and duplicate-move
  exclusions update; non-empty filtering/canonicalization/error behavior is unchanged; and only one
  listbox is mounted. Measure the largest representative lists and record the observed focus/typing
  response before considering virtualization.
- Assert the server fallback is present before mount, absent after success, replaced rather than
  accompanied by startup failure, and leaves no stale visible/hidden banner or duplicate live
  region after loading settles.
- Inspect desktop and tablet plus a functional phone viewport in light and dark themes. Compare the
  desktop member form directly with
  `references/screenshots/Screenshot 2026-10-22 203541.png` and record any intentional residual
  difference for the next user pass.

## Finish-time review and validation

After the user explicitly asks to finish and teardown succeeds:

- `backend_reviewer` reviews ownership/privacy, schema consistency, retained-version sprite URLs,
  query behavior, and regression coverage without editing files.
- `web_gui_reviewer` reviews layout stability, accessibility, responsive behavior, loading/error
  states, focus selection, keyboard flow, dialog focus/unload behavior, autocomplete validity, and
  member-header responsiveness, shared icon/information behavior, Mega ability presentation,
  Nature notation, collapsed-card keyboard semantics, live-region lifecycle, shared picker/search
  primitive boundaries, picker stat/category and sortable-table semantics, independent results
  scrolling, compact identity/type presentation at responsive breakpoints, and
  maintainability without editing files.
- `architect` reviews the full diff and reviewer results for cross-scope contract agreement and
  plan compliance.
- Owners resolve every actionable finding and rerun affected focused checks until no blockers
  remain.
- Run `.codex/lint.sh` and all repository checks it invokes; run the complete backend test suite,
  complete Web unit/type/build suite, and full configured Playwright suite if they are not already
  covered by that command. Record only observed results.
- `architect` writes `docs/reports/2026-10-23-basic-team-builder-human-review.md`, and
  `deployment_agent` creates one separate local follow-up commit. Do not amend the original feature
  artifacts or commit, and do not use Git remotes.

## Risks and mitigations

- A page-rendered team count can become stale across tabs. Preserve the draft and show the existing
  authoritative uniqueness error on Save; never invent a server-side rename.
- Roster sprites from retained versions can be wrong if built from the active dataset. Construct
  URLs exclusively from each team's pinned version and persisted form/variant.
- Rich cards can overcrowd the fixed library. Use small decorative miniatures, six stable slots,
  truncation/wrapping for long names, and breakpoint checks rather than widening the sidebar during
  interaction.
- Loading-shell changes can hide errors. Keep status messages in the workspace with alert/status
  semantics while retaining the library.
- A branded navigation dialog can race native unload handling. Centralize confirmation state and
  use a narrowly scoped one-shot bypass only after confirmation, with regression coverage for
  cancel and failed navigation paths.
- Separating visible autocomplete text from canonical IDs can submit stale values. A non-empty
  invalid query must clear/invalidate the canonical ID, remain visible, and block Save until the
  same current option is explicitly or exactly resolved.
- Tightening nickname writes can strand legacy 11–12-character values. Keep them readable, explain
  the field error, require correction on the next Save, and retain the wider storage column rather
  than truncating user data.
- Inline nickname editing can mark drafts dirty merely from focus/blur or lose edits on Escape.
  Keep a local entry snapshot/buffer and mutate the draft only on a changed, valid commit.
- Copying Pokédex dialogs can drift behavior and styling. Refactor Web-owned primitives and pure
  formatting helpers while preserving separate island state and DOM ownership.
- Removing the embedded info button from Tab order can make details pointer-only. Associate the
  selected field with its short description and announced `Alt+I` instruction, test the command and
  focus return, and retain ordinary focusability for standalone Pokédex information controls.
- External SVG `currentColor` does not automatically inherit through every `<img>` path. Preserve
  the source byte-for-byte and use a shared mask/component strategy with explicit contrast tests.
- Rendering every empty-query Move option can create a large list. Mount only the open list,
  measure representative data, keep rows light and the viewport bounded, and add virtualization
  only when evidence requires it without reducing keyboard reachability.
- Item descriptions are absent from canonical data. Preserve the explicit deferral in
  `docs/tasks/2026-10-23-item-information.md` rather than misleading users with guessed content or
  expanding this session.
- Card-wide expansion can steal nested-control clicks or keyboard focus. Gate expansion by event
  target, provide explicit semantics on the non-interactive surface, and restore focus after state
  transitions.
- Scrolling before expansion commits uses stale card geometry. Represent the requested slot as a
  pending navigation target and resolve focus/centering in a post-commit layout effect, canceling
  stale targets from rapid input.
- A stale server fallback can create duplicate visual and assistive loading output. Treat root
  replacement and mounted live-status lifecycle as one tested ownership boundary.
- An over-broad shared search component can entangle Pokédex navigation with modal picker state.
  Share only rendering and combobox/list mechanics, keep domain derivation and side effects in each
  consumer, and retain both islands' focused regression suites.
- A mixed list of filters and Pokémon can make Enter perform the wrong action after results change.
  Give every option a stable kind-qualified ID, reset or clamp active state synchronously, and route
  activation by option kind with explicit tests.
- Position-derived input IDs and conditionally mounted controls can tempt save logic back toward DOM
  state. Keep a stable member/path validation key, derive render IDs separately, and regression-test
  payloads with all editors absent.
- A clipped intrinsic grid item can look like an input-device bug. Define the shrinking grid track
  and `min-height: 0` chain explicitly, then verify wheel, touch, and keyboard scrolling in a real
  browser rather than relying only on mocked `scrollIntoView`.
- Combining a semantic table with filter suggestions can produce conflicting selection roles or
  unstable index-based focus after sorting. Keep native table semantics, give selectable rows and
  filters stable kind-qualified control IDs, track active identity rather than index, and verify the
  mixed results region with keyboard, accessibility, and screen-reader-oriented assertions.
- Fitting eight columns can compress identity or stat controls below readability. Remove the
  non-sortable Types column, compact spacing at breakpoints, bound/ellipsize only the visible long
  name with an accessible full value, and test the 320-pixel baseline; never hide stats or shrink
  sort/focus targets below the established usable minimum.
- Browser fixed-table algorithms may ignore or redistribute functional `<col>` widths unexpectedly,
  recreating equal columns. Assert computed widths in a real browser and prefer explicit supported
  column sizing/intrinsic constraints over visually plausible declarations that are not honored.

## Completion criteria

- All accepted, non-deferred feedback from every review round is observable in the reloaded
  human-review session.
- New Team creates an unsaved `Team #` draft without a browser prompt and selects the name input.
- The library remains left-anchored and does not shift while opening active or retained teams.
- Cards show name, date, and six-position roster miniatures with no Pokémon-count text.
- Toolbar and member cards share edges, and the form grid is aligned at desktop and responsive at
  tablet/phone widths in both themes.
- Loading uses a centered spinner without selected-team copy; the sidebar has no regulation label;
  and the `+` glyph is optically centered.
- Discard and delete use accessible branded dialogs, confirmed in-app navigation prompts exactly
  once, and native unload protection remains for genuine dirty-page exits.
- SP numeric controls are compact and centered, and every affected autocomplete is blank or bound
  to a current canonical option; invalid non-empty text remains visible and blocks Save.
- Member headers show an accessible 10-character inline Nickname edit control aligned with species:
  transparent idle text/prompt, minimal editor on activation, deterministic commit/cancel/blur, and
  no dirty change for unchanged or canceled editing. Shiny/Mega match Pokédex icon toggles.
- Expanded and collapsed cards both present species before nickname; the expanded nickname remains
  directly beneath species with unchanged inline-edit accessibility, validation, and responsive
  header controls.
- The Pokémon picker uses the same shared text-field and vertical result-list presentation as the
  Pokédex, while Team Builder filters, alphabetical availability ordering, keyboard navigation,
  cancel/add focus behavior, and responsive dialog semantics remain intact.
- Reordering and saving valid collapsed members succeeds without expanding them; canonical values
  and new positions serialize correctly, while only genuine invalid fields trigger expansion,
  focused correction, and the resolve-fields notice.
- Picker Pokémon matches use an accessible table with all six base stats and BST, Pokédex-style
  sortable stat headers and deterministic ties; filter matches retain category headings;
  Alt+Arrow cycles group starts; and the bounded results region scrolls independently by wheel,
  touch, and keyboard without leaking page movement.
- Each Pokémon row shows sprite/name with smaller Types beneath in its row-header cell and all seven
  aligned stat columns; the eight-column table fits the 320-pixel phone baseline without normal
  horizontal scrolling, hidden values, or page-level overflow.
- At the supplied 1515 × 1029 evidence viewport, Pokémon names are readable, stat columns are compact,
  and two-line sort headers preserve stable geometry, accessible direction, and usable controls.
- Mega mode displays and explains the Mega ability in the disabled Ability field without losing the
  base choice, and Nature labels use exact established modifier notation.
- Ability and Move `(i)` controls provide accessible tooltip/dialog content matching the Pokédex
  from dataset v2. Item `(i)` is explicitly deferred and does not block this cycle's completion.
- Ability/Move information buttons sit inside the visual input edge without overlap; saved members
  open collapsed, added members open expanded, summaries retain filled data and collapsed actions,
  and `1`–`6` plus Escape behave predictably outside dialogs/editable controls.
- A single `1`–`6` press focuses and centers the post-expansion card geometry without an initial
  jump or a second press, respecting reduced-motion preference.
- Pokédex and Team Builder use the supplied information-circle geometry with recorded provenance;
  the Team Builder field Tab sequence skips the icon while selected details remain fully available
  through field description and `Alt+I`, pointer hover/click, and an accessible dialog.
- Empty Ability, Item, and Move focus opens the complete currently valid option set with preserved
  filtering, canonicalization, keyboard/listbox semantics, and measured responsive behavior.
- The pre-mount loading fallback and mounted loading status never coexist after mount or remain
  stale after resolution, visually or to assistive technology.
- Backend and Web agree on bootstrap v2, focused checks pass before reload, and the human-review
  session remains active for the user's next pass.
- On explicit finish, teardown, matching reviews, full validation, supplemental report, and a
  separate local commit complete with no unresolved blocking findings.

# Form-search and popover human-review follow-up

## Outcome

Apply three corrections from the active human-review session for `form-search-sp-popovers`:

- replace the Damage Calculator's full-width-sensitive `Modifiers` button with a compact `+`
  button inside the right edge of each applicable move text field while preserving the existing
  popover or narrow-screen dialog;
- make Team Builder's Real Stats card display baseline battle-effective held-item stat multipliers
  rather than only the pre-item stat; and
- expose the existing Pokémon removal action beside `Collapse` while a Team Builder member card is
  expanded.

The trigger correction is Web GUI-only. The Real Stats correction crosses normalized Pokémon
Showdown mechanics data, Django serialization, and the Team Builder island so item effects and
eligibility do not become a hand-maintained client list.

## Current behavior

`MoveModifierPopover` renders its trigger as a third grid item after the result and move combobox.
The trigger's `Modifiers` text and padding add a separate column at desktop widths and a separate
row below 1000 px, disrupting the move-row layout. The overlay already owns contextual input state,
desktop anchoring, phone dialog behavior, dismissal, and focus restoration.

Team Builder computes Real Stats in the browser from base stats, SP, and nature only. Its item
contract contains identity and descriptions but omits the normalized `calculation` facts retained
on `ItemProfile`; its form contract also omits the normalized `is_nfe` fact required for Eviolite.
The importer extracts damage-oriented item facts but does not extract held-item stat modifiers.
The Damage Calculator hard-codes several item IDs for related calculations, which must not become a
new Team Builder mechanics source.

## Intended behavior

### Move modifier trigger

- A move with contextual inputs shows one compact `+` button overlaid inside the right side of its
  move text-field boundary. A move without contextual inputs shows no button and retains the full
  text-field width.
- The move input reserves enough inline-end space that its text, caret, and autocomplete content do
  not render beneath the button. The button aligns to the field control rather than its visible
  label and does not create another grid column or row.
- The visual symbol is `+`, but the native button keeps the accessible name `<move name>
  modifiers`, `aria-expanded`, and `aria-controls`. It has a visible focus indicator and a
  touch-usable hit area without restoring the layout disruption.
- Activating it opens the same panel for the same move slot. Context updates, damage recalculation,
  one-open-panel behavior, desktop collision placement, phone modal semantics, dismissal, and focus
  restoration remain unchanged.
- The trigger follows its move combobox in logical keyboard order. Combobox suggestions and the
  trigger do not obscure each other or cause accidental selection.
- The layout remains stable at desktop, tablet, and phone widths and in light and dark themes. The
  button causes no horizontal overflow, adjacent-result overlap, clipping, or layout shift.

### Team Builder Real Stats

- Calculate the level-50, SP, and nature-adjusted stat first, then apply each eligible always-active
  held-item stat multiplier with Pokémon Showdown's exact modifier scale, order, and integer
  rounding. HP remains unchanged unless a future normalized Showdown mechanic explicitly provides
  an eligible HP modifier.
- Display the effective value in place of the raw value rather than showing a second pair. Changing
  item, Pokémon/form, Mega preview, ability, nature, or SP updates affected values immediately
  without a network request.
- Initial acceptance examples are Choice Scarf multiplying Speed, Choice Band multiplying Attack,
  Choice Specs multiplying Special Attack, Assault Vest multiplying Special Defense, and Eviolite
  multiplying Defense and Special Defense only when the displayed canonical form is eligible under
  Showdown's `nfe` fact. These are examples, not a client-side ID allow-list. An example unavailable
  in the active Champions regulation remains covered at extraction and contract boundaries and
  applies automatically if a later legal version includes it.
- A held item suppressed by the selected ability, including Klutz, contributes no stat modifier.
  Normalize suppression from Pokémon Showdown instead of parsing prose or duplicating an ID rule in
  Team Builder.
- Exclude effects that modify move damage rather than a stat, such as Life Orb; effects requiring
  damage, HP thresholds, consumption, weather, terrain, status, switching, move selection, or
  another trigger, including pinch berries; and effects whose eligibility cannot be determined
  from the saved member, displayed form, and normalized mechanics.
- The team and draft schemas remain unchanged. Real Stats stays derived and non-persisted and does
  not change server validation, item legality, or the damage engine.

### Expanded Team Builder member actions

- An expanded member card shows a native `Remove` button in the existing header action group,
  immediately beside its `Collapse` button. Its accessible name remains `Remove <Pokémon name>` and
  it has the same visible focus, touch target, danger affordance, and responsive wrapping expected
  of existing member actions.
- The new location invokes the existing `onRemove` action. It must not duplicate removal state,
  cleanup, announcements, or draft mutation. Repository evidence shows member removal currently
  calls `onRemove` directly; the separate confirmation dialog belongs to destructive team-level
  actions. Do not introduce a new member confirmation or reuse the team-deletion state path.
- Activating either expanded or collapsed member removal calls the same `onRemove` callback once,
  removes exactly that member, and retains the parent-owned cleanup of expanded-member and
  autocomplete state.
- Collapsed cards retain their current expand surface, move-earlier/later controls, and `Remove`
  action unchanged. Expanding or collapsing a card does not create two simultaneously rendered
  removal controls for that card.

## Data and interface decisions

- Pokémon Showdown remains the sole mechanics source. The importer inspects structured callbacks
  from the pinned local snapshot and emits exact normalized item `stat_modifiers`. Each entry names
  the stat, positive integer numerator and denominator in Showdown's modifier scale, and a closed
  eligibility discriminator such as `always` or `form_is_nfe`. Unknown or conditional callback
  shapes fail closed rather than becoming always active.
- Ability mechanics gain a closed source-derived held-item-suppression fact for unconditional
  member-level suppression such as Klutz. Dynamic suppression such as Magic Room is not represented
  by a saved Team Builder member and is outside this display.
- The immutable release, schemas, manifests, hashes, semantic diff, backend retained-release
  allow-list, and loader validation advance together. Prior releases remain loadable; no existing
  release is edited and no version is silently activated.
- The active human-review marker currently pins the i7 bundle selected by `start`; `reload` reads
  that marker and therefore cannot discover the i8 bundle required by this round. Change the
  deployment-owned `reload` lifecycle so a `ready` session resolves the reviewed pin from
  `deploy/pokemon-data.env`, verifies the matching local immutable release directory and manifest,
  then transactionally writes that bundle ID into the existing marker as it enters `reloading`.
  The lifecycle command, not an agent or ad hoc script, is the only writer. It preserves the same
  target, feature commit, credentials, database volume, and creation boundary; it does not delete
  the marker or invoke `start` again.
- An interrupted advancing reload remains recoverable: write `STATE=reloading` and the newly
  resolved bundle together before build/load/activation. A retry reads that marker and repeats the
  idempotent load and activation against the same preserved volume. A `starting` or `reloading`
  recovery must retain the marker's bundle rather than re-resolve a possibly changed environment
  pin; only a stable `ready` session may advance. If pin or local-artifact validation fails, reject
  before marker or runtime mutation. `status` remains read-only and reports whichever bundle the
  lifecycle marker currently owns.
- Bump `team-builder-data-v4` because item, ability, and form parser expectations change. Serialize
  exact facts for the active regulation: modifiers on item records, suppression on ability records,
  and `is_nfe` on forms and Mega targets. The Web parser rejects unknown stats or conditions,
  non-positive fractions, extra keys, and malformed booleans.
- The Team Builder helper receives the displayed form, selected effective ability, selected item,
  SP, and nature. It computes the existing stat once and chains eligible normalized modifiers in
  deterministic source order with Showdown-compatible rounding. It does not branch on the IDs of
  Choice items, Assault Vest, Eviolite, or Klutz.

## Scope and ownership

`pokemon_data_coder` exclusively owns normalized mechanics under `src/data`:

- extend deterministic Showdown extraction and calculation validation with exact structured stat
  modifiers and held-item-suppression facts;
- regenerate the next immutable release from the same pinned local inputs with complete provenance,
  validation, semantic diff, hashes, and prior-release retention; and
- add focused coverage for the five item examples, Eviolite's condition, Klutz suppression,
  unsupported callback shapes, and exclusion of Life Orb and triggered berries.

`backend_coder` exclusively owns Django work under `src/backend`:

- retain and load the new release and expose only validated item modifiers, ability suppression,
  and form `is_nfe` through a bumped Team Builder dataset contract; and
- add focused bundle and dataset tests for exact rational values, regulation/version scoping,
  canonical IDs, malformed facts, conditional metadata, and fixed query counts.

`web_gui_coder` exclusively owns browser work under `src/web`:

- compose the move combobox and modifier trigger in one field boundary, update the responsive CSS,
  and update Damage Calculator component and browser tests;
- update Team Builder contracts and fixtures, and extend the pure Real Stats calculation to consume
  normalized modifiers and eligibility without hard-coded mechanics IDs; and
- update Team Builder model/component/browser tests for immediate effective-stat rendering; and
- render the existing `onRemove` control beside `Collapse` in the expanded member header, update
  only the necessary responsive/action styling, and cover expanded/collapsed action parity without
  changing the removal callback contract.

`deployment_agent` exclusively owns the lifecycle correction under `deploy` and local delivery:

- update `deploy/pokemon-data.env` to the reviewed i8 release after data/backend compatibility is
  established;
- update `deploy/scripts/human-review.sh` so `reload` safely adopts the current reviewed pin through
  the lifecycle's atomic marker writer before idempotent load and activation; and
- update `deploy/tests/human-review.bats` and `deploy/README.md` for same-bundle reload, i7-to-i8
  advancement, pre-mutation invalid-pin failure, interrupted advancement recovery, preserved volume
  and credentials, recovery pin stability, and read-only status behavior.

No calculator dataset contract, damage engine, persisted team/draft contract, or existing feature
report changes belong to this round. Independent review, full validation, supplemental reporting,
and Git mutation remain deferred until explicit human-review finish.

## Implementation sequence

1. The data owner adds failing focused tests for named item callbacks, conditional Eviolite,
   unconditional Klutz suppression, exact rational values, and excluded effects. Extend extraction,
   schemas, and validation, then generate and inspect a complete immutable release from pinned local
   inputs.
2. The backend owner retains the release, bumps the Team Builder data contract, serializes minimal
   normalized facts, and tests strict values, regulation/version isolation, malformed data, and
   query counts.
3. The Web owner updates the Team Builder parser and fixtures, then adds a pure effective-stat
   helper using normalized modifiers and conditions. Preserve the current level/SP/nature formula
   as the first calculation step and update the Real Stats rendering reactively.
4. Add or adjust Damage Calculator component assertions for visible `+` text, preserved accessible
   state and relationship, absence on ordinary moves, and existing close/focus behavior.
5. Compose the trigger inside the move field. Keep the same native button as the popover geometry
   anchor and focus-restoration target, including pointer handling for direct panel switching.
6. Replace the dedicated trigger grid column/row with field-relative positioning and input
   inline-end padding using existing design tokens.
7. Extend Team Builder Playwright coverage for effective stats and Eviolite eligibility without
   draft changes. Extend the Damage Calculator flow for field containment and stable row geometry
   at representative desktop and narrow viewports.
8. Add focused Team Builder component and Playwright assertions for the expanded `Remove` control.
   Assert that it calls the existing direct `onRemove` path exactly once, creates no confirmation
   dialog or second state path, and leaves collapsed-card controls unchanged.
9. After the i8 release and consumers are compatible, the deployment owner updates the reviewed
   data pin and reload semantics/tests. The lifecycle resolves i8 before mutation, atomically marks
   the existing session `reloading` with i8, rebuilds, loads and explicitly activates i8 in the
   preserved human-review database, and returns the same session to `ready`.
10. Each owner runs focused checks and returns observed evidence to the active human-review workflow.
   Do not run independent review or full-cycle delivery yet.

## Focused verification

The data owner runs focused `src/data/tests/test_bundle.py` coverage through the backend uv project
and established local build, validation, and semantic-diff commands. Evidence must show
deterministic extraction from the pinned Showdown revision, exact fractions and conditions, no
modifier for excluded effects, prior-release retention, and no hand-edited generated records.

The backend owner runs focused `test_pokemon_data.py` and `test_teams.py` coverage through
`src/backend/pyproject.toml`, plus Ruff formatting/lint and mypy for owned changes. Evidence must
show strict serialization, correct version/regulation scoping, malformed facts failing closed, and
no per-item or per-member query growth.

From `src/web`, the Web owner runs focused Team Builder model/contract/app and Damage Calculator
component tests, `npm run check`, and the authenticated Team Builder and Damage Calculator browser
specs through the already-running local human-review runtime when available.

The deployment owner runs `bash -n` and ShellCheck for the changed script, focused
`deploy/tests/human-review.bats`, and `.codex/lint.sh`. The tests must prove that reload adopts an
updated valid pin without replacing the session or volume; unchanged pins remain idempotent;
missing/malformed pins and missing or mismatched release artifacts fail before marker/runtime
mutation; an interrupted advancing reload retains `STATE=reloading`, i8, credentials, and review
data for exact retry even if the environment pin changes again; partial-starting recovery retains
its original marker bundle; status never consults or adopts a changed pin; and the command never
touches ordinary `bagredex-local` resources.

Observed evidence must show:

- Choice Scarf changes only Speed by the exact 1.5 modifier; Choice Band changes only Attack;
  Choice Specs changes only Special Attack; and Assault Vest changes only Special Defense;
- Eviolite changes Defense and Special Defense for an eligible `is_nfe` form and changes neither
  stat for an ineligible fully evolved form, reevaluating on form or Mega-preview changes;
- a selected item-suppressing ability leaves all six values at their pre-item values;
- changing item, nature, or SP recomputes immediately with Showdown's calculation and rounding
  order, and item-derived values never enter the serialized draft;
- Life Orb, pinch berries, type damage boosters, and other non-stat effects leave Real Stats
  unchanged;
- an expanded card exposes one `Remove <Pokémon name>` button next to `Collapse <Pokémon name>` in
  logical tab order; activating it calls the established `onRemove` path exactly once, removes only
  that member, performs existing transient cleanup, and does not open a new confirmation dialog;
- the collapsed form still exposes its existing earlier/later and remove actions, and toggling card
  state never renders duplicate remove controls or causes header overflow at desktop, tablet, or
  phone widths;
- the visible modifier trigger is `+` but retains its move-specific accessible name,
  `aria-expanded`, and `aria-controls`, with focus restoration after all dismissal paths;
- ordinary moves reserve no trigger space, contextual moves retain readable/editable text and
  usable suggestions, and activation does not change move-row geometry; and
- anchored desktop and phone-dialog behavior remains functional and contained at configured
  desktop, tablet, and `390 x 844` phone widths in supported themes.

Before returning each round, run `.codex/lint.sh` from the repository root and correct owned
findings. Do not report a check as passed unless its output was observed.

## Risks and constraints

- Reserve input space only for move fields that have a trigger. Keep one native button as both the
  visible trigger and overlay anchor, and preserve deliberate stacking with the combobox list.
- A small glyph still needs a practical hit area, visible focus, contrast, and a descriptive name.
- Adding a second removal handler would let expanded and collapsed cards diverge in confirmation,
  transient cleanup, or draft updates. Both controls must call the same `onRemove` prop, with the
  parent retaining sole ownership of removal behavior.
- Header actions can crowd the nickname at narrow widths. Reuse the existing flex/wrap treatment
  and verify names and controls remain readable without horizontal overflow.
- Do not change contextual-input defaults, move selection/reset semantics, calculator contracts, or
  the established overlay lifecycle.
- Callback inspection is brittle if it silently accepts new Showdown shapes. Restrict extraction to
  reviewed exact patterns and fail closed with an actionable diagnostic.
- JavaScript floating point or ordinary flooring can diverge from Showdown modifier rounding. Carry
  positive integer fractions and one tested exact rounding helper through the contract.
- Treating Eviolite as an ID special case would apply it to fully evolved forms. Serialize `is_nfe`
  and a closed normalized condition instead.
- Copying the Damage Calculator's item-ID branches would create a second mechanics source. Use
  normalized importer facts; later consolidation of existing calculator branches is separable.
- A new release changes runtime data even if legal item availability is unchanged. Preserve prior
  versions, review the semantic diff, and activate only through the lifecycle-owned reload path.
- Leaving `reload` marker-only would rebuild i8 code against the i7 active database, making the new
  contract untestable or stale. Conversely, direct marker edits or teardown/restart would violate
  lifecycle recovery and session continuity. Resolve the reviewed pin inside `reload` and use its
  existing atomic marker writer before any runtime mutation.
- If activation fails after i8 is loaded, the marker intentionally remains `reloading` with i8; do
  not roll the marker back to i7 or delete the new immutable version. Exact reload retry completes
  idempotently while preserving review data.

## Completion criteria

- Contextual moves have one right-aligned `+` inside the move field; ordinary moves have none; and
  the trigger consumes no separate grid column or responsive row.
- Existing modifier state, damage updates, geometry, dismissal, focus, accessibility, theme, and
  responsive behavior remain intact and covered by focused tests.
- Real Stats displays exact baseline item-modified values from normalized Showdown facts for all
  legal always-active modifiers, including named Choice, Assault Vest, and conditional Eviolite
  cases, while excluded effects do not change the card.
- Eviolite eligibility and unconditional item suppression use strict normalized facts; the Web
  client has no item/ability mechanics allow-list.
- Expanded member cards expose the same accessible remove action beside collapse, preserving the
  established direct removal path; collapsed-card behavior and state cleanup do not regress.
- The new immutable release and bumped dataset agree across schema, loader, serializer, TypeScript
  parser, fixtures, and focused tests; prior releases load and the saved draft contract is unchanged.
- The existing human-review session advances from its start-pinned i7 bundle to reviewed i8 only by
  `./bagredex.sh human-review reload`, while retaining target, base commit, credentials, project,
  volume, and review data; status reports i8 after readiness.
- Reload advancement and interruption are covered by deployment tests, require no marker edit or
  session restart, and preserve the skill's partial-reload recovery path.
- Focused owned checks and repository lint complete with observed output, or an unavailable local
  capability is reported without bypassing project restrictions.

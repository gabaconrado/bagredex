# Battle Mode human-review refinement

## Outcome

Apply the accepted feedback from the active Battle Mode human-review session. Replace the separate
pre-battle screen with an always-visible empty workspace, move team choice into an accessible modal,
prevent non-ready teams from being selected, and make changing teams the only in-page full reset.
Reorganize the arena into left/right fields, integrate turn order into that field card, place Field
Effects beside the damage workflow, and make opponent entry match the
Pokédex-style autocomplete interaction. A second accepted feedback round removes the visible page
heading, gives both rosters the same two-column card grid, embeds opponent entry in the first roster
slot, and arranges the four active slots as a two-by-two field. A third accepted feedback round
removes the visible and announced post-addition success message from opponent entry. A fourth
accepted feedback round adds effective-Speed copy, field-card stage and Mega controls, and removes
redundant turn-order qualifications. A fifth round restores compact active cards, moves calculated
stats and their stage controls into both roster editors, and reduces the remove icon's visual size.
A sixth round changes Stat Points to sliders, shows staged stat values, limits each sidebar to one
selected editor, and resolves compact-card control overlap. A seventh round merges Stat Points and
staged values into one section, simplifies the stage controls, and gives the always-expanded
opponent editor a deliberate information order.
An eighth round centers the effective-Speed cards, moves Field Effects into an always-visible card
below **Selected attacker**, and compacts each Stats row onto one line where space permits.
A ninth round attempted to reserve the turn-order height needed by a two-member Speed tie while
keeping every individual Speed card at the same single-row height; the fourteenth round supersedes
that reserved-height decision because it did not remove the observed flicker.
A tenth round adds explicit Helping Hand controls for attacks from either side by reusing the
calculator's existing attacking-side field input.
An eleventh round reuses the established move-information dialog from the other Web tools when a
Damage-pane move is activated and removes the duplicate **Exact rolls** block from expanded damage
results.
A twelfth round corrects the shared move dialog's missing presentation in Battle Mode after the
review screenshot exposed that Vite emitted its CSS in an imported chunk which the current Django
entry-style tag does not load.
A thirteenth round adds the canonical full move description to the pinned calculator dataset and
the shared Battle Mode move dialog. A fourteenth round makes the spread override side-specific,
adds the selected attacker's sprite, and replaces opponent ability, item, and move selects with
exact-context autocomplete fields that begin unknown.

This is a focused refinement of the completed feature, not a new feature-development cycle. During
the open session, implement the round, run focused owner checks, and reload the supported review
environment. Independent review, complete validation, the supplemental report, and Git mutation
remain deferred until the user explicitly finishes human review.

## Original artifacts and base

- Original plan: [Battle Mode](2026-10-24-battle-mode.md)
- Original report: [Battle Mode report](../reports/2026-10-24-battle-mode.md)
- Reviewed base commit: `306d632767d9914cb94e8124f4c79014ab39c642`
- Active review target: `battle-mode`

The original plan, report, and commit remain unchanged. This supplement supersedes their pre-battle
selection, Start over, arena organization, turn-order presentation, Friend Guard inference, and
Accounted Effects requirements. The active lifecycle marker is operational state and must not be
edited, deleted, finished, or retargeted directly.

## Confirmed feedback and decisions

The user requested the following observable changes:

- remove the pre-battle banner/screen and begin on an empty Battle Mode layout;
- make **Your team** open team selection and reset the battle when another team is chosen;
- omit visible `[Gen 9 Champions]` regulation prefixes because regulation is global state;
- remove **Start over**;
- place the user's field on the left and the opponent's field on the right;
- put turn order inside the field card instead of a separate card;
- make Field Effects use the Damage Calculator's bottom-sticky panel behavior;
- make opponent Pokémon entry a full-width Pokédex-style autocomplete with sprites, an
  `<Enter>` hint on result rows, and no separate **Add** button;
- prevent invalid teams from being selected instead of surfacing the problem after battle entry;
- give each Pokémon in a Speed tie its own vertically adjacent rectangle;
- remove Accounted Effects; and
- add **Friend Guard** to both side-specific Field Effects groups.

The second feedback round additionally requested:

- remove the visible **Battle Mode** header;
- give the user's and opponent's rosters the same three-row by two-column layout;
- keep opponent addition in the first roster-card position until the roster reaches six members;
- show the `<Enter>` hint only on the active autocomplete result and omit already-selected Pokémon
  from its choices; and
- arrange the four active field slots as two rows by two columns.

The third feedback round additionally requested removal of the visible `<Pokémon> added` message
after an opponent is added.

The fourth feedback round additionally requested:

- replace **Speed tie** copy with each tied Pokémon's calculated Speed value;
- remove the visible **Priority ignored** qualification;
- enlarge occupied field cards and move compact stat-stage and Mega controls onto them;
- replace **Bench** with a small red remove control in the occupied card's top-right corner; and
- remove move details from the user's roster editor so it retains only current HP and status as
  mutable battle information.

The fifth feedback round additionally requested:

- restore the compact occupied field-card presentation because the enlarged cards are too large;
- return stat controls to both sidebars, with each calculated stat followed by its boost stage; and
- make the red X bench control visually smaller.

The sixth feedback round additionally requested:

- move the smaller red X farther into the active card's top-right corner;
- use Stat Point sliders and smaller `<` and `>` stage controls in the sidebars;
- show the real staged stat value rather than the unstaged value beside a separate stage;
- show exactly one selected ally editor and one selected opponent editor; and
- reposition Mega Evolution so it never obscures the Pokémon name.

The seventh feedback round additionally requested:

- merge **Stat points** and **Stats and stages** into one non-duplicative stats section;
- add HP to that section without stage controls;
- replace the `<` and `>` stage glyphs with unboxed red `−` and green `+` controls;
- remove the opponent **Observed set** header and collapsible section; and
- order opponent information as HP/status, ability/item, moves, stats, then nature.

The eighth feedback round additionally requested:

- center the effective-Speed cards within the turn-order area;
- replace the sticky Field Effects menu with an always-visible card below **Selected attacker**; and
- fit each Stats row's label, Stat Point slider, value, and boost controls on one line.

The ninth feedback round additionally requested:

- give turn order a stable default height that already fits a two-Pokémon Speed tie; and
- keep non-tied and tied Pokémon rectangles at the same single-row height instead of stretching
  other Speed tiers when one tier contains a tie.

The tenth feedback round additionally requested **Helping Hand** in Field Effects for damage
calculations.

The eleventh feedback round additionally requested:

- open the same move-detail modal used elsewhere when a Damage-pane move is activated; and
- remove the second **Exact rolls** section because the calculation description already contains
  the roll values.

The twelfth feedback round additionally requested that the Battle Mode move dialog match the
established dialog presentation on the other pages. The supplied
`references/screenshots/Screenshot 2026-10-23 205417.png` shows a raw black rectangular surface,
collapsed spacing, a tiny misplaced close control, concatenated mechanics fields, and flags without
the established pill layout. The screenshot is regression evidence and remains unchanged.

The thirteenth feedback round additionally requested the canonical full move description, rather
than the short description, in the Battle Mode move dialog.

The fourteenth feedback round additionally requested:

- replace **Spread hits one target** with independent **Single Target** Field Effects controls for
  each side;
- show the selected attacker's sprite immediately after the **Selected attacker** label; and
- keep opponent **Status** and **Nature** as selects while changing **Ability**, **Item**, and
  **Moves** to empty-first, Pokémon-valid autocomplete text fields; and
- restore Turn Order's compact pre-round-nine non-tie height, allowing the section to grow when a
  tie appears instead of reserving tie space.

The fifteenth feedback round additionally requested:

- initialize a newly added opponent with its first legal Ability so damage cards work immediately;
- remove visible **Unknown…** placeholder copy from the opponent set comboboxes; and
- enlarge the sprite beside **Selected attacker**.

The interview established these details:

- before a valid team is selected, the complete empty arena remains visible while opponent and
  battle controls are disabled;
- teams that are not ready remain visible in the selection modal, disabled, with a concise reason;
- selecting another valid team resets immediately when no battle progress exists;
- once battle progress exists, selecting another valid team requires confirmation before the
  in-memory state is discarded.
- The opponent add card always occupies the first visual roster slot while the opponent has zero to
  five members. It disappears when the sixth member is added, allowing all six members to occupy
  the grid, and returns to the first slot after a removal.
- The two-by-two field preserves the previously accepted side mapping: the user's two slots form
  the left column and the opponent's two slots form the right column.
- Move information is not relocated to the field cards. Once an active Pokémon is selected, its
  moves remain available only in the existing Damage pane.
- Both selected-member sidebar editors show **Atk**, **Def**, **SpA**, **SpD**, and **Spe** as a
  staged stat value immediately followed by previous-stage, current-stage, and next-stage controls.
  Each editor also shows the member's 0–32 Stat Points as sliders; opponent sliders are editable and
  the user's saved-team sliders are disabled. The sprite-adjacent Mega toggle remains on an
  eligible active field card; only stats and stages move back to the sidebars.
- The field remains two-versus-two. Each sidebar shows only one member editor at a time: one ally
  and one opponent, selected independently only from that side's occupied field cards. Roster-card
  activation retains its placement behavior and does not change either editor selection.
- The opponent-only information order does not restore move controls to the user's editor. The own
  editor remains limited to HP/status and the merged read-only stats section.
- The red `−` and green `+` stage controls look like compact text labels but remain native buttons
  with keyboard, screen-reader, focus, and touch behavior.
- Field Effects is always visible in normal flow directly below **Selected attacker**. It has no
  sticky or disclosure behavior.
- Turn Order is optimized for ties of no more than two Pokémon. Larger unexpected ties retain safe,
  readable semantic output but do not require a separately optimized layout.
- Opponent item suggestions include items in the active regulation except an item assigned to
  another opponent. Ability and move suggestions use only the selected form's legal abilities and
  exact learnset. The current opponent's selected item remains available while editing.

No material product question remains.

## Goals

- Make the arena itself the stable Battle Mode entry surface with an obvious team-selection action.
- Make Battle Mode team eligibility authoritative before selection without changing Team Builder's
  persistence validation or hiding saved teams.
- Keep the damage workflow visually cohesive while preserving exact damage, effective-Speed,
  switch, and field state.
- Keep high-frequency active-Pokémon Stat Point and stage controls in the corresponding sidebars and
  Mega controls on the field without duplicating values, sliders, or own-team move information.
- Give rapid opponent entry the repository's established accessible autocomplete behavior.
- Make own and opponent roster density and card geometry directly comparable.
- Keep one explicit source for Friend Guard and one existing damage-engine input.
- Reuse the calculator's existing attacking-side Helping Hand input without adding a parallel
  mechanic or inferred partner state.
- Reuse one established move-detail dialog implementation across Battle Mode and its existing Web
  consumer rather than creating a Battle-only dialog.
- Keep opponent knowledge entry fast and valid by filtering local autocomplete choices from the
  pinned calculator dataset rather than accepting arbitrary text or issuing requests.
- Preserve keyboard, pointer, and touch parity in light and dark desktop, tablet, and phone layouts.

## Non-goals

- Changing Team Builder save rules, team persistence, regulation pinning, or the global regulation
  selector.
- Requiring every move or held item before a team can enter Battle Mode. Empty move slots and an
  unknown item remain supported battle knowledge.
- Saving, restoring, sharing, or URL-encoding battle state.
- Changing damage or effective-Speed formulas, move priority behavior, Stat Point rules, legal
  stage bounds, switch-stage resets, HP semantics, opponent set editing, species clause, or six-
  member limits.
- Adding automatic turn advancement, duration tracking, new partner abilities, or new imported
  Pokémon data.
- Adding a dependency, framework, client state library, model, migration, mutation API, or
  deployment change.
- Fetching Pokédex or Team Builder details after the versioned calculator dataset supplies the
  pinned legal move's mechanics and canonical full description locally.
- Running finish-time review, complete validation, reports, or Git mutation before explicit human-
  review finish.

## User-visible behavior

### Empty workspace and team selection

- After the calculator dataset loads, Battle Mode renders its normal workspace immediately. There
  is no `Live VGC reference` banner, team-card landing page, **Start battle**, or **Start over**.
- There is no visible **Battle Mode** page header. The island retains an accessible page or landmark
  name without adding a second visual heading. It does not repeat the imported regulation name or
  its `[Gen 9 Champions]` prefix; the global selector remains the sole visible regulation indicator.
- The user's roster panel heading is a native button or contains a clearly associated native button
  named **Your team**. Activating it opens the team-selection modal both before and during a battle.
- Before team selection, own roster and both own field slots show deliberate empty states. Opponent
  entry, roster manipulation, placement, editors, damage controls, field controls, and other
  battle-state mutations are disabled. The empty arena itself is not hidden or replaced.
- The modal lists every owned saved team pinned to the exact active version and regulation in the
  existing deterministic order. Team name and ordered preview sprites remain visible. The global
  regulation name is not repeated on cards or empty-state copy.
- A selectable team loads its owner-checked detail and becomes the current team without a separate
  start step. Loading stays inside the modal, prevents duplicate activation, and exposes an
  actionable error without discarding the current battle. On first selection, success closes the
  modal, hydrates the own roster, and focuses the **Your team** control.
- Escape and Cancel close the modal without a reset. Focus is trapped while open and returns to the
  invoking **Your team** control. The modal uses native controls, `aria-modal`, an accessible title,
  logical list semantics, visible focus, and touch targets of at least 44 CSS pixels.
- With no saved teams, the modal explains that no teams exist and links to Team Builder. With saved
  teams but no battle-ready choice, it explains that teams must be completed in Team Builder and
  preserves the regulated Team Builder link.

### Battle Mode readiness

- Django computes Battle Mode readiness for each exact-context owned team and serializes a Boolean
  readiness state plus one concise user-facing reason in its summary. Preact treats these fields as
  untrusted and parses them strictly.
- A battle-ready team has at least one member. Every persisted member resolves within the team's
  exact regulation to its saved non-Mega profile, nature, optional item, and each optional move; it
  also has a legal ability so every own active member can become a calculator combatant. Existing
  position, species, item, move, SP, and Mega-preview invariants continue to apply.
- Empty teams and teams with a missing/illegal required Battle Mode fact stay visible but disabled.
  Reasons identify the corrective category without leaking private detail, for example **Add at
  least one Pokémon** or **Choose an ability for every Pokémon**. Team Builder remains the editing
  boundary.
- Missing moves and held items do not make a team unavailable. Their absence already has defined
  Battle Mode behavior; any present move or item must still be valid for the pinned context.
- Client detail parsing and exact version/regulation validation remain defense in depth. A team that
  becomes stale or unavailable after page render fails closed in the modal and is not installed.
  The disabled summary state is never used as an authorization boundary.

### Team changes and reset semantics

- Selecting the current team again closes the modal without changing battle state.
- Selecting a different ready team is the only in-page full-reset action. It clears opponent roster,
  board occupancy, HP/status/set edits, stages, attacker/placement selection, spread override, and
  every field effect, then installs the new own roster at its saved initial values.
- `battle progress` means any state beyond the freshly installed team: an opponent has been added;
  a Pokémon has been placed or selected as attacker; an HP, status, stage, Mega, opponent-set, spread,
  or field value differs from its initial value. Merely opening/closing the modal is not progress.
- With no progress, selecting another ready team loads and resets immediately. With progress, the
  existing styled alert-dialog pattern asks for confirmation before loading or resetting. Cancel
  retains the entire battle and returns focus; confirm copy names the selected replacement team and
  states that current battle state will be discarded.
- Load and parse the prospective team before destroying the current session. A request, ownership,
  stale-context, or parsing failure leaves the existing battle intact and reports the error in the
  modal. Once a validated replacement is available and confirmation is satisfied, install it in one
  reducer transition so partial mixed-team state is not representable.
- Departure protection begins when a team is installed or while a prospective team is loading and
  otherwise retains the original external-navigation, logout, regulation-change, reload, and tab-
  close behavior. The removed **Start over** action has no replacement outside team selection.

### Two-by-two field and turn order

- Desktop and tablet render one field card as a two-row by two-column slot grid: the two **Your
  field** slots form the left column and the two **Opponent field** slots form the right column.
  Each side retains its heading and two distinct accessible active slots. Semantic DOM and focus
  order remain user side then opponent side even though visual rows pair one user slot with one
  opponent slot.
- The field card contains turn order after the two sides in document order. It retains the existing
  exact effective-Speed and Trick Room ordering but renders no **Priority ignored** or **Ignore
  priority** qualification. Removing that copy does not make move priority part of this Speed-only
  ordering.
- Every ordered Pokémon has its own rectangle. Equal-Speed Pokémon are vertically adjacent inside
  their shared ordered group and each displays `Speed <value>` using that row's calculated effective
  Speed instead of **Speed tie**. The shared group styling and accessible description continue to
  communicate that equal values are unresolved; stable rendering order must not be presented as a
  battle-order resolution. Unequal groups retain first-to-last visual order and the same exact
  effective-Speed labeling.
- Center the ordered groups and their member rectangles as a set within the available turn-order
  area rather than leaving the cards aligned to one edge. Centering is visual only: DOM order,
  first-to-last reading order, unresolved tie grouping, card widths, and calculated Speed values do
  not change. The centered set must shrink or wrap within its container without page-level
  horizontal overflow at supported widths.
- Remove the round-nine reserved two-row minimum height and restore the compact pre-round-nine Turn
  Order height when no tie is present. A two-member tie may increase the section height and reflow
  the content below it; this deliberate intrinsic expansion replaces the unsuccessful attempt to
  prevent flicker through reserved empty space.
- Keep each Pokémon rectangle at the same normal single-row height regardless of whether its tier is
  tied. A two-member tie stacks two normal-height rectangles inside that tier; sibling unequal tiers
  must not stretch to match the tied group's combined height through grid or flex equalization.
  Ties larger than two need only remain semantically correct, readable, non-overlapping, and safe
  from clipping or crashes; they do not require additional visual optimization or a dedicated test
  matrix in this round.
- A phone may stack the two field columns vertically to avoid unusably narrow cards, but it
  preserves user-before-opponent semantic and focus order and keeps turn order within the same field
  card.

### Active field cards and roster details

- Restore occupied field slots to the compact size and information density used before the fourth
  feedback round. Within the accepted two-by-two layout, each card contains only its readable
  identity, sprite, dedicated attacker/placement selection, eligible Mega toggle, and bench control.
  Remove the five-row stat-stage grid from the field card without changing empty-slot placement,
  user-left/opponent-right mapping, or field-card selection behavior.
- Keep the occupied card's outer container non-interactive. Attacker selection, bench, and Mega
  remain sibling native controls, with no nested interactive elements. Clicking a child control
  performs only that control's action and does not also change attacker selection.
- Keep the red X icon bench control anchored at the occupied card's top-right corner, but reduce the
  visible button and glyph from the fourth-round presentation and move its visual mark farther into
  that corner so it does not float over the card body. Preserve an invisible or padded hit area of
  at least 44 CSS pixels, visible focus, the explicit **Bench <Pokémon>** accessible name and title,
  and the existing bench transition, including stage reset behavior. The hit area must not overlap
  the name, Mega, or selection controls. Benching remains a placement action, not a delete action.
- When the member's item permits Mega Evolution, place the same `MegaIcon` pressed toggle-button
  pattern used by the Damage Calculator in the sprite region, with a dedicated position that never
  overlays or obscures the readable Pokémon name at desktop, tablet, or phone widths. Preserve the
  existing `aria-pressed`, action label/title, eligibility, form/ability mapping, HP clamping, and
  damage semantics. Render a stable placeholder only if needed to keep card geometry aligned; do
  not show an inert Mega control for an ineligible member.
- Each selected-member editor has one merged stats fieldset instead of separate **Stat points** and
  **Stats and stages** cards. It contains exactly one row each for **HP**, **Atk**, **Def**, **SpA**,
  **SpD**, and **Spe**; do not render a second slider, stat output, or stage row elsewhere in that
  editor.
- At desktop and tablet widths, every Stats row uses one horizontal sequence in this DOM and visual
  order: short stat label, Stat Point slider with its Stat Point output, calculated in-battle value,
  then stage decrement/current-stage/increment controls. The **HP** row uses the same label, slider,
  and value alignment but reserves no empty boost controls. Do not solve alignment by duplicating
  labels or outputs.
- At narrow phone widths, a Stats row may wrap at deliberate group boundaries when the full sequence
  no longer fits. It must not cause horizontal overflow, clip slider/value text, reorder focus, or
  reduce the existing touch-safe stage-control targets. The DOM and tab sequence remain label,
  slider, value, then boosts even when CSS wraps the row.
- Every merged row contains its labeled 0–32 Stat Point range slider and associated numeric Stat
  Point output. Opponent sliders update the existing `member.sp` values locally. The user's sliders
  render the saved values but are disabled because Battle Mode does not edit saved-team training
  data. Slider arrow-key behavior, focus, value exposure, and touch operation use native range-input
  semantics.
- The **HP** row also shows the calculated maximum HP produced by the active form, nature, and HP
  Stat Points. It has no stage value or decrement/increment controls because HP does not use battle
  stages. Current HP remains in the separate HP/status section and continues to clamp to the
  recalculated maximum where existing semantics require it.
- The **Atk**, **Def**, **SpA**, **SpD**, and **Spe** rows show the real in-battle value produced by
  applying the member's current stage to the existing active-form, nature, and Stat Point value
  through the Damage Calculator's authoritative `applyBattleStage` helper. Stage zero equals the
  calculated unstaged value. The output updates immediately after a Stat Point, nature, form, Mega,
  or stage change and must not apply the stage a second time in damage or effective-Speed
  calculations.
- Each non-HP row places native buttons labeled visually `−` and `+` around the current signed
  stage value. Style them as compact, unboxed text labels: decrement is red, increment is green,
  enabled controls use a pointer cursor, and disabled controls have a distinct disabled treatment
  without a pointer cursor. They disable at `-6` and `+6`, retain visible focus and touch-safe hit
  areas, and expose the Pokémon, stat, direction, and current stage through descriptive accessible
  names. They update existing `member.stages` state and calculation paths without changing bench,
  switch, team-replacement, or reset semantics.
- The user's selected-member editor retains identity, **Current HP**, **Status**, and the merged
  stats fieldset with disabled Stat Point sliders. Its **Known moves** list and empty-move
  placeholders remain absent. Do not add moves to roster cards or active field cards. Move names and
  damage selection remain solely in the existing Damage pane after an active Pokémon is selected.
- The opponent editor is always expanded and has no **Observed set** summary, `<details>` wrapper,
  or collapse control. After its identity header, render information in this exact order: **Current
  HP** with **Status**; **Ability** with **Item**; **Moves**; the merged stats fieldset; then
  **Nature**. Status and Nature remain native selects. Ability, Item, and each Move slot are labeled
  text-field comboboxes backed by canonical local choices. Stat Point, HP, status, and set changes
  retain their existing local editing and calculation semantics. Mega remains only on the occupied
  field card.
- A newly added opponent begins with the first legal Ability in the form's deterministic dataset
  order, no Item, and four empty Move slots. This explicit default supersedes the fourteenth-round
  unknown-Ability behavior so damage cards work immediately without inventing an illegal choice.
  Missing Item and Moves remain valid partial observations. Reset, removal, and team replacement
  retain their existing state boundaries.
- When an opponent Item or Move is unset, its combobox input is visually blank. Do not render
  **Unknown item**, **Unknown move**, ellipsis variants, or similar placeholder/title copy in any
  Ability, Item, or Move text field. The initialized Ability displays its canonical name. Proper
  associated labels and combobox ARIA relationships remain the accessible names; blank visual
  values must not remove field identity or state announcements.
- Each opponent set combobox follows the established project keyboard and accessibility model:
  focus or typing opens a bounded full-width listbox; the first filtered result is active; Arrow
  keys move it; Enter or pointer/touch activation commits it; and Escape closes without committing.
  `aria-expanded`, `aria-controls`, `aria-activedescendant`, option selection, visible focus, and a
  concise status/error region describe the same state. A typed string never mutates member state
  until it exactly matches or explicitly commits a listed option. On blur, an uncommitted query
  reverts to the last committed display value, including the empty value.
- Ability choices contain only the current non-Mega form's legal ability IDs. Move choices contain
  only that form's exact `move_ids` learnset. Item choices contain the active dataset's items minus
  items committed to other opponent members; the current member's committed item remains eligible
  while editing. Another opponent's item change recomputes item choices and reconciles a stale
  active descendant before another interaction. Ability and Move legality remain tied to the
  member's saved non-Mega form; the existing Mega relation continues to derive its locked battle
  form and ability without rewriting observed base-set knowledge. Empty Item and Move choices
  remain explicitly clearable; Ability may be cleared back to unknown.
- Render at most one member editor per sidebar while retaining the two-versus-two field. The first
  occupied field slot in that side's semantic slot order becomes the default editor selection when
  the side first gains an active member. Activating another occupied field card changes only that
  side's editor selection; the ally and opponent selections are independent UI state. The field-
  card action may retain its existing attacker/placement behavior, but editor selection must not be
  derived from the global attacker alone.
- Roster-card activation never changes an editor selection; it retains only the existing placement
  workflow. If the selected member is benched, removed, or replaced, select the first remaining
  occupied slot on that side in semantic order, or render no editor when that side has no active
  member. Team replacement and full reset clear both editor selections before the same deterministic
  default is established from later field placement.

### Equal roster grids and opponent add card

- The user's roster and opponent's roster use equal-width card geometry and the same three-row by
  two-column grid at desktop and tablet sizes. Both retain six-Pokémon capacity, consistent sprite
  treatment, readable names, active/selected state, and touch targets. A narrow phone may reduce to
  one column only when needed to prevent clipping.
- While the opponent roster contains fewer than six Pokémon, a Pokémon-card-sized native **Add
  Pokémon** control is the first visual grid item. Existing opponents follow it in stable roster
  order. The add card is not counted as a team member and does not reduce the six-member capacity.
- Adding the sixth opponent removes the add card and renders all six opponents across the full
  three-by-two grid. Removing any opponent restores the add card as the first visual item and shifts
  the remaining stable-order members after it; it does not renumber member identities or change
  battle-state semantics.
- Before own-team selection, the disabled add card remains visible as part of the deliberate empty
  layout. Activating an enabled card reveals and focuses the autocomplete associated with that card.
  Closing or successfully committing the autocomplete returns focus to the add-card position or its
  replacement without introducing a separate **Add** button.

### In-flow Field Effects, Friend Guard, and Helping Hand

- Field Effects is an always-visible normal-flow card directly below the **Selected attacker** card
  in the center Damage pane. Remove the sticky bottom-menu placement, summary/disclosure control,
  collapsed state, safe-area inset behavior, bounded expanded body, and sticky-specific shadow or
  scroll containment.
- The card uses no sticky or fixed positioning, JavaScript geometry, synthetic bottom clearance, or
  duplicated controls. It follows **Selected attacker** in visual and document order, remains
  usable at desktop, tablet, and phone widths, and does not create page-level horizontal overflow.
- Existing weather, terrain, Trick Room, Tailwind, Reflect, Light Screen, and Aurora Veil controls
  retain their current calculation semantics. Add one pressed **Friend Guard** toggle to **Your
  side** and one to **Opponent side**. Add one pressed **Helping Hand** toggle to each of those
  side groups using the same accessible toggle pattern. Add one pressed **Single Target** toggle to
  each side group and remove the global **Spread hits one target** control from the Selected
  attacker card.
- Friend Guard is explicit defending-side field state. When calculating damage into a side, that
  side's toggle maps directly to the existing calculator `defender.friendGuard` Boolean. It does not
  affect damage dealt by that side.
- The previous active-partner Friend Guard inference is removed. Ability editing remains unchanged,
  but an active partner with the Friend Guard ability does not silently change the toggle or engine
  input. This prevents automatic and manual sources from competing after Accounted Effects is
  removed.
- Helping Hand is explicit attacking-side state. When a member attacks, only its side's toggle maps
  to the existing calculator `attacker.helpingHand` Boolean. The opposing side's toggle does not
  affect that attack, a side's toggle does not apply while that side defends, and no move or active
  partner infers or synchronizes the value.
- The two Helping Hand values are independent, default to false, and return to false through the
  same team-installation and reset boundary as every other field effect. Reuse the existing damage
  engine modifier and calculator contract without changing its formula or adding data/backend work.
- Single Target is explicit attacking-side field state. For a spread move, only the current
  attacker's side value supplies the calculator's existing single-target override. The opposing
  side's value does not affect that attack, and a side's value has no effect while that side
  defends. Both values are independent, default to false, and reset with the other field effects.
  This relocates and splits the existing override; it does not change spread-move detection or the
  damage formula.
- Controls remain grouped with readable **Field**, **Your side**, and **Opponent side** labels and
  never expose camel-case identifiers. State changes are announced deliberately without announcing
  every unrelated high-frequency edit.

### Selected attacker identity

- Render the selected attacker's pinned local sprite immediately after the **Selected attacker**
  label. Increase its reserved square from the current `2rem` to `3rem` so it is clearly visible
  without becoming the primary heading content. Reserve those dimensions before image load so
  switching attackers does not shift the Damage pane. The image is decorative with empty
  alternative text because adjacent accessible attacker text names the same Pokémon; it must not
  create a duplicate announcement.
- Use the same active-form and Mega-aware sprite resolution as the rest of Battle Mode. The sprite
  remains legible without covering the label, action controls, or damage content in light/dark
  desktop, tablet, and phone layouts. No attacker selected means no sprite and retains the existing
  empty Damage-pane guidance.

### Opponent autocomplete

- Opponent entry is one custom combobox/listbox associated with the first-position add card, not a
  native `datalist`. Its input and popup use the full available roster-panel width and follow the
  shared Pokédex search-field/result presentation and the repository's established autocomplete
  keyboard model without importing an entire feature island.
- Focus or typing opens filtered legal non-Mega forms. Each result row displays its local normal
  sprite and Pokémon name. The active row also displays a visible `<Enter>` key pill. The pill is a
  hint, not a separate focusable action, and is hidden from assistive technology when the row's
  accessible name already describes the result.
- Arrow keys move the active option, Enter adds the active/exact result, Escape closes the list, and
  pointer/touch activation adds the row. `aria-expanded`, `aria-controls`, `aria-activedescendant`,
  `role="listbox"`, `role="option"`, selected state, visible focus, and a status message describe the
  same state.
- The first filtered result is active whenever the list opens or the query changes. Only the active
  result renders the visible `<Enter>` key pill; moving the active option moves the single pill with
  it. Pointer hover and keyboard navigation update the same active option.
- Every form whose base species is already present in the opponent roster is excluded before query
  filtering, result slicing, active-index calculation, and listbox rendering, matching the existing
  species-clause guard. Removing that opponent makes the species' legal forms eligible again. The
  existing add-path duplicate guard remains defense in depth rather than the normal interaction.
- A successful addition clears the query and restores focus for rapid entry. It does not render a
  persistent or transient `<Pokémon> added` message and does not send that success copy through a
  live region; the roster update and restored focus provide the interaction result. Duplicate-
  species, missing form mapping, and six-member failures retain the query and provide an
  actionable inline/status explanation. No **Add** button is rendered.
- The combobox and popup use the available panel width. Results remain bounded and scrollable at
  desktop, tablet, and phone sizes; sprites do not distort rows or cause horizontal overflow.

### Move details and damage rolls

- Each valid move name in the Damage pane is a native button that opens the project's established
  move-information dialog. Opening details does not change the selected attacker, field state,
  target expansion, spread override, or calculated result.
- Extract the existing Pokédex move-information presentation and native-dialog lifecycle into the
  smallest shared Web primitive rather than copying its focus trap, close behavior, or move field
  layout into Battle Mode. Keep the existing consumer's output and interaction behavior unchanged.
- The shared dialog receives a normalized, already-validated view model. Battle Mode adapts the
  move from the active pinned `CalculatorData`: resolve `type_id` through that dataset's type map,
  derive **Always hits** from a null accuracy, and display category, power, accuracy, PP, priority,
  formatted target, flags, and the canonical non-empty full description supplied by that move's
  exact-regulation `MoveProfile`. It does not fetch another endpoint or invent prose.
- Pointer, Enter, and Space activation open the modal. Escape, the close control, and backdrop
  activation close it; focus enters the close control and returns to the exact move-name invoker.
  The modal has one accessible title, trapped focus, visible focus, and the established light/dark
  responsive surface.
- Expanded per-target damage results retain the existing calculation description, whose preserved
  newline and parenthesized roll list expose exact rolls. Remove the separate
  `<strong>Exact rolls:</strong>` paragraph and its joined roll list.
- No-damage reasons and empty-roll results continue to render their calculation description once.
  Range, percent, KO text, target identity, spread context, and disclosure semantics remain
  unchanged; move-modal activation and target-result expansion are independent controls.

### Shared move-dialog presentation

- The shared move-information dialog renders with the same established presentation in Pokédex
  and Battle Mode: modal backdrop, bounded responsive surface, border, radius, shadow, header,
  title, close control, spacing, mechanics grid, type/target/flag pills, typography, focus styling,
  and light/dark design tokens. Battle Mode has no consumer-specific visual fork.
- The Vite build currently extracts `src/move-information.css` into the imported
  `_move-information-*.js` chunk. The generated entry records import that chunk, but their direct
  `css` arrays contain only the entry stylesheet. Django's `vite_styles` tag emits only that direct
  array, so Battle Mode never links the extracted shared stylesheet. Pokédex retains overlapping
  legacy selectors in its entry stylesheet, which masks part of the same integration defect.
- Keep this correction Web-only: make both consuming Vite entry points explicitly import the one
  authoritative shared move-information stylesheet so it is included in each entry's emitted CSS,
  and remove the transitive component-level CSS import that creates the unlinked shared CSS chunk.
  Do not copy rules into Battle Mode or change Django's general manifest traversal during this
  focused review round.
- Preserve the native dialog element, focus trap and exact invoker focus return, Escape/backdrop/
  close-control behavior, normalized move view model, pinned-data adapter, and all displayed move
  mechanics. This round changes asset integration and presentation, not dialog state or data.
- Focused build evidence inspects the generated manifest and CSS output so both `src/pokedex.tsx`
  and `src/battle-mode.tsx` directly receive the authoritative move-dialog rules. Component and
  browser regressions cover both consumers, supported widths, and light/dark presentation.

### Removed presentation

- Remove the entire Accounted Effects details/list and its display-only derivation. Keep the actual
  damage, spread, HP conversion, Mega, contextual defaults, field, and Speed calculations intact.
- Remove Battle Mode's visible raw regulation-name copies, including the old header eyebrow and
  selection empty-state sentence. Preserve canonical names in transport contracts where they are
  required for strict compatibility; this is a presentation change, not imported-data mutation.

## Scope and ownership

### Backend owner: `backend_coder`

Exclusive implementation ownership:

- `src/backend/bagredex/battle_mode/bootstrap.py` for authoritative Battle Mode readiness and reason
  serialization with a bounded query shape;
- any narrowly shared read-only readiness helper under `src/backend/bagredex/battle_mode/**`; and
- `src/backend/tests/test_battle_mode.py` for schema, readiness, privacy, exact-context, and query-
  ceiling coverage;
- `src/backend/bagredex/damage_calculator/datasets.py` for the versioned calculator-data contract
  and exact-context move-description serialization; and
- `src/backend/tests/test_damage_calculator.py` for calculator dataset schema, description,
  exact-context, and bounded-query coverage.

The backend owner must not change Team Builder validation, models, migrations, imported data,
permissions, or mutation endpoints. Existing team detail remains the owner-checked hydration
boundary.

### Web GUI owner: `web_gui_coder`

Exclusive implementation ownership:

- Battle bootstrap contracts, reducer/domain transitions, components, and tests under
  `src/web/src/battle-mode/**` and `src/web/src/battle-mode.tsx`;
- `src/web/static/web/css/battle-mode.css`;
- `src/web/templates/battle_mode.html` only if an existing shell hook needs adjustment;
- narrow shared Pokédex/autocomplete, move-information dialog, or Damage Calculator Field Effects
  presentation primitives
  under `src/web/src/**` and `src/web/static/web/css/**` when extraction is demonstrably smaller than
  duplication and preserves existing consumers; and
- Damage Calculator contracts and focused test fixtures under `src/web/src/damage-calculator/**`
  needed to consume the versioned move-description field; and
- `src/web/tests/e2e/battle-mode.spec.ts` plus focused regression coverage for any shared primitive.

The Web owner must keep the calculator engine and effective-Speed helper authoritative, remove the
old Friend Guard inference path, and avoid coupling one mounted island's DOM to another.

The second through twelfth and fourteenth feedback rounds are Web-only: they change rendered
composition, local
interaction state, autocomplete filtering, and CSS but do not alter the completed
`battle-mode-bootstrap-v2` backend contract, database schema, persistence, or damage mechanics.
`backend_coder` has no new implementation work for these rounds. The fourth through tenth rounds
reuse the existing client-side stats and `applyBattleStage` helpers, stages, effective-Speed helper,
bench transition, Mega relation, `MegaIcon`, and Damage pane rather than introducing a new
interface. The eleventh round may extract the existing move dialog and move-field presentation into
a narrow shared Web module, with focused regression coverage for each changed existing consumer;
it does not widen the calculator dataset or request another endpoint. The twelfth round corrects
the shared stylesheet's entry integration in `src/pokedex.tsx` and `src/battle-mode.tsx` without a
backend template-tag change or duplicated consumer-specific CSS. The thirteenth round is a
coordinated backend/Web contract change: it versions the calculator dataset to carry canonical move
prose, while leaving the Battle bootstrap, persistence, imported records, and damage mechanics
unchanged. The fourteenth round consumes the existing v2 dataset's form `abilities`, form
`move_ids`, complete `items`, names, and sprite template entirely in local Battle Mode state; it
does not need a new transport field, request, model, or data artifact.

### Session, review, and delivery owners

- No `pokemon_data_coder`, imported `src/data` release, database schema, migration, deployment-file,
  or dependency change is planned. Focused Web fixtures live with the Web contract tests; the
  historical `src/data/fixtures/damage-calculator-data-v1.json` artifact remains a v1 fixture rather
  than being silently rewritten as v2.
- During the open review session, each coder runs focused checks for owned changes. Then the
  `deployment_agent` runs exactly `./bagredex.sh human-review reload` and reports the stable review
  fields.
- Only after explicit finish do `backend_reviewer`, `web_gui_reviewer`, and `architect` perform the
  independent and integration reviews, followed by the supplemental report, complete validation,
  reviewed-result commit, completion receipt/report correction, completion-record commit, and
  lifecycle `complete` acknowledgment required by the human-review skill.

Backend readiness and Web presentation are coordinated by the summary contract. For the thirteenth
round, the backend owner freezes `damage-calculator-data-v2` first; the Web owner may prepare shared
dialog work in parallel but must integrate the exact frozen move shape before handoff.

## Data and interface impact

### Battle bootstrap summary

Bump the Battle bootstrap schema because team summary shape changes. Each team summary keeps its
existing ID, name, pinned context, preview members, and timestamp, and adds:

- `battle_ready`: strict Boolean; and
- `battle_unavailable_reason`: `null` when ready, otherwise one non-empty concise display string.

The strict parser rejects contradictory pairs, extra/missing keys, non-local URLs, duplicate IDs or
positions, stale version/regulation context, and malformed readiness values. Do not reuse or weaken
the Team Builder bootstrap schema.

Compute readiness from prefetched authoritative rows without one query per team/member. Keep the
response owner-filtered and exact-row-filtered. Serialization must not expose another user's team,
member set data, or field-level validation details beyond the selected concise reason.

### Battle state

Replace the `started`/`start-over` lifecycle with explicit current-team identity plus an atomic
`install-team` transition. The empty state has no own members and all battle mutations are guarded
until a team is installed. Define and unit-test a pure `hasBattleProgress` predicate against the
freshly installed state rather than deriving progress from rendered DOM.

Extend each side's field state with `friendGuard: boolean` and `singleTarget: boolean` while
preserving its existing `helpingHand: boolean`. Installation/reset returns all six independent side
toggles and all other field values to false/empty. The calculation adapter passes only the
defending side's stored Friend Guard Boolean, only the attacking side's stored Helping Hand Boolean,
and only the attacking side's stored Single Target Boolean; delete `friendGuardPartner`, the global
`singleTargetOverride`, and their superseded mapping tests.

The modal may keep request state in the component, but only a successfully parsed and validated team
may enter the reducer. Use abort or stale-response identity protection so rapid choices cannot
install an earlier response over a later selection.

Keep the selected ally-editor and opponent-editor IDs as independent local presentation state, not
persisted battle data and not a bootstrap-contract field. Reconcile each ID after member/board
changes against that side's occupied slots: retain it while active, otherwise use the first occupied
slot in semantic order, otherwise `null`. Roster placement state and the global damage attacker
remain existing domain concerns and must not become aliases for these two editor selections.

New opponent construction sets `abilityId` to the form's first legal Ability in deterministic
dataset order while `itemId` and every `moveIds` entry remain `null`. The strict calculator dataset
already contains every interface needed for local set autocompletion: the member form identifies
legal `abilities` and `move_ids`, and the top-level arrays provide the canonical Ability, Move, and
Item names. Do not widen `damage-calculator-data-v2`. Combobox query, open, active-option, and
transient invalid-text state remain component presentation state; only a committed canonical ID
enters `BattleMember`. Item-clause filtering compares other opponent member IDs and never filters
the current member's committed item from its own choices.

### Calculator move descriptions

Bump the strict calculator dataset from `damage-calculator-data-v1` to
`damage-calculator-data-v2`. Adding a required move field to the exact-key parser is an incompatible
shape change; accepting it under v1 would make the schema identifier misleading. The bootstrap
schema and dataset URL mechanism remain unchanged because they already point to the active dataset
resource and validate its body independently.

Every v2 `moves` entry adds `description`, a non-empty string serialized from the canonical
`MoveProfile.description` selected through the same exact active regulation as the move's
mechanics. Django must not join another version or regulation, issue one query per move, or fall
back to Pokédex/browser fetching. The existing ordered `MoveProfile` query already loads this field,
so the response query ceiling should remain unchanged.

The strict Web parser requires `description` in the move's exact key set and rejects missing,
empty, non-string, or extra/malformed values. `CalculatorData.Move` exposes the required field;
calculation code continues reading only mechanics fields. Battle Mode passes it into the shared
normalized move-information view as its description. Pokédex continues supplying its existing
description through its existing contract, and neither consumer invents substitute text.

Do not rewrite the repository's named v1 fixture as though it were v2. Add or update focused Web
test data inside the Web-owned contract tests for v2 behavior; any future canonical v2 release
fixture under `src/data` remains a separate Pokémon-data-owned concern unless a finish-time check
proves it is required for this feature boundary.

## Implementation sequence

1. `backend_coder` defines the bumped bootstrap fixture and a pure/read-only Battle readiness policy,
   then adds prefetched serialization and backend tests for ready, empty, missing-ability, optional-
   move/item, stale-context, private, and bounded-query cases.
2. `web_gui_coder` updates the strict bootstrap parser/fixtures and replaces `started` plus
   `start-over` with empty/current-team, atomic installation, and tested progress/reset transitions.
3. Build the accessible team modal, disabled unavailable cards with reasons, first-team loading, and
   prospective-team failure/confirmation behavior without destroying current state.
4. Render the stable empty workspace and disabled pre-team controls; remove the landing banner,
   **Start battle**, **Start over**, and visible raw regulation labels.
5. Recompose the board as user-left/opponent-right inside one field card, move turn order into it,
   arrange its slots as a two-row by two-column grid, and render tied members as separate vertically
   adjacent rows while retaining group semantics.
6. Make the two roster panels use matching three-row by two-column card grids. Put opponent entry in
   the persistent first-position add card for rosters below capacity and remove the card at six.
7. Replace native opponent `datalist` plus **Add** with the add-card-triggered, full-width sprite
   autocomplete; exclude rostered forms and keep the `<Enter>` pill on only the active result while
   testing keyboard, pointer, touch, error, focus-return, duplicate, and limit behavior.
8. Extend side field state with Friend Guard, remove automatic partner inference, delete Accounted
   Effects, and verify that only defending-side toggle state reaches the existing calculator input.
9. Implement the accepted Field Effects groups, Friend Guard controls, and calculation mapping as
   one component; apply its final center-pane placement in step 19.
10. Remove the visible island header while preserving an accessible page/landmark name.
11. Remove the opponent-add success message and its live-region announcement while retaining query
    clearing, focus restoration, and actionable error/status feedback.
12. Add the top-right accessible red X control, bounded per-stat stage controls, and eligible Mega
    icon toggles, then apply the fifth-round placement below rather than retaining the superseded
    enlarged-card layout.
13. Keep the user's known-move list absent without changing the opponent observed-set editor or
    Damage pane move results.
14. Replace tie copy with each member's effective Speed, preserve unresolved tie grouping, and
    remove only the visible priority qualification.
15. Restore compact occupied field cards, keep the smaller accessible red X and eligible Mega icon
    beside the sprite, and move stat and stage controls into the sidebar editors before applying the
    sixth-round slider, staged-value, and one-editor-per-side refinements below.
16. Move the X visual into the top-right corner and give Mega a non-overlapping sprite-region
    position. Replace Stat Point number inputs with enabled opponent and disabled own sliders, use
    compact `<`/`>` stage buttons, and render each staged value through `applyBattleStage`.
17. Add independent per-side editor selection with first-active fallback. Update it only from
    occupied field-card activation, preserve roster placement behavior, and render no more than one
    editor in either sidebar.
18. Merge Stat Point sliders and calculated stats into one six-row fieldset per editor, omit stage
    controls from HP, and restyle the other rows with red `−` and green `+` controls. Remove the
    opponent disclosure and order its always-visible controls as HP/status, ability/item, moves,
    stats, and nature without restoring moves to the own editor.
19. Center the turn-order card set without changing semantic order. Convert every Stats row to the
    one-line label/slider/value/boost sequence with a deliberate phone wrap, then relocate the
    existing Field Effects controls into an always-visible card immediately below **Selected
    attacker** and delete all sticky/disclosure presentation state.
20. Keep each turn-order member rectangle at its normal single-row height and prevent tied groups
    from stretching unrelated Speed tiers. Round 14 removes this step's reserved two-row outer
    height, restoring compact non-tie height and allowing intrinsic expansion for a tie.
21. Add Helping Hand to both side groups, bind each toggle to that side's existing field value, and
    verify that the calculation adapter applies it only when that side attacks and resets it through
    the existing field reset boundary.
22. Extract the established move-information dialog and mechanics-field presentation into a narrow
    shared Web primitive, adapt pinned calculator moves to it, and open it from native Damage-pane
    move-name buttons without changing calculation state or target disclosures.
23. Delete the redundant **Exact rolls** paragraph while preserving the calculation description's
    single exact-roll list, no-damage copy, and the rest of each expanded result.
24. Move the authoritative move-information stylesheet import to both consuming Vite entry points,
    remove its transitive component import, and verify the built manifest/CSS plus both consumers'
    established light/dark responsive dialog presentation.
25. Have `backend_coder` publish `damage-calculator-data-v2` with required canonical full
    `description` values and focused schema, exact-context, and query-ceiling tests.
26. Update the strict Web calculator contract and focused fixtures to v2, pass the description into
    the shared Battle Mode move dialog, and cover rejection plus rendered prose without changing
    calculation behavior or the Pokédex contract.
27. Replace the global spread override with independent side `singleTarget` state and Field Effects
    toggles, then map only the attacker's side value through the existing calculation adapter.
28. Add the stable selected-attacker sprite and replace opponent Ability, Item, and Move selects
    with empty-first exact-context comboboxes backed by existing v2 form and catalog fields.
29. Remove the reserved Turn Order minimum height while retaining fixed single-row Speed cards,
    centered groups, and readable intrinsic expansion for a two-member tie.
30. Default a new opponent to its first legal Ability, keep unset Item and Moves visually blank
    without **Unknown…** placeholders, and enlarge the reserved selected-attacker sprite without
    overlap or layout shift.
31. Run focused backend and Web checks. Integrate against the already-running local human-review
   environment, then ask `deployment_agent` to reload the session for the next user pass.

## Open-session verification

### Backend owner checks

Run through the configured backend project:

- `uv run --project src/backend pytest src/backend/tests/test_battle_mode.py`
- `uv run --project src/backend pytest src/backend/tests/test_damage_calculator.py` for the focused
  dataset schema, description, exact-context, and query-ceiling cases
- configured backend formatter, linter, and type checks for changed Python files

Observe and record the exact commands. Do not run a finish-time full suite during the feedback round.

### Web owner checks

Run from `src/web` without installing or updating packages:

- focused Vitest for changed Battle contracts, state/domain helpers, calculation mapping, and
  components;
- `npm run check`; and
- focused build or Battle Mode browser coverage needed to make the reload usable.

Focused automated evidence must cover:

- empty workspace and disabled pre-team mutation controls;
- modal focus lifecycle, ready/unavailable cards and reasons, current-team no-op, request failure,
  stale-response protection, progress confirmation, cancel preservation, and atomic replacement;
- no **Start battle**, **Start over**, raw `[Gen 9 Champions]` copy, or Accounted Effects UI;
- no visible **Battle Mode** page header while an accessible page/landmark name remains;
- matching three-row by two-column roster grids and functional narrow-phone fallback;
- add-card first-position behavior at zero through five opponents, disappearance at six, restoration
  after removal, and stable six-member capacity/order;
- two-row by two-column field placement with user slots in the left column, opponent slots in the
  right column, user-before-opponent semantic/focus order, and functional phone stacking;
- turn order inside the field card, exact unequal ordering, separate vertical rectangles for ties,
  and visual centering of the ordered card set without changed DOM/reading order or overflow;
- tied rows showing their equal effective Speed values, unresolved group semantics, and no visible
  priority qualification;
- compact pre-round-nine Turn Order height for unequal tiers, no reserved two-row minimum height,
  and an expected intrinsic section-height increase when a two-member tie appears;
- identical single-row member-card heights for tied and non-tied Pokémon, two normal-height cards
  stacked for a two-way tie, and no grid/flex stretching of unrelated Speed tiers;
- compact occupied field cards with the small red X visibly in the top-right corner, at least a 44-
  pixel non-overlapping hit area, isolated bench/Mega/selection actions, and field placement/
  selection still working;
- eligible Mega icon toggles in a dedicated sprite-region position with the existing pressed state,
  form mapping, HP clamping, and reset behavior; no name overlap at supported widths and no inert
  control for ineligible members;
- exactly one independently selected ally editor and one opponent editor with first-active and post-
  bench/remove/replace fallback, selection updates from occupied field cards only, no selection
  updates from roster placement, and no editor when that side has no active member;
- one merged six-row stats fieldset per selected-member editor, with exactly one 0–32 Stat Point
  slider and one calculated value per stat, opponent sliders enabled, own sliders disabled, and no
  duplicate **Stat points** card;
- HP showing its calculated maximum and Stat Point slider without a stage or boost controls, while
  Atk/Def/SpA/SpD/Spe each show an independent bounded red `−`/stage/green `+` control, exact
  `applyBattleStage` rounding at positive and negative stages, and no double application in damage
  or effective-Speed results;
- each desktop/tablet Stats row fitting label, SP slider/output, calculated value, and boosts in one
  horizontal sequence, with logical DOM/tab order and deliberate non-overflowing phone wrapping;
- enabled stage controls presenting as unboxed text with pointer cursors while retaining native
  button semantics, keyboard operation, visible focus, touch-safe targets, and non-pointer disabled
  styling at the `-6`/`+6` bounds;
- the user's editor showing current HP, status, and the merged read-only stats fieldset without known
  moves or Mega text buttons; and
- the opponent editor remaining always visible without **Observed set** or a disclosure control,
  ordered HP/status, ability/item, moves, stats, nature, while the Damage pane retains its move role;
- manual Friend Guard on each defending side, reset behavior, and absence of partner inference;
- independent Helping Hand toggles on both sides, pressed-state accessibility, reset behavior, and
  damage changes only when the toggled side attacks, with no effect while it defends or from the
  opposing side's value;
- independent Single Target toggles on both sides, absence of the old global spread toggle, reset
  behavior, and spread override changes only when the toggled side attacks;
- the selected-attacker sprite appearing after its label at a clearly visible size with the correct
  active/Mega form, stable reserved dimensions, no duplicate accessible name, distortion, overlap,
  or layout shift at supported widths;
- new opponents starting with the first legal Ability in deterministic dataset order while Item
  and Moves remain unset, so damage cards work immediately without an invalid default;
- unset Item and Move combobox inputs remaining visually blank, with no **Unknown…** placeholder or
  title copy and no loss of their associated accessible labels;
- opponent Ability autocomplete limited to the form's legal abilities, Move autocomplete limited
  to its exact learnset, and Item autocomplete enforcing Item Clause across other opponents while
  retaining the current member's committed item;
- all six set comboboxes supporting filter, Arrow/Enter/Escape, pointer/touch, strict listed-value
  commit, clear-to-unknown, safe blur reversion, reconciled active descendants, accessible status,
  and no request while Status and Nature remain native selects;
- Damage-pane move names opening the shared move-information dialog with pinned type/category,
  power, accuracy, PP, priority, target, flags, and canonical full description;
  keyboard/pointer/backdrop/Escape behavior;
  trapped focus and exact invoker focus return; and no attacker, field, spread, calculation, or
  expanded-target mutation caused by opening or closing details;
- strict `damage-calculator-data-v2` acceptance, v1/missing/empty/malformed description rejection,
  unchanged mechanics parsing, and Battle rendering without an extra request;
- existing shared-dialog consumers retaining their content, focus lifecycle, and light/dark
  responsive presentation after extraction;
- the Battle Mode and Pokédex entry bundles each loading the one authoritative shared dialog
  stylesheet directly, with generated manifest/build evidence that does not rely on imported-chunk
  CSS traversal; no raw surface, concatenated metadata, undersized close control, or consumer-
  specific rule copy remains at supported desktop, tablet, and phone widths;
- expanded damage results exposing the exact roll list exactly once through the calculation
  description, with no separate **Exact rolls** label/list and no loss of no-damage reasons, range,
  percent, KO, target, or spread information;
- Field Effects immediately below **Selected attacker** as one always-visible normal-flow card at
  desktop, tablet, and phone sizes, with no sticky position, disclosure, duplicated controls, or
  synthetic bottom clearance;
- sprite result rows, full-width popup, Arrow/Enter/Escape, pointer/touch addition, exactly one
  active-result `<Enter>` hint, selected-form exclusion and re-eligibility after removal, focus
  restoration without visible or announced `<Pokémon> added` copy, duplicate/full-roster defense,
  actionable failure feedback, and absence of a separate **Add** button; and
- light/dark focus, disabled, empty, error, loading, confirmation, and reduced-motion states.

### Finish-time verification

After explicit finish, restore the original plan's complete backend, Web, Playwright, build, system,
migration, lint, and repository checks, adjusted for the superseded UI. Matching reviewers verify
their owned scopes and the architect verifies the final bootstrap/parser fixture, reset boundary,
calculation mapping, responsive layout, and observed evidence. Run `.codex/lint.sh` before review
handoff and before each commit as required by the repository workflow.

## Risks and controls

- **Eligibility can drift between page render and selection.** Keep owner-checked detail loading and
  exact-context client validation; disabled summary metadata is presentation, not authorization.
- **A failed team switch could destroy live state.** Fetch and validate first, confirm when needed,
  and install once through an atomic transition.
- **Progress detection can miss a mutation.** Centralize it as a pure tested state comparison, not a
  collection of component flags.
- **Manual and inferred Friend Guard could diverge.** Remove inference and map only explicit
  defending-side state to the existing Boolean engine input.
- **Helping Hand could apply to the wrong combatant side or stack with inferred state.** Map only
  the current attacker's side toggle to the existing `attacker.helpingHand` Boolean, keep the two
  sides independent, add no move/partner inference, and cover both attack directions plus reset.
- **Single Target could leak across attack directions.** Store it with each side's field state, map
  only the current attacker's side value to the existing spread override, delete the global value,
  and cover both attack directions plus reset.
- **A default opponent Ability could be illegal or unstable.** Choose only the first legal Ability
  in the form's deterministic dataset order, keep Item and Moves unset, and cover initialization,
  reset, and form-specific legality without inferring any other knowledge.
- **Blank set fields could lose their identity or acquire browser tooltips.** Omit visible
  **Unknown…** placeholder/title copy while retaining associated labels, combobox roles, status
  feedback, and canonical committed-value restoration.
- **Autocomplete choices can become stale or violate Item Clause.** Derive Ability and Move choices
  from the member form, filter Items against other opponents on every render, preserve the current
  member's value, and reconcile the active option whenever choices change.
- **A larger selected-attacker sprite can duplicate speech, distort, or shift controls.** Use a
  decorative image beside the existing text name, reserve its enlarged dimensions, preserve aspect
  ratio, and reuse active-form sprite resolution across supported widths.
- **Moving Field Effects can duplicate state or separate it from the attacker workflow.** Move the
  existing controls rather than cloning them, place the single instance immediately after
  **Selected attacker**, and remove sticky/disclosure CSS and presentation state without changing
  reducer or calculation inputs.
- **Autocomplete extraction could regress Pokédex or Team Builder.** Share only the smallest proven
  presentation primitive and run focused existing-consumer tests when shared files change.
- **Horizontal desktop intent can break document order or phones.** Keep semantic user/opponent/turn
  order independent of CSS placement and test keyboard focus plus narrow viewport overflow.
- **A first-position add card can accidentally reduce capacity or reorder identity.** Treat it as a
  presentation-only grid item, retain stable opponent member order and IDs, and cover the fifth,
  sixth, and post-removal transitions.
- **Filtering rostered forms can leave a stale active descendant.** Recompute the active option from
  the filtered list whenever the query or roster changes and clear the relationship when no option
  remains.
- **Removing success copy could also remove needed failure feedback.** Separate success and error
  status paths so successful additions stay quiet while invalid additions remain actionable.
- **A cornered field-card X can become hard to operate or cover adjacent controls.** Move only its
  visible mark while preserving at least a 44-pixel hit area, clear focus, event isolation, and no
  overlap with the compact card's name, selection, or Mega controls in either theme and narrow
  layouts.
- **Adding buttons inside the current slot button would create invalid nested controls.** Refactor
  occupied slots into a non-interactive card with sibling native controls, retain a dedicated
  attacker-selection action, and test click and keyboard event isolation.
- **Moving controls can duplicate or fork battle state.** Bind sidebar stages and field-card Mega
  directly to the existing member patch/reducer path, render stages in only one place, and test that
  damage, effective Speed, benching, team replacement, and reset read the same single state.
- **A staged display can diverge from damage or apply a boost twice.** Reuse `applyBattleStage` for
  display only, continue passing the unstaged calculated stats plus stage state through the existing
  engine contract, and test exact positive/negative rounding against Damage Calculator behavior.
- **Merging training and battle values can make HP appear boostable or duplicate inputs.** Build one
  row model from the existing Stat Point and calculated-stat state, branch HP explicitly without
  stage controls, and assert one slider and one calculated output per stat.
- **One-line Stats rows can compress native controls below usable sizes.** Give label, slider,
  value, and boosts explicit grid tracks at desktop/tablet widths, then wrap at group boundaries on
  phones while retaining DOM order, readable values, and touch-safe boost targets.
- **Text-like stage controls can lose interaction affordance or semantics.** Keep native buttons and
  focus/touch targets, use color plus signed glyphs rather than color alone, and limit pointer cursor
  styling to enabled controls.
- **Per-side editor selection can drift from the board or hijack placement.** Reconcile independent
  editor IDs against occupied slots after board changes, use semantic first-slot fallback, and test
  that roster activation changes placement without changing either editor.
- **Disabled own Stat Point sliders can imply editable saved data.** Use native disabled state and
  readable value output while keeping opponent sliders enabled; do not dispatch own-team SP changes
  or alter Team Builder persistence.
- **Stable ordering can falsely imply that a Speed tie is resolved.** Keep tied rows inside one
  semantic group and describe the tie accessibly even though each row now shows its numeric Speed.
- **Centering turn-order cards can reorder or clip them.** Center only the containing set through
  CSS, retain source order and group structure, and verify ties and long names at narrow widths.
- **A tie can still produce an intrinsic reflow.** Accept the section-height increase when a tie
  appears instead of reserving dead space, keep member-card height independent from group height,
  and verify compact non-tie layout plus readable expansion at supported widths.
- **Removing roster move details could accidentally remove Damage-pane moves or opponent set
  editing.** Scope removal to the user's known-move presentation and cover the two remaining move
  surfaces independently.
- **A copied Battle-only move dialog could drift from the other tools.** Extract the native-dialog
  lifecycle and normalized move-mechanics presentation into one shared Web primitive, keep feature
  state and dataset lookup in each island, and run focused regressions for every changed consumer.
- **A shared component CSS import can be emitted into an unlinked Vite chunk.** Import the one
  shared stylesheet explicitly from both consuming entry points, remove the transitive import, and
  inspect the production manifest/output so Django's direct-entry `vite_styles` behavior cannot
  silently omit the dialog rules again.
- **A calculator schema widening can desynchronize Django, strict parsing, and cached fixtures.**
  Version the dataset as `damage-calculator-data-v2`, freeze one required non-empty `description`
  move field, update both owners' focused tests together, and reject v1 or malformed payloads rather
  than silently accepting mixed shapes.
- **Move prose could come from the wrong regulation or add hidden query growth.** Serialize the full
  description from the same exact-regulation `MoveProfile` rows already loaded for mechanics,
  retain the query ceiling, and never fetch Pokédex details from the browser.
- **Removing Exact rolls could hide the values or remove unrelated result context.** Preserve the
  pre-wrapped calculation description and delete only the redundant paragraph, then assert one roll
  sequence plus unchanged no-damage, target, range, percent, KO, and spread behavior.

## Completion criteria

- Battle Mode opens directly on a stable empty arena; only ready owned teams can be installed from
  an accessible modal, and unavailable teams remain visible with corrective reasons.
- Changing teams is the sole in-page reset, preserves the current battle on load/cancel failure,
  confirms exactly when progress exists, and installs validated replacements atomically.
- The user's and opponent's rosters use equal three-row by two-column card grids; the opponent add
  card stays first below capacity, disappears at six, and returns after a removal without reducing
  the six-member limit.
- The user's field is the left column, the opponent's field is the right column, their four slots
  form a two-row by two-column grid, turn order is inside the shared card, and each tied Pokémon
  occupies its own vertically adjacent rectangle showing its equal effective Speed. The ordered
  card set is visually centered without changed semantic order or overflow. Its non-tie state uses
  the compact pre-round-nine height and may grow intrinsically for a two-member tie; every Pokémon
  rectangle keeps the same single-row height, and tied groups do not stretch unrelated tiers. No
  visible priority qualification remains, while Speed/Trick Room ordering mechanics are unchanged.
- Occupied field cards restore the compact presentation and retain an eligible Mega icon beside the
  sprite in a non-overlapping position plus a visually small red X set into the top-right corner
  with an accessible hit area. They contain no stat-stage grid and preserve isolated selection,
  Mega, and bench behavior.
- The two-versus-two field remains intact while each sidebar renders at most one editor. Occupied
  field-card activation selects that side's editor independently, roster activation remains a
  placement action, and selection falls back deterministically after board changes.
- Each selected-member editor has one merged six-row stats fieldset with one 0–32 Stat Point slider
  and one calculated value per stat. Opponent sliders edit the local observed set; own-team sliders
  show saved values in native disabled state; no duplicate Stat Point or calculated-stat card
  exists. Each desktop/tablet row fits its label, slider/output, calculated value, and boosts in one
  line, with a deliberate accessible phone wrap.
- HP shows its calculated maximum without a stage. Each current staged Atk/Def/SpA/SpD/Spe value is
  followed by independent bounded red `−`/stage/green `+` controls styled as text while retaining
  native button semantics. Display, damage, and effective Speed use the same authoritative stage
  rounding without double application.
- The user's selected-member editor exposes current HP, status, and the merged read-only stats
  section without a move list. The opponent editor is not collapsible and is ordered HP/status,
  ability/item, moves, stats, nature. Moves are not duplicated on roster or field cards and remain
  available through the Damage pane after attacker selection; opponent move editing remains intact.
- Activating a valid Damage-pane move opens the shared move-information dialog using only the
  active pinned `damage-calculator-data-v2`, including the canonical non-empty full description
  from that exact regulation, with established modal accessibility and exact focus return, and does
  not mutate battle or result state. Its surface, close control, mechanics layout, description,
  pills, typography, themes, and responsive sizing match the established Pokédex dialog because
  both entry bundles include the same authoritative stylesheet directly.
- Every expanded damage result shows exact rolls once in its calculation description and has no
  separate **Exact rolls** section, while all nonduplicated result context remains available.
- Opponent entry is add-card-triggered, full-width, sprite-backed, rapid, and accessible; only the
  active result shows the `<Enter>` hint, rostered forms are absent, and no separate **Add** button
  or visible/announced `<Pokémon> added` message exists. Successful additions still clear and
  refocus the autocomplete, while failures retain actionable feedback.
- Field Effects is one always-visible normal-flow card directly below **Selected attacker**, with no
  sticky/disclosure behavior. Friend Guard is an explicit per-side defender control and Helping
  Hand and Single Target are explicit per-side attacker controls; each maps only to the existing
  calculator input for its role and resets with field state. The old global spread toggle,
  Accounted Effects, and automatic effect inference are absent.
- The Selected attacker label includes a clearly visible, correctly resolved decorative sprite with
  reserved dimensions, correct aspect ratio, and no overlap, layout shift, or duplicated accessible
  naming.
- Newly added opponents begin with the form's first legal Ability in deterministic dataset order,
  while Item and Moves remain unset. Their editor keeps Status and Nature selects but uses exact-
  context Ability, Item, and Move comboboxes that reject invalid free text, respect the form's legal
  choices and opponent Item Clause, and remain fully local. Unset text fields are visually blank
  and contain no **Unknown…** placeholder or tooltip copy while retaining accessible labels.
- Battle Mode shows no visible page header or imported `[Gen 9 Champions]` labels and has no **Start
  battle** or **Start over** control while retaining an accessible page/landmark name.
- Existing exact damage, Speed, HP, spread, switch, opponent-editing, navigation-warning, privacy,
  and regulation behavior remains correct.
- Focused owner checks pass and the human-review session reloads successfully for another user pass.
  Independent review, full validation, reports, commits, and completion acknowledgment remain
  pending until explicit finish.

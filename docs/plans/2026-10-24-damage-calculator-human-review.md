# Damage calculator human-review refinement

## Summary

Apply the accepted feedback rounds from the active Damage Calculator human-review session. Improve
the collapsed Field Effects summary, stabilize empty and populated panel geometry, remove redundant
visible side labels, and compact the set/stat control order without changing calculation state or
mechanics.

This supplemental plan accumulates accepted feedback for the active session. By explicit user
direction, each open-session round contains implementation and a supported session reload only.
Automated tests, audit, independent review, full validation, this supplement's report, Git staging,
and a separate follow-up commit remain deferred until the user explicitly finishes the session.

## Original artifacts and base

- Original plan:
  [damage calculator layout refinement](2026-10-24-damage-calculator-layout-refinement.md)
- Original report:
  [damage calculator layout refinement report](../reports/2026-10-24-damage-calculator-layout-refinement.md)
- Reviewed base commit: `4b57ca970d7ec990529acc0811f70c2b9c28c348`
- Active review target: `damage-calculator`

The original plan, report, and commit remain unchanged. The active lifecycle marker is operational
state and must not be edited, deleted, finished, or retargeted directly.

## Round evidence

The user observed the following in the active browser session:

- the collapsed Field Effects summary is visually detached from its label and exposes identifiers
  such as `auroraVeil` rather than readable names;
- terrain values in the summary are ambiguous without the `Terrain` suffix, and flat tokens do not
  distinguish shared field state from Left and Right state;
- an empty Pokémon panel is shorter than a populated sibling, causing a distracting layout shift;
- visible `Left Pokémon` and `Right Pokémon` labels repeat placement information;
- Current HP and Status are separated from Nature by the entire stats section; and
- stage selectors are detached from their corresponding SP controls, making the vertical stat
  workflow less compact.

The requested grouped example is `Field: Sun, Grassy Terrain · Left: Aurora Veil, Friend Guard ·
Right: Helping Hand`. The feedback does not authorize a new field mechanic or control. In
particular, do not introduce another Tailwind control or any new effect identifier; render only
state keys already present in the current interface.

### Round 2 visual evidence

The user supplied two additional repository screenshots as review evidence only:

- `references/screenshots/Screenshot 2026-10-23 205417.png` shows the collapsed empty state. The
  complete calculator column and its two `Choose a Pokémon` cards shrink substantially rather than
  starting at the established populated desktop width and height.
- `references/screenshots/Screenshot 2026-10-24 152015.png` shows the populated desktop state. Its
  Current HP and Status controls form a detached row, and full-width visibly labeled stage selects
  do not align compactly with the SP number fields.

Both screenshots are untracked, user-owned evidence. No agent may edit, stage, regenerate, or
commit them. Round 2 established that equal empty cards alone were insufficient and initially
requested populated-layout width plus a baseline height. Round 3 below retains the width requirement
and explicitly supersedes the height interpretation.

### Round 3 visual evidence and correction

The newest review supersedes round 2's baseline-height decision:

- `references/screenshots/Screenshot 2026-10-23 205417.png` now shows the two empty cards with an
  artificial tall minimum height while their shared calculator column and individual card widths
  still shrink far below the populated layout. Equal tall cards are not the requested stability.
- `references/screenshots/Screenshot 2026-10-24 152757.png` shows the populated layout after the
  previous round. The Current HP percentage occupies a separate line above its number input and
  pushes that field out of alignment with Nature and Status. Stat labels, computed values, sliders,
  SP numbers, and stage selects still do not use stable shared columns across rows and panels.

Both screenshots remain user-owned evidence only. Round 3 requires exact populated-layout width
from the initial empty state but explicitly removes the empty-panel baseline/minimum height. Empty
card height is content-driven; height grows only after Pokémon selection (and an empty sibling may
then stretch to match populated content in the paired row).

### Round 4 root-cause evidence

No new screenshot was added for round 4. The two screenshots already recorded above remain prior
user-owned evidence. The user reports that the HP percentage correction is now effective, while
Firefox still shows the wrong initial empty width and drifting stat controls. Current CSS inspection
identifies two likely causes:

- `.site-main--damage-calculator` is itself a CSS grid with centered implicit auto-track placement.
  A child declaration of `width: 100%` can therefore resolve against the shrink-to-content implicit
  track before Pokémon selection instead of the full available main width.
- stat tracks are explicit, but native Firefox number/select sizing can still exceed or misalign a
  grid area unless each control is allowed to shrink, fills but does not exceed its track, uses
  border-box sizing, and shares identical compact block metrics.

Round 4 requires an explicit full-width parent grid track—prefer
`grid-template-columns: minmax(0, 1fr)` plus stretch behavior as needed—so the calculator receives a
definite available width before its existing maximum cap is applied. Do not change the established
populated `66rem` cap based only on the empty-state symptom.

### Round 5 state and display semantics

The user identified two state/display gaps after the layout rounds:

- changing HP SP changes maximum HP but currently preserves only an absolute/clamped current-HP
  number, rather than the user's pre-change HP ratio; and
- changing a battle stage affects damage but the visible stat output continues to show the
  unstaged set stat.

Code inspection confirms `updateSp` currently delegates to clamp-only `withClampedHp`, and the stat
output renders `currentStats[id]` directly. The engine's exact stage formula already exists as the
local `stage(value, amount)` helper in `engine/calculate.ts`, but it is not exported for UI reuse.
Round 5 may therefore make that helper a named exported Web-internal function and reuse it in both
engine and display code without changing its arithmetic or any transport/data contract.

### Round 6 Mega placement and shortcuts

The user requested two keyboard/layout refinements:

- place each valid Mega preview toggle immediately below that panel's Pokémon sprite/icon, matching
  the visual grouping used elsewhere in Bagredex; and
- use unmodified document keys `1` and `2` to focus the Left and Right Pokémon name inputs.

Inspection confirms the calculator `Choice` input opens its listbox on focus, so the shortcut needs
only to focus `left-pokemon` or `right-pokemon`; it must not synthesize input or duplicate combobox
state. Existing Team Builder number shortcuts use `event.key`, reject repeats and every modifier,
exclude editable targets, register on `document`, and clean up on unmount. Reuse that behavior
locally rather than importing the Pokédex helper, whose API and selectors are specific to `/` and
`?` shortcuts and would couple feature bundles.

### Round 7 Mega icon and Escape behavior

Code inspection found the established Mega visual primitive:

- `src/web/src/icons.tsx` exports `MegaIcon` backed by the single existing
  `assets/pokedex-icons/mega-evolution.svg` asset;
- Team Builder renders that decorative icon inside a native pressed `icon-toggle` with dynamic
  `Show Mega preview` / `Hide Mega preview` `aria-label` and matching `title`; and
- the established control is a circular `2.75rem` touch target with border, accent active state,
  visible focus inherited from the site, and a `1.25rem` icon.

The calculator must import and render that exact `MegaIcon`; do not add an SVG, emoji, data URL, or
second icon component. Its below-sprite button becomes icon-only visually while retaining a dynamic
accessible label and, because the established pattern uses it, the same string as `title`.

Escape inspection found that `Choice` currently closes its popup and restores committed text but
leaves the input focused, while round 6's document listener handles only `1`/`2`. Round 7 extends
that single calculator-owned listener. One unmodified Escape from a focused calculator control first
allows the target's local handler to close/reconcile its state, then the bubbling document handler
claims the still-unhandled event and blurs the active control. The next `1` or `2` can therefore
focus the requested Pokémon input immediately.

### Round 8 stable Mega visual slot

Round 8 supersedes the earlier below-sprite placement while retaining round 7's shared icon and
accessible-button requirements. The icon-only Mega toggle moves immediately left of the Pokémon
sprite. The sprite grows beyond the current `5rem` box by using the available header space.

Relation availability must not move or resize the sprite. The header visual group therefore always
uses the same two columns for a selected form: a `2.75rem` Mega-control slot on the left and a larger
fixed/responsive sprite track on the right. With a valid relation, the slot contains the existing
button. Without one, the same slot remains as an empty inert, noninteractive, `aria-hidden` layout
element—not a disabled or focusable fake button. Base/Mega toggling and relation/item changes keep
the visual group's width, sprite coordinates/dimensions, and header height stable.

### Round 9 locked Mega ability display

Code inspection identifies a display-choice mismatch rather than a calculation defect:

- `abilityId` and the effective `ability` correctly switch to `relation.locked_ability_id` while
  Mega preview is active;
- contextual ability controls and `buildCombatant` already consume that effective locked ability;
  but
- the disabled Ability `Choice` still receives only `base.abilities`, so its internal selected lookup
  cannot resolve a locked Mega ability that is not legal on the base form and displays a blank name.

While Mega preview is active with a valid relation, the Ability Choice must receive exactly one
choice: the resolved locked ability. It remains disabled and locked. When preview is turned off, the
control returns to the base form's legal choices and the previously selected stored base
`side.abilityId`; Mega preview must never overwrite that stored base selection or add the locked
ability to the base choices.

The existing parser already fails closed when a Mega relation's `locked_ability_id` is absent from
the regulation-wide ability dataset (`Calculator Mega references are invalid.`). Preserve that
validated boundary. Do not synthesize a fallback name, silently show the base ability during Mega,
or expand choices. If an impossible missing locked ability reaches presentation despite parsing,
surface an explicit unavailable/error state and suppress misleading calculation rather than showing
a blank Ability field.

### Round 10 bottom-sticky Field Effects

Current structure renders Field Effects before `.damage-matchup`, and its section is an ordinary
static card. Round 10 moves that section after the matchup in DOM order so it remains the final
normal-flow calculator child, then makes it sticky near the viewport bottom. It retains exactly the
same calculator/content width, collapsed summary button, expanded cells, state, and update handlers.

Use CSS sticky positioning rather than fixed positioning or JavaScript measurements. The section's
bottom edge stays at a safe-area-aware inset, with an opaque themed background, border, elevated
shadow, and a z-index above calculator cards/tooltips only where necessary. The containing
calculator remains centered and establishes no clipping ancestor that would disable sticky
behavior.

Expanded Field Effects grows upward within a maximum block size derived from the small viewport.
Its body scrolls internally when controls exceed that budget, with overscroll containment and a
stable visible summary/control. Desktop, tablet, and phone values must leave deliberate space above
for the application header/global controls; the panel must never consume the entire usable
viewport.

Round 10 initially proposed state-aware matchup padding matching the sticky footprint to improve
focus scrolling. The max-scroll evidence in round 11 below supersedes that proposal because the
padding duplicates space already contributed by the final normal-flow section. The open class
remains useful for styling the bounded body, but must not switch page-layout clearance.

### Round 11 max-scroll correction

Two new user-owned screenshots supersede round 10's page-clearance design:

- `references/screenshots/Screenshot 2026-10-23 205417.png` shows the collapsed bar at maximum
  scroll with a redundant bar-sized blank reserve between the matchup and Field Effects; and
- `references/screenshots/Screenshot 2026-10-24 173601.png` shows the expanded bar at maximum scroll
  with a viewport-scale blank region caused by reserving the bounded expanded maximum in addition
  to the section's own normal-flow height.

The current `205417` file contents are the round-11 collapsed max-scroll evidence; this latest use
supersedes the earlier round-2/round-3 description attached to the reused path.

Do not edit, stage, regenerate, or commit either screenshot. The defect is duplicated document
space: Field Effects is already the last normal-flow visible child and contributes its actual height
plus the calculator's existing gap. Remove collapsed and expanded `.damage-matchup` bottom padding,
layout spacers, and open-state clearance switching. At maximum scroll the collapsed card sits one
ordinary calculator gap after the matchup; the expanded card follows it without an artificial
viewport-scale void.

Targeted `scroll-margin-block-end` on late move/result/focus targets, or narrowly scoped root
`scroll-padding-block-end`, may remain only when it improves browser focus positioning without
adding document height. Such a focus offset must be no larger than the sticky footprint necessary
for the current state. The expanded body remains bounded and internally scrollable; do not reserve
its maximum height a second time in page flow. Move 6 remains operable above the sticky bar during
ordinary scrolling or after collapsing Field Effects.

## Goals

- Make the collapsed Field Effects summary left-aligned, readable, scoped, and concise.
- Humanize all active effect identifiers and disambiguate terrain names in the summary.
- Give the initial empty desktop/tablet matchup the exact same overall two-column container width
  and per-panel width as the populated layout, without an artificial panel height floor.
- Remove only the visible side-position labels while retaining accessible Left/Right panel names.
- Use one three-column top-field grid: Nature in column one, Current HP immediately after Nature in
  DOM order and beneath Ability in column two, and Status immediately after HP and beneath Item in
  column three.
- Put each non-HP stat's compact, unlabeled stage selector directly after a narrower SP number
  control in the same aligned row.
- Place the Current HP percentage inside the HP number-control boundary, right-aligned without
  obscuring the editable number, and preserve an accessible percentage relationship.
- Give every stat row the same explicit label, computed-value, slider, SP-number, and stage columns
  across both panels; reserve the final stage column in the HP row.
- Make the main grid's calculator track definite and full-width before applying the existing
  populated cap; keep the cap unchanged.
- Make compact SP number and stage select controls obey their assigned Firefox grid tracks with
  identical block height, alignment, padding, and border-box sizing.
- Preserve the pre-change current-HP ratio when HP SP changes maximum HP, using exact integer-floor
  scaling and safe bounds, without changing explicit HP edits on unrelated updates.
- Update each visible non-HP stat output immediately when its current UI stage changes, using the
  engine's exact stage helper once for presentation while keeping unstaged stats and stages separate
  in calculation state.
- Group each available Mega preview button immediately left of its enlarged sprite without changing
  when it is available or how base/Mega state resets, and reserve its column when unavailable so
  relation changes do not shift the header.
- Add safe document-level `1`/`2` focus shortcuts for the Left/Right Pokémon comboboxes without
  hijacking typing, native controls, assistive interaction, or ordinary Tab order.
- Replace visible Mega toggle text with the established shared Mega icon pattern while retaining a
  dynamic accessible action name and all current state behavior.
- Make one unmodified Escape release focus from a calculator field/control after its local close or
  reset behavior, without claiming global page/dialog events.
- Show the exact locked Mega ability in the disabled Ability control during preview, then restore the
  retained base selection and base contextual semantics when preview ends without broadening either
  form's legal choices.
- Keep Field Effects available as a centered bottom-sticky bar throughout calculator scrolling, with
  bounded accessible expansion and focus offsets that do not duplicate its normal-flow height.
- Preserve focus, accessible labels, linked range/number SP inputs, immediate recalculation, and all
  current calculator state and mechanics.

## Non-goals

- Adding, removing, renaming, or changing the behavior of weather, terrain, side effects, stages,
  stats, moves, abilities, items, or damage formulae.
- Adding Tailwind or another field-effect control. Existing state is rendered as-is; this round
  does not expand the `SideEffects` contract.
- Changing backend serialization, normalized Pokémon data, routes, persistence, the active data
  release, or the Preact/Django ownership boundary.
- Changing Pokémon selection defaults, Mega behavior, current-HP clamping, SP limits, stage limits,
  reset-on-Pokémon-change behavior, or calculation timing.
- Hiding the selected Pokémon/form name or the `Choose a Pokémon` prompt.
- Forcing two stacked phone panels to share the height of content that is no longer adjacent.
- Changing underlying stage numbers: `+0` is display text for numeric zero, not a new value.
- Folding stage multipliers into stored set stats, current SP, or the combatant's unstaged stat
  input, which would cause the engine to apply a stage twice.
- Rescaling current HP for non-HP SP, stage, status, nature, item, or ordinary explicit HP edits.
- Adding a Mega toggle without an exact current base-form/item relation, changing locked abilities,
  or changing item/Pokémon invalidation of Mega preview.
- Making digit shortcuts select a Pokémon, clear text, operate move/ability/item choices, or fire
  while the user is interacting with another control.
- Creating or copying a Mega icon asset/component, showing visible Mega action text beside the icon,
  or changing the established icon's artwork.
- Treating Escape as a page-global blur command, closing native/dialog UI outside the calculator,
  or overriding an already handled or modified Escape event.
- Persisting the locked Mega ability into `side.abilityId`, adding it to base-form legal choices, or
  changing the normalized Mega relation/data contract.
- Making Field Effects viewport-fixed, changing its mechanics/defaults, permanently preventing
  access to Move 6, trapping page scroll, or measuring panel height in JavaScript when bounded CSS
  geometry is sufficient.
- Finishing the session, running independent review or full final validation, writing the
  supplemental report, or creating a commit before explicit user finish.

## User-visible behavior

### Collapsed Field Effects summary

- The `Field Effects` label and summary begin at the same inline edge. The summary may wrap onto
  following lines instead of being pushed to the far edge or silently ellipsized.
- With no active condition, the summary remains the concise `None active`.
- Active values are grouped in stable order: shared `Field`, then `Left`, then `Right`. Empty groups
  are omitted. Groups are separated by ` · `; values inside a group are separated by `, `.
- `Field` contains weather first and terrain second when present. Terrain names gain the suffix
  `Terrain` only in the summary, such as `Grassy Terrain`; toggle-cell labels remain `Grassy`,
  `Electric`, `Psychic`, and `Misty`.
- Identifier labels are converted to readable title case, including `auroraVeil` to `Aurora Veil`,
  `friendGuard` to `Friend Guard`, and `helpingHand` to `Helping Hand`.
- The summary reflects only existing active controls. It does not synthesize a new Tailwind value or
  any other mechanic absent from the rendered state; an already-rendered active control remains
  eligible for the summary like every other current control.

### Pokémon panels and control order

- At the paired desktop and tablet layout, the calculator column starts at exactly the same overall
  width as the populated layout and each empty `Choose a Pokémon` panel occupies exactly one of the
  same two columns. Neither the container nor cards shrink-wrap around empty controls.
- Empty panels have no selected-state minimum or baseline height: two initially empty cards are only
  as tall as their visible content. Once one side is populated, ordinary grid stretching may keep
  the paired sibling equal to that real content height. At the phone breakpoint, panels remain
  stacked and content-driven.
- The visible `Left Pokémon` and `Right Pokémon` eyebrow text is removed. Each `<article>` keeps an
  accessible side-specific name such as `Left Pokémon`; the visible selected form name or `Choose a
  Pokémon` heading remains.
- For a selected Pokémon, the top field grid uses three stable desktop columns. Gender when present,
  Ability, and Item occupy the first row. Nature starts the second row in column one, Current HP is
  next in DOM order and aligns beneath Ability in column two, and Status follows HP and aligns
  beneath Item in column three. If Gender is absent, explicit grid placement preserves those column
  relationships rather than allowing auto-placement to shift Nature, HP, or Status. Optional Mega
  preview and Stats follow the grid.
- Each stat row keeps its readable stat label/output, linked SP range, and SP number field. For
  Attack, Defense, Sp. Atk, Sp. Def, and Speed, a narrower stage select follows a narrower SP number
  field in the same compact aligned row and in DOM/focus order. HP has no stage selector.
- Stage selects have no visible repeated `Attack stage`-style label, but retain exact accessible
  names such as `Attack stage` through `aria-label` or equivalent visually hidden semantics.
  Displayed options are `-6` through `-1`, `+0`, and `+1` through `+6`; their values remain numeric
  `-6` through `6`. SP remains `0` through `32`, and either SP input continues to update its linked
  partner, displayed stat, HP clamp when relevant, and damage immediately.
- The Current HP percentage is displayed inside the same visual control boundary as the editable
  HP number, aligned to the right. The number receives enough inline-end padding that the value and
  percentage never overlap. The percentage remains programmatically associated with Current HP and
  updates immediately when HP or maximum HP changes.
- Every stat row in both panels uses the same five explicit columns: stat label, computed stat,
  slider, compact SP number, and compact stage select. Identical intrinsic/fixed column definitions
  align controls across all rows and both panels. The HP row reserves the stage column with a
  noninteractive layout placeholder so its preceding columns do not expand or shift.

### HP ratio and staged stat display

- When HP SP changes and therefore changes maximum HP, current HP becomes
  `floor(oldCurrentHp * newMaxHp / oldMaxHp)`, then is capped to the inclusive range
  `0..newMaxHp`. The calculation uses the pre-change displayed form and stats for `oldMaxHp` and the
  post-change side/form for `newMaxHp`.
- Full HP remains full, zero remains zero, and a manually edited partial HP value retains its
  pre-change ratio subject to integer floor. Flooring is authoritative, so increasing then
  decreasing HP SP need not recover the original integer.
- If `oldMaxHp` is zero, non-finite, or otherwise invalid, ratio division is skipped. Preserve the
  existing current-HP integer as far as possible by clamping it to `0..newMaxHp`; never divide by
  zero, produce `NaN`, or silently reset to full.
- Non-HP SP edits, stage edits, status/nature/item changes, and ordinary recalculation preserve the
  explicit current-HP integer. A direct Current HP edit remains authoritative until a later HP SP
  change intentionally ratio-scales it.
- Selecting or replacing a Pokémon still uses `newSide` and initializes that new selection to full
  HP with zero SP/stages. Clearing a selection retains the existing empty-side reset. Mega/form/item
  transitions retain the current absolute-HP clamp semantics: preserve the number unless the new
  maximum requires capping; do not apply the HP-SP ratio rule to form changes.
- Attack, Defense, Sp. Atk, Sp. Def, and the currently rendered Speed stage immediately update their
  visible computed stat output. `+0` displays the ordinary unstaged stat. Positive and negative
  values use the engine's existing exact stage multiplier and floor semantics.
- The displayed staged number is presentation only. `currentStats` remains the unstaged result of
  form, nature, and SP; `Side.stages` remains separate; `buildCombatant` continues to pass both to
  the engine, which applies the stage exactly once during damage or effective-speed calculation.

### Mega visual group and digit shortcuts

- For every selected form, the panel header visual group uses two stable columns: a Mega-control
  slot immediately left of a larger sprite. When the base form and held item produce a valid
  `mega_item_relations` entry, the slot contains the existing `Preview <Mega form>` / `Use base form`
  button. The larger sprite keeps the same track, rendered dimensions, and coordinates before and
  after relation or Mega-state changes.
- The button displays only the shared `MegaIcon`; it retains the current dynamic accessible action
  name (`Preview <Mega form>` or `Use base form`) in `aria-label`, repeats that string in `title` like
  the established Team Builder pattern, and retains `aria-pressed`, the existing update callback,
  locked-ability behavior, and form/HP clamping. Changing the Pokémon or item continues to clear an
  invalid preview. If no valid relation exists, no disabled, empty, or placeholder toggle appears.
- Its circular control uses the established icon-toggle dimensions, border, surface, active accent,
  contrast, pointer/touch target, and visible focus treatment. The decorative icon remains hidden
  from assistive technology so the button's accessible name is announced once.
- Without a valid relation, the left slot remains present at exactly the same size but contains no
  control. It is inert, noninteractive, excluded from accessibility, and has no disabled/focusable
  placeholder. The sprite and header do not flicker, shift, resize, or change height when the slot
  becomes active or empty.
- The slot/button precedes the decorative sprite in JSX to match left-to-right visual order. Since
  the sprite is not focusable, the Mega button retains the same relative tab position before the
  Pokémon input, and all remaining controls keep their ordinary relative Tab order and names.
- Enlarge the sprite through one responsive size variable/track that remains constant across
  relation, item, base, and Mega state at a given viewport. Size the header to that same visual track
  and keep the complete two-column group contained at desktop, tablet, and phone widths.
- With focus outside interactive/editable content, pressing unmodified `1` focuses the Left Pokémon
  text combobox and pressing unmodified `2` focuses the Right Pokémon text combobox. The existing
  `onFocus` behavior opens its listbox; the shortcut does not alter its text, selected value, active
  option, or Pokémon state.
- Match existing app shortcut behavior by using `event.key === "1"` / `"2"` rather than physical
  `event.code`. Ignore a shortcut when `defaultPrevented`, `repeat`, Shift, Alt, Control, or Meta is
  active, or when the event target is inside any input, select, textarea, button, link, summary,
  contenteditable region, combobox/listbox/option/button-like ARIA widget, or other focusable
  interactive element. This protects typing and native control behavior.
- Claim the key with `preventDefault()` only when the corresponding input exists, is enabled, and
  will receive focus. If data is loading, the input is absent, or it cannot be focused, do nothing.
  Normal Tab/Shift+Tab and screen-reader navigation are unchanged.
- Register one document `keydown` listener in a Preact effect and remove that exact listener during
  effect cleanup/unmount. Avoid per-panel listeners and duplicate registration on rerender.
- Pressing an unmodified, nonrepeating, not-already-prevented Escape while focus is on an interactive
  control inside `[data-damage-calculator-root]` performs one deterministic action: component-local
  Escape behavior runs first, then the document handler prevents the remaining default and blurs
  the currently focused calculator control. For a Choice combobox, this means its popup closes and
  transient text restores before focus is released; one press is sufficient.
- Escape does nothing when focus is outside the calculator root, inside a dialog, on noninteractive
  page content, or when Shift/Alt/Control/Meta is held, the event repeats, or another handler already
  prevented it. Native dialog/global page behavior remains untouched. Normal Tab and screen-reader
  navigation remain the primary path.

### Locked Mega ability choice

- Outside Mega preview, Ability behaves exactly as before: it displays the stored base
  `side.abilityId`, offers only `base.abilities`, and changing it clears the base ability context.
- During an active valid Mega preview, Ability displays the exact name referenced by
  `relation.locked_ability_id`, receives that one `Named` value as its complete choices array, and
  remains disabled. It does not offer base alternatives or mutate `side.abilityId`.
- The effective locked ability continues to drive contextual-input descriptors/defaults and
  calculation. The Choice display and those existing effective-ability paths therefore agree.
- Toggling preview off reveals the same previously selected base ability ID/name because the stored
  ID was never replaced. Preserve the current toggle reset of `abilityContext`: restored base
  contextual controls use their normal defaults/semantics rather than stale Mega context values.
- Changing item or Pokémon retains the current invalid-preview clearing/reset behavior. A later
  valid preview again derives its locked display from the active relation only.
- Missing locked-ability data is a contract failure, not an empty-choice case. The existing parser
  must continue rejecting it before ready state. Any defensive presentation branch must explicitly
  mark the calculator/side unavailable and prevent a calculation that silently omits or substitutes
  the ability.

### Sticky Field Effects behavior

- Field Effects follows `.damage-matchup` as the last visible child of the ready
  `.damage-calculator`; the existing visually hidden live announcement may remain after it in DOM
  order. The section therefore has a normal document position and semantic button-to-region
  relationship even without sticky support.
- In supported browsers, the card uses `position: sticky` with a small block-end inset that includes
  `env(safe-area-inset-bottom)`. It spans `width: 100%` of the same capped centered calculator column
  and never becomes viewport-wide independently of the Pokémon panels.
- The sticky card uses an opaque `var(--color-surface)` background, existing border/radius, an
  elevated shadow, and a deliberate calculator-local z-index. It remains below any application
  header/dialog layer and cannot overlap the header because its expanded maximum leaves a fixed
  top viewport reserve.
- Collapsed behavior is unchanged: the full summary button toggles expansion, keeps
  `aria-expanded`, displays grouped active state, and remains keyboard/touch operable.
- Expanded behavior is unchanged semantically and mechanically, but its body has a bounded
  `max-block-size` based on `100svh`/`100dvh` minus the summary, sticky insets, and application-header
  reserve. Overflow scrolls inside the body; field buttons remain in normal focus order, with visible
  focus and no clipping. Responsive grid columns continue adapting at existing breakpoints.
- Add an explicit open modifier to the Field Effects section, for example
  `field-effects--open`, solely for CSS geometry. It does not duplicate or replace Preact `open`
  state.
- Do not add `.damage-matchup` bottom padding, a layout spacer, or an expanded-state clearance
  variable. The section's actual normal-flow height and the existing calculator gap are the sole
  max-scroll separation from the matchup in both states.
- Targeted `scroll-margin-block-end` for late move/result/context controls, or Damage
  Calculator-scoped viewport `scroll-padding-block-end`, may account for the current sticky
  footprint only when needed for focus positioning. These properties must not add layout height or
  reserve the expanded maximum twice.
- Scrolling or focusing Move 6, its result, its disclosure, or its contextual inputs keeps the
  target operable without an artificial blank region. Pointer events hit the intended control;
  users can collapse Field Effects to expose more matchup space while the expanded body itself
  remains internally scrollable.
- Page scrolling remains available while the expanded body can scroll internally. Use
  `overscroll-behavior: contain` for the internal region without keyboard traps; reaching its edge
  must not make controls inaccessible.

## Decisions and assumptions

- A single display-label helper should humanize camelCase identifiers consistently for toggle cells
  and summaries. Terrain suffixing belongs to summary formatting, not the canonical ID or toggle
  label.
- Summary construction should produce explicit group strings rather than flattening identifiers.
  Stable order comes from the existing weather/terrain slots and current `SideEffects` property
  order; no sorting or data-contract change is needed.
- “Aligned with `Field Effects`” means the label and summary are left-aligned in one content stack,
  with wrapping available for long grouped text at narrow widths.
- Width stability and height growth are separate contracts. Give the centered calculator an
  explicit populated-layout inline size so the two-column track and each card have identical empty
  and populated widths. Remove the round-2 desktop/tablet `min-height`/`min-block-size` floor; empty
  height remains intrinsic, and real selected content alone grows the paired row. Do not use
  JavaScript measurement.
- Fix width at the owning grid boundary, not by increasing the calculator cap. Define an explicit
  `.site-main--damage-calculator` column such as `minmax(0, 1fr)` and ensure the calculator stretches
  within that definite track before `max-width: 66rem` and auto margins center it. Retain the
  existing populated cap unless independent evidence later authorizes a design change.
- Removing visible side headers means removing only the Left/Right eyebrow. Preserve the form/empty
  heading and give the article an explicit side-specific accessible name rather than relying on
  visual position.
- Gender, Ability, Item, Nature, Current HP, and Status share one named-area field grid. JSX order
  places Nature, then HP, then Status; CSS placement keeps them in columns one, two, and three on
  paired layouts regardless of optional Gender. Round 6 supersedes the earlier post-grid Mega
  placement: the optional button belongs in the sprite visual group and appears nowhere else.
- Integrate the five stage selects into their corresponding non-HP `.damage-stat` rows. Reduce SP
  number and stage-select column widths, remove the visible stage label, and preserve the accessible
  name explicitly. Format numeric zero as `+0` while leaving its option value equal to `0`.
- Split the stat label and computed value into separate grid cells and use one explicit shared
  five-column template for all rows and both panels. Reserve the fifth column in the HP row with an
  inert, hidden-from-accessibility layout cell; do not add an HP stage control.
- Treat Firefox's native number/select metrics as part of the layout boundary. The SP number and
  stage select each require `min-width: 0`, `width: 100%`, `max-width: 100%`, and
  `box-sizing: border-box`; give both the same compact explicit block size/minimum height,
  line-height/alignment, and compatible padding so neither can widen its track or sit higher/lower.
- Wrap the Current HP input and percentage in one positioned control container. Keep the number
  input native and editable, add inline-end padding for the percentage, make the percentage
  noninteractive, and associate its descriptive text with the input through `aria-describedby` or
  equivalent semantics.
- Introduce a narrow ratio-preserving helper for HP SP updates. Capture `oldMaxHp` before changing
  `side.sp.hp`, derive `newMaxHp` from the updated side and same displayed form, apply
  `Math.floor(oldCurrentHp * newMaxHp / oldMaxHp)` only for a finite positive old maximum, and finish
  through the existing integer clamp. For an invalid old maximum, clamp the prior current HP to the
  new range. Other SP IDs keep current HP unchanged.
- Keep `withClampedHp` as the clamp-only form/item/Mega boundary; do not silently change every caller
  to ratio preservation. `newSide` remains the full-HP reset boundary for a newly selected Pokémon.
- The existing exact engine stage helper is not currently reusable because it is module-local.
  Rename/export it narrowly (for example `applyBattleStage`) without changing its formula, replace
  the engine's internal calls with the same helper, and use it only when deriving non-HP display
  outputs. Do not write staged values back into `currentStats`, `Side.sp`, or `Combatant` stats.
- Keep one `.damage-pokemon__visual` (or equivalent) wrapper with explicit columns
  `[mega-slot] [sprite]`. Render the slot before the decorative sprite. Do not retain a second button
  in the old post-grid or below-sprite location. Keep the relation guard as the sole button render
  condition and preserve the existing callback verbatim unless markup extraction requires a
  behavior-neutral function.
- Import `MegaIcon` from the existing shared `../icons` module and render it as the button's only
  visible child. Keep the calculator's scoped button selector but align its dimensions, circular
  shape, border/surface tokens, active accent state, and icon size with the established
  `icon-toggle`; do not copy or fork the SVG/component. Put the current dynamic text into
  `aria-label` and `title`.
- Always render the visual slot for a selected form. The no-relation branch is an empty
  `aria-hidden` element with the same `2.75rem` track; it is not a `<button>`, has no role/tabindex,
  and cannot receive events. Give the sprite a larger shared responsive size and bind header minimum
  block size to that visual track so state changes cannot affect geometry.
- Install calculator shortcuts at the `DamageCalculator` document level because both input IDs are
  stable and Choice already opens on focus. A local eligibility helper may mirror Team Builder's
  modifier/repeat checks but should expand the exclusion selector to all interactive controls named
  by this round. Do not import the Pokédex `shortcutTargetExcluded`, whose shortcut union and feature
  bundle are unrelated.
- No visible shortcut guide or key hint is required in this round. The keys supplement, rather than
  replace, labeled inputs and normal focus navigation.
- Extend the same round-6 document listener for Escape rather than adding a second global listener.
  For Choice, retain local popup-close/text-restore handling without stopping propagation; the
  document phase then finds the active calculator control and blurs it. Treat the second close from
  `onBlur` as an idempotent confirmation, not a separate user action.
- Escape eligibility is calculator-root containment plus an active native/ARIA/focusable control.
  Ignore default-prevented, repeated, modified, dialog, outside-root, or noninteractive events.
  Call `preventDefault()` only immediately before blurring a claimed control.
- Derive `baseAbilityChoices` from `base.abilities` once. Derive `lockedAbility` by resolving
  `relation.locked_ability_id` in `data.abilities`. Feed Ability Choice
  `side.mega && relation ? [lockedAbility] : baseAbilityChoices`, after the validated locked value is
  narrowed to present. Keep `value={abilityId}` and the existing disabled expression.
- Do not call `update({ abilityId: relation.locked_ability_id })` when entering preview. The existing
  computed effective ID is sufficient and preserves the base selection. On exit, computed
  `abilityId` naturally returns to `side.abilityId`, and the base choices resolve its display.
- Preserve the current Mega toggle's `abilityContext: {}` reset. Contextual inputs continue to use
  the effective `ability` variable, so the locked ability is authoritative during preview and the
  restored base ability becomes authoritative afterward.
- `parseCalculatorData` already validates every locked ability reference and remains the primary
  fail-closed boundary. A defensive unreachable guard may render an explicit unavailable message
  and gate combatant/result construction, but must never fall back to the base ability, invent a
  `Named` record, or leave a blank disabled field.
- Move `<FieldEffects>` after `.damage-matchup` in JSX and add an open modifier to its section. Keep
  the summary button first inside the section and the controlled body second; sticky anchors the
  whole section's bottom so expansion occupies bounded space above/within the viewport without DOM
  focus-order tricks.
- Use `position: sticky`, not `fixed`, with
  `inset-block-end: max(var(--space-2), env(safe-area-inset-bottom))`. Keep `width: 100%`, the
  calculator's existing cap/alignment, opaque surface, and a z-index scoped between ordinary card
  content and true dialogs/global overlays.
- Define one top reserve from the known application header (`4.5rem`) plus page spacing and summary
  height. Bound the expanded body with a CSS expression such as
  `min(<comfortable desktop cap>, calc(100svh - <top reserve> - <sticky inset> - <summary>))`, with
  responsive overrides where needed. Avoid an unbounded expanded sticky element.
- Keep the sticky card in normal flow at the end so it contributes its own size at the document
  bottom. Do not duplicate that contribution with matchup padding, a spacer, or an open-state
  expanded-height reserve. If focus positioning needs an offset, use non-layout scroll margin or
  narrowly scoped scroll padding bounded to the necessary current sticky footprint.
- The existing active human-review session remains authoritative. After focused implementation and
  no test or audit run, the deployment agent reloads it with exactly
  `./bagredex.sh human-review reload`, without a port override, and reports the stable connection
  fields.

## Scope and ownership

### Web GUI owner

`web_gui_coder` exclusively owns this focused round in:

- `src/web/src/damage-calculator/app.tsx` for summary formatting, accessible panel naming, and
  control reordering, HP ratio preservation, staged stat presentation, Mega visual grouping, and
  document-level digit shortcuts, plus Field Effects DOM/open-state placement;
- `src/web/src/damage-calculator/engine/calculate.ts` only for narrowly exporting/renaming the
  existing exact battle-stage helper and reusing it at current engine call sites without formula or
  contract changes;
- `src/web/static/web/css/damage-calculator.css` for summary alignment, paired-card stretching,
  populated-size empty cards, compact stat-stage rows, responsive behavior, and the sprite/Mega
  two-column visual group, reserved slot, enlarged stable sprite, established icon-toggle sizing,
  and sticky Field Effects geometry/focus positioning.

`src/web/src/icons.tsx` and `src/web/src/assets/pokedex-icons/mega-evolution.svg` are existing shared
inputs to import and reuse, not files to copy or edit in this round.

Automated test changes and execution are outside the open round by user direction. At explicit
finish, the Web owner may update `src/web/src/damage-calculator/app.test.tsx` and
`src/web/tests/e2e/damage-calculator.spec.ts` as required before independent review and full
validation.

No template, backend, data, engine, deployment, or lifecycle-marker edit is expected. The Web owner
must preserve all user-owned screenshot changes.

### Architect and deployment owners

- `architect` owns this supplemental plan. It updates this one plan for any further accepted round
  in the same session and, only after explicit finish with tracked changes, performs integration
  review and writes `docs/reports/2026-10-24-damage-calculator-human-review.md`.
- `deployment_agent` owns the supported session reload after implementation. Only after explicit
  finish does it own full final validation, staging, and the separate follow-up commit.

Independent `web_gui_reviewer` review is deliberately deferred until explicit session finish, as
required by the human-review workflow.

## Data and interface impact

### Summary presentation

Keep `FieldState`, `SideEffects`, `emptyField`, `calculationField`, toggle updates, and engine inputs
unchanged. Derive presentation-only strings from current values. The formatter must not mutate IDs
or become a mechanics registry.

The grouped algorithm is:

1. Add weather and terrain display values to `Field`; append `Terrain` to a non-empty terrain.
2. For Left and Right, select existing boolean entries whose values are true and humanize the keys.
3. Omit each empty group.
4. Join group labels and comma-separated values with ` · `, or return `None active` when all groups
   are empty.

### Panel semantics and layout

Keep each `damage-pokemon` article independently owned by Preact. Give it an explicit accessible
side name while retaining the visible form/empty heading. Do not use hidden duplicate interactive
content or infer side only from CSS.

Use an explicit full-width/max-width calculator contract that does not depend on selected content.
The main grid must declare a definite `minmax(0, 1fr)` track and allow the calculator grid item to
stretch across it. The calculator then fills the available track only up to its existing `66rem`
cap, and the matchup always has the same two desktop/tablet tracks, so initial empty cards have
exactly the same per-panel width as populated cards. Remove any empty-state block-size floor. Do not
copy populated markup into the empty side or measure DOM dimensions in JavaScript; card height is
intrinsic until selected content grows it.

### Control and calculation contract

Moving Current HP, Status, and stage selects changes only DOM/layout order. Reuse their existing
values and update callbacks. Preserve exact input bounds, accessible stage names, current-HP
percentage, clamping, stat calculation, focusability, and calculation-field construction.

Current HP and Status move into the same grid as set fields. Use explicit grid-area classes so the
optional Gender field cannot disturb the second-row Nature/HP/Status columns. Keep DOM order Nature,
Current HP, Status, then optional Mega and Stats.

Give each stage select an accessible name without visible label text. The select must follow the SP
number input for the same stat in DOM order. Its `0` option displays `+0`; all other signed display
text remains mathematically accurate while option values remain numbers. All stat rows use the same
explicit columns for label, computed value, slider, narrower SP number, and narrower stage select.
The HP row reserves the stage track with no focusable or semantic control. Responsive templates may
wrap deliberately but must preserve row alignment, `minmax(0, ...)` containment, and no horizontal
page overflow. Both compact controls must be shrinkable border-box grid items with identical block
metrics; browser-native intrinsic width, padding, or line-height must not override the shared track.

The HP percentage is presentation derived from existing current/max HP state. Put it inside a
relative wrapper around the native number input, align it to the inline end, reserve sufficient
input padding, and expose the current percentage as an associated description. Do not place the
percentage in the input value, make it independently focusable, or block pointer interaction with
the number field.

### HP and staged-stat state contract

HP SP is the only SP key that changes maximum HP. Its update path must compute both maxima around the
immutable SP change and set:

```text
scaled = floor(oldCurrentHp * newMaxHp / oldMaxHp)
currentHp = clamp(scaled, 0, newMaxHp)
```

Use this branch only when `oldMaxHp` is finite and greater than zero. Otherwise set `currentHp` by
clamping the old current integer to the new range. Treat a non-finite new maximum as an invalid
boundary and converge through the existing safe integer clamp rather than emitting non-finite state.
Do not apply this ratio helper to a direct HP edit, non-HP SP update, stage update, or form boundary.

The engine stage function is the single arithmetic authority:

```text
stage >= 0: floor(base * (2 + stage) / 2)
stage < 0:  floor(base * 2 / (2 - stage))
```

Expose that existing helper within the Web module boundary because inspection found no reusable
export. The UI computes only `displayedStat = applyBattleStage(currentStats[id], side.stages[id])`
for non-HP rows that have stage controls. HP continues to show its unstaged maximum. Engine input
continues to receive unstaged `stats(combatant)` and the separate `combatant.stages` object; no data,
bootstrap, serializer, or persisted schema changes.

### Mega and shortcut interaction contract

Keep `relation` derivation and Mega state in `PokemonPanel`; only relocate the existing conditional
button into the header visual wrapper's left slot. The wrapper still renders only when `form` exists;
within it, the slot always renders but the button renders only when `relation` exists. The
no-relation slot is empty and `aria-hidden`, with no interactive semantics. Preserve the valid
button's native semantics and `aria-pressed` state. Render the shared `MegaIcon` as decorative
content and move the current dynamic action string to both `aria-label` and `title`.

The visual group has explicit stable columns: the established `2.75rem` control track and one
larger responsive sprite track. Use a shared CSS custom property or equivalent single sizing source
for sprite inline/block dimensions and header minimum block size. Neither relation appearance,
relation removal, item change, nor base/Mega state may change the grid tracks, group extent, sprite
coordinates, or header height. Responsive rules may reduce the shared sprite size to fit narrow
screens, but must not make it state-dependent.

At the ready calculator root, add one effect with a stable `keydown` handler. Eligibility requires:

1. `event.key` is exactly `1` or `2`;
2. the event is not already prevented, repeated, or modified;
3. `event.target` is not within editable or interactive content, including native form controls,
   links/buttons/summary, contenteditable, ARIA interactive widgets, or a nonnegative `tabindex`;
4. the mapped `left-pokemon` or `right-pokemon` input exists and is enabled.

After eligibility, prevent the browser default and call `focus()` on the mapped input. Focus itself
invokes the existing Choice open behavior, keeping one combobox state path. Cleanup removes the
document listener on unmount. This adds no URL, persistence, backend, engine, or data interface.

The same listener handles Escape in a separate branch before digit mapping. It claims only an
unmodified, nonrepeating, unprevented event whose current active element is an interactive control
inside the calculator root and outside any dialog. Target-local handlers run earlier in the bubble
path, so Choice first closes/restores its popup state. The document branch then prevents default and
calls `blur()` on that active control. Outside-root and dialog Escape events are never claimed.

### Effective ability choice contract

Keep three concepts distinct:

- `side.abilityId` is the retained user-selected base ability;
- `abilityId`/`ability` are the already-derived effective values, switching to the relation's locked
  values only during active Mega preview; and
- `abilityChoices` is presentation scope: base-form legal abilities normally, or a singleton locked
  ability during active preview.

The Ability Choice receives matching `value` and `choices` in both states. It remains disabled only
during active valid preview. The locked singleton is not merged into or cached with base choices.
Context descriptors, defaults, and `buildCombatant` continue consuming the effective ability, so no
engine change is required.

The current Web parser's relation-reference validation is sufficient for normal runtime and must
remain unchanged. No backend, data, bootstrap, or normalized schema change is authorized. If a
defensive component guard is necessary for TypeScript/runtime narrowing, it must produce an explicit
unavailable state and gate result construction; a blank choice or silent base/undefined ability is
not acceptable.

### Sticky layout contract

Field Effects state, `calculationField`, grouped summary strings, and button update callbacks do not
change. Only ready-view DOM position, an open-state CSS class, and layout styles change.

The sticky card remains inside `.damage-calculator`; no portal or body-level node is introduced.
Its internal body is the only new overflow region. Assign it a stable ID if useful and preserve the
summary button's `aria-expanded`; `aria-controls` may be added to make the relationship explicit but
must reference the real body only while appropriate.

Sticky inset and expanded-body bounds come from shared CSS custom properties. Any focus-only scroll
offset uses the smallest necessary current sticky footprint and must not create document height.
Use small-viewport units with a safe fallback and safe-area inset. Do not read layout in Preact or
store viewport dimensions.

## Implementation sequence

1. Extract or centralize the existing identifier display formatter and replace the flattened summary
   with stable Field/Left/Right group construction.
2. Remove the visible side eyebrow, add explicit accessible article names, and preserve visible
   form/empty headings.
3. Keep the set fields, Current HP, and Status in one JSX grid. Place Nature, HP, and Status in that
   DOM order and assign explicit desktop/tablet grid areas under the appropriate first-row fields.
   Move the percentage inside the HP control wrapper, reserve inline-end space, and associate it
   accessibly with the native number input.
4. Render each non-HP stage select inside its matching stat row immediately after a narrower SP
   number input. Remove the visible stage label while retaining an explicit accessible name, and
   display numeric zero as `+0` without changing its value. Split stat name and computed output into
   stable columns, and reserve the stage column in the HP row.
5. Update CSS for a left-aligned wrapping summary, exact populated-layout width from the initial
   empty state, intrinsic empty-card height with no baseline floor, one shared five-column stat-row
   template, and deliberate phone fallback.
6. Correct the owning main grid with an explicit `minmax(0, 1fr)` full-width track and calculator
   stretch while preserving the `66rem` cap. Harden SP number and stage select sizing with
   shrinkable border-box dimensions and identical compact block metrics for Firefox.
7. Split HP SP updates from other SP updates: capture old maximum/current HP, build the immutable
   next SP state, derive the new maximum, ratio-scale with integer floor and clamp, and use the safe
   clamp-only fallback for invalid old maximum. Preserve existing reset and form-change boundaries.
8. Export/rename the existing engine stage helper without changing its arithmetic, reuse it at all
   engine call sites, and use it to derive only the visible non-HP stat outputs from unstaged stats
   plus current stages.
9. Build the stable header visual grid with a reserved left Mega slot and enlarged right sprite.
   Render the relation-guarded button in that slot or an inert `aria-hidden` empty slot, remove every
   old/below-sprite location, and keep geometry constant across relation/item/Mega state.
10. Add one cleaned-up document keydown effect mapping eligible unmodified `1`/`2` keys to the
    stable Left/Right Pokémon input IDs. Reuse Choice focus-to-open behavior and exclude every
    editable or interactive target.
11. Replace the Mega button's visible string with the existing shared `MegaIcon`, retain the dynamic
    string as `aria-label` and `title`, and align its scoped styles exactly with the established icon
    toggle's touch target, focus, contrast, and pressed treatment.
12. Extend the same document listener with the deterministic Escape branch: after local control
    handling, blur one eligible active calculator control; ignore modified, repeated, prevented,
    dialog, outside-root, and noninteractive events.
13. Split Ability Choice options from effective ability calculation: keep base choices normally,
    pass the resolved locked ability as the sole disabled choice during active Mega preview, retain
    `side.abilityId`, and keep parser/defensive missing-reference handling fail-closed.
14. Move Field Effects after the matchup, add an open modifier, and implement the normal-flow sticky
    bar, bounded internally scrolling body, and responsive top reserve. Remove matchup bottom
    padding/spacers and expanded-height clearance; retain only non-layout focus scroll offsets if
    needed for Move 6/results/focus targets.
15. Do not add or run automated tests, audit, independent review, or the full validation suite during
   this open round. Run a non-test syntax or formatting command only if implementation cannot safely
   proceed without it; do not make such a command a round gate.
16. Ask the deployment agent to run the exact supported reload, relay all stable connection fields,
   and return control to the user. Do not dispatch independent review, run the full final matrix,
   write the supplemental report, stage, or commit until explicit finish.

## Review and verification

### Open-round verification

By explicit user direction, this round has no automated test, audit, independent review, or full
validation gate. The Web owner implements only the approved source changes. Non-test syntax or
formatting may be used only when unavoidable for safe implementation and is not prescribed as a
round check. The supported runtime reload is the sole required round transition before returning
control to the user.

After implementation, the deployment agent runs `./bagredex.sh human-review reload` without a port
override. It verifies and relays `TARGET`, `STATE`, `URL`, `USERNAME`, `PASSWORD`, `ACTIVE_BUNDLE`,
`PROJECT`, and `VOLUME`, confirms the target remains Damage Calculator and state returns to `ready`,
and does not finish the session.

### Deferred finish checks

Only after explicit finish, add or update automated coverage as needed, dispatch
`web_gui_reviewer` and the architect, resolve all findings, then run the complete Web check, Vitest
suite, production build, configured Damage Calculator Playwright matrix, damage audit if applicable,
`.codex/lint.sh`, and `git diff --check`. Finish evidence must cover:

- empty and populated calculator columns/cards have the same intended desktop/tablet width, and an
  empty card retains intrinsic content height without the removed artificial floor;
- the explicit main-grid track supplies full available width before the unchanged `66rem` cap, so
  Firefox does not shrink the initial calculator to empty content;
- paired cards stretch equally when their real content differs, while phone cards remain
  content-driven;
- Nature/Current HP/Status occupy columns one/two/three of the same second grid row and appear in
  that DOM/focus order even when Gender is absent;
- Current HP keeps an editable numeric value while its live percentage sits inside the control at
  the right, remains programmatically associated, and never overlaps text or focus indication;
- every non-HP stage select follows its SP number field in the same compact row, has no visible
  repeated label, retains its accessible name, and displays `+0`, signed positives, and negatives
  while preserving numeric state;
- stat name, computed value, slider, SP number, and stage columns align across every row and both
  panels, with an inert reserved stage track in the HP row;
- Firefox computes identical compact height, vertical alignment, padding, and track-constrained
  width for SP number inputs and stage selects, with neither native control overflowing its column;
- HP SP ratio cases cover full, zero, manually edited partial, increasing/decreasing maximum, floor
  loss, invalid/zero old maximum fallback, and bounds; non-HP SP/stage/status changes preserve the
  explicit current HP, Pokémon replacement resets full, and form/Mega transitions remain clamp-only;
- `+0` shows the unstaged stat, positive and negative stages show the exact shared-helper result for
  Attack, Defense, Sp. Atk, Sp. Def, and Speed, and damage/effective-speed results prove the engine
  receives unstaged stats plus the stage only once;
- each selected form has the same reserved left Mega slot and enlarged right sprite track; a valid
  relation shows exactly one button in the slot while no relation leaves it inert/empty, and
  relation/item/Mega changes produce no sprite/header position, size, or height shift;
- the calculator imports the established shared Mega icon, shows no visible action string, exposes
  the exact dynamic action through `aria-label` and matching `title`, and matches the established
  touch target, focus, contrast, and active appearance without a copied asset/component;
- unmodified nonrepeating `1`/`2` from noninteractive document content focus and open only the
  corresponding Left/Right Pokémon combobox, while modifiers, repeats, prevented events, loading,
  unmounted state, and every editable/interactive target remain unclaimed;
- one unmodified Escape closes/restores an open Choice and releases focus, blurs other focused
  calculator controls, then permits `1`/`2` navigation; modified/repeated/prevented, dialog,
  outside-root, unmounted, and global page Escape behavior remains untouched;
- a Mega whose locked ability is outside `base.abilities` shows that exact locked name in the
  disabled control, uses its contextual inputs/calculation, and restores the prior base ability and
  base context defaults on exit without adding either ability to the other's choices;
- malformed missing locked references continue failing in parsing, and any defensive component path
  is explicit/unavailable with no blank field or ability-free misleading calculation;
- Field Effects stays aligned to the capped calculator width and sticky above the safe bottom inset
  during long desktop/tablet/phone scrolling, while unsupported sticky fallback remains usable in
  normal flow;
- expanded controls remain fully reachable in their bounded internal scroller without covering the
  application header, and page/internal scrolling have no keyboard or pointer trap;
- at maximum scroll, collapsed Field Effects follows the panels by one ordinary calculator gap and
  expanded Field Effects follows without a second reserved maximum or viewport-scale blank region;
- Move 6, results, disclosures, and contextual controls remain operable by normal scrolling,
  focus-only offsets, or collapsing Field Effects, without layout padding that duplicates the
  section's normal-flow height;
- the round 1 grouped summary, accessible panel naming, SP linkage, HP clamping, stage recalculation,
  focus, theme, and horizontal containment behavior remains correct.

Write the supplemental report and create one separate follow-up commit without amending base commit
`4b57ca9`.

## Risks

- Reusing canonical IDs as display text would preserve `auroraVeil` leakage. Keep display formatting
  explicit and test representative camelCase values.
- A summary assembled by flat token concatenation can lose scope or produce empty punctuation.
  Build group strings first and omit empty groups before joining.
- Removing the visible side eyebrow without another accessible name would make two articles
  indistinguishable. Name each article explicitly by side.
- Retaining the round-2 panel floor produces the artificial tall empty cards seen in round 3. Remove
  the floor at every breakpoint; selected content, not a minimum height, drives growth.
- Fixing only height can leave the complete calculator shrink-wrapped. Establish the populated-layout
  inline size independently of selected content and verify both total and per-panel widths at finish.
- Setting `width: 100%` only on the calculator can still resolve against the main grid's centered
  implicit auto track. Define the full-width `minmax(0, 1fr)` track at the parent and preserve the
  child cap rather than compensating with a larger maximum.
- Moving controls by CSS `order` alone would leave keyboard and screen-reader order unchanged. Move
  the JSX so DOM and visual order agree.
- Auto-placement can shift the second field row when Gender is absent. Use explicit grid areas for
  Nature, Current HP, and Status while keeping their DOM order authoritative.
- Inserting stage controls into stat rows can cause narrow-width overflow. Reduce the number and
  select widths, define explicit responsive columns/wrapping, and preserve focus visibility and
  usable targets.
- Removing visible stage labels without an accessible replacement would make five selects
  indistinguishable. Give each an exact accessible name and verify it at finish.
- Formatting `+0` by changing the option value would corrupt numeric stage state. Change display
  text only and preserve zero as numeric `0`.
- Overlaying the percentage without reserved input padding can hide editable HP digits or intercept
  clicks. Use a positioned, noninteractive description with sufficient inline-end padding.
- Independent or content-sized stat columns can drift between rows and panels. Use the same explicit
  grid template everywhere and reserve the missing HP stage cell.
- Firefox native form controls can retain an intrinsic minimum or different border-box metrics even
  inside explicit tracks. Apply `min-width: 0`, bounded full width, border-box sizing, and identical
  compact vertical metrics to both SP and stage controls.
- Reusing the clamp-only form helper for HP SP loses the user's ratio; applying ratio preservation to
  every clamp caller would instead alter form/reset semantics. Keep a dedicated HP-SP branch and
  explicit existing boundaries.
- A zero/non-finite old maximum can produce division errors. Skip the ratio formula and safely clamp
  the existing current integer to the new valid range.
- Writing the staged display back into base stats or combatant input would make the engine apply the
  stage twice. Reuse the exact helper for rendering only and preserve `stats` plus `stages` as
  separate inputs.
- Duplicating the battle-stage formula in the island risks rounding drift. Inspection found the
  engine helper but no export, so expose that same helper narrowly instead of reimplementing it.
- Moving the Mega toggle only with CSS can make visual and focus order disagree. Relocate the native
  button in JSX with its sprite and remove the original instance.
- Rendering a placeholder Mega button when `relation` is absent would advertise an invalid action.
  Preserve the exact relation guard and reserve space with a noninteractive `aria-hidden` element,
  never a disabled or focusable toggle.
- Conditionally inserting/removing the entire Mega/sprite structure will shift the sprite and header.
  Keep stable grid tracks and the inert slot in both relation states, and use one state-independent
  sprite/header size source.
- Enlarging the sprite without a responsive cap can collide with the form heading or overflow the
  phone card. Use available header space with a bounded responsive size while retaining identical
  state geometry at each viewport.
- A global digit handler can hijack number entry, select behavior, buttons, links, or assistive
  widgets. Reject repeats, modifiers, prevented events, and any interactive/editable target before
  focusing; prevent default only after finding an eligible destination.
- Registering handlers per panel or without cleanup can focus twice or survive unmount. Install one
  document listener at the root and remove the same callback in effect cleanup.
- Recreating or embedding the Mega SVG would drift from Bagredex's reviewed asset. Import the shared
  `MegaIcon` and keep it decorative inside the named native button.
- Removing visible button text without moving it to an accessible name would create an unnamed
  control. Preserve the exact dynamic action in `aria-label` and the established matching `title`.
- Blurring Escape in the Choice handler alone would not cover selects/buttons, while an unconditional
  document blur could break dialogs and page controls. Let local calculator handlers reconcile state,
  then narrowly blur one eligible active control within the calculator root.
- Stopping Escape propagation in Choice would prevent the root lifecycle handler from releasing
  focus. Keep popup close/restore local but allow one unprevented event to reach the document branch.
- Passing only `base.abilities` while `value` is a locked Mega ID makes Choice render blank. Use the
  effective locked ability as the singleton preview choices array.
- Writing the locked ID into `side.abilityId` would lose the user's base selection and could broaden
  base legality on exit. Keep effective and stored IDs separate.
- Falling back to the base ability when a locked reference is missing would make UI and mechanics
  silently wrong. Preserve parser fail-closed validation and use only an explicit unavailable guard
  for an unreachable presentation inconsistency.
- A fixed-position effects panel would leave normal flow, ignore calculator width, and require
  brittle spacers. Keep the section last in normal flow and use sticky positioning.
- An unbounded expanded sticky card can cover the header or all remaining content on phone. Cap its
  body from small-viewport height minus header/inset/summary reserves and scroll internally.
- Reserving either collapsed or expanded height in matchup padding duplicates the final
  normal-flow section and creates the observed blank region. Let the section and ordinary grid gap
  provide max-scroll separation; use only non-layout focus offsets when necessary.
- Applying global `html` scroll padding without page scoping can alter other Bagredex pages. Prefer
  calculator-root padding/margins and scope any required viewport scroll-padding selector narrowly.
- A high z-index can cover dialogs or header controls. Use the lowest calculator-local layer that
  clears card content and respect the bounded top reserve/global overlay layers.
- A broad refactor could accidentally change damage state or mechanics during a layout round. Reuse
  existing state callbacks and prohibit engine, backend, and data edits.

## Completion criteria

- The collapsed summary is left-aligned, wrapping, human-readable, terrain-qualified, correctly
  grouped by Field/Left/Right, and concise when empty.
- No new effect or mechanics value is introduced; canonical calculator state and engine behavior are
  unchanged.
- Initial empty desktop/tablet calculator and Pokémon cards use exactly the populated layout's total
  and per-panel widths, have no artificial minimum/baseline height, and grow only with selected
  content; phone fallback remains content-driven.
- The owning main grid provides a definite full-width track before the unchanged `66rem` populated
  cap is applied; no symptom-driven cap increase is introduced.
- Visible Left/Right labels are removed while the two panels retain distinct accessible names.
- Nature, Current HP, and Status share the top field grid's second row in columns one, two, and three
  respectively and appear in that DOM/focus order before Stats.
- Current HP percentage appears inside the number-control boundary at the right without overlap,
  while the numeric value remains editable and the percentage remains accessibly associated.
- Every non-HP stage select immediately follows a narrower matching SP number input in one aligned
  row, has no visible repeated label, retains its exact accessible name, displays signed values with
  `+0`, and preserves numeric bounds, focus, linkage, and immediate recalculation.
- All stat rows in both panels share stable label, computed-value, slider, SP-number, and stage
  columns; HP reserves the stage column without adding a control.
- In Firefox, SP number inputs and stage selects stay inside those tracks and share identical compact
  block height, alignment, box sizing, and padding without horizontal or vertical drift.
- HP SP changes preserve the pre-change HP ratio using
  `floor(oldCurrentHp * newMaxHp / oldMaxHp)` capped to the new range, safely handle invalid old
  maxima, and leave explicit HP edits unchanged on unrelated updates; selection/reset and form
  clamp behavior remains explicit and unchanged.
- Non-HP stat outputs immediately display exact staged values, including base values at `+0`, while
  unstaged calculated stats and stages remain separate engine inputs with no double application.
- Each valid Mega preview toggle displays the established shared Mega icon without visible action
  text and retains its dynamic accessible base/Mega name and matching title, pressed state,
  touch/focus/contrast treatment, accessible order, and reset behavior.
- The Mega control occupies a stable slot immediately left of an enlarged sprite; no-relation state
  uses only an inert `aria-hidden` slot, and relation/item/base/Mega changes do not alter sprite
  position/dimensions, visual-group extent, or header height.
- Safe document-level `1`/`2` shortcuts focus/open only the Left/Right Pokémon inputs, preserve Tab
  and screen-reader semantics, never claim typing or other interactive targets, and clean up on
  unmount.
- One eligible Escape reconciles the focused calculator control's local state and then releases
  focus, enabling the next `1`/`2` shortcut; native dialogs, global page behavior, modified or
  prevented events, and ordinary accessibility navigation remain unaffected.
- Active Mega preview displays exactly its locked ability as the sole disabled choice and uses it for
  context/calculation; exiting restores the retained base selection and base context defaults,
  without storing the locked ID, broadening legal choices, or changing relation/item reset behavior.
- Missing locked ability references remain fail-closed through the validated Web contract and never
  produce a blank disabled field or silent ability substitution.
- Field Effects remains a normal-flow, full-calculator-width card that sticks near the safe viewport
  bottom with appropriate surface/shadow/layering, while summary, collapse, immediate field updates,
  and mechanics remain unchanged.
- Expanded Field Effects is bounded and internally scrollable across desktop/tablet/phone without
  covering application header/global controls or trapping pointer/keyboard navigation.
- No matchup padding/spacer duplicates Field Effects' normal-flow height: collapsed maximum scroll
  has one ordinary gap and expanded maximum scroll has no viewport-scale void. Move 6 and its
  result/disclosure/context controls remain operable through ordinary scroll, bounded focus-only
  offsets, or collapsing the bar, without JavaScript measurement.
- No automated test, audit, independent review, report, or commit occurs before explicit finish;
  those gates remain recorded for the finish workflow.
- The active Damage Calculator session reloads to `ready` with stable target, bundle, project, and
  volume, and remains active for further user review.
- No original artifact or commit is amended, no supplemental report or commit is created before
  explicit finish, and the user-owned screenshots remain untouched.

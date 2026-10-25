# Battle Mode

## Summary

Add an authenticated top-level **Battle Mode** workspace for fast reference during an allowed
online VGC match. The user starts from one compatible saved team, enters an opposing preview,
places two Pokémon per side on a doubles board, records only calculation-relevant revealed state,
and receives immediate damage and effective-Speed information without leaving the page.

The battle is intentionally browser-memory state. Django supplies the exact active regulation,
eligible owned-team summaries, an owner-checked team URL, and the existing normalized calculator
dataset URL. A dedicated Preact island owns the live roster, board, field, calculation, and warning
state. No battle model, mutation endpoint, Pokémon-data release, package, or remote source is
needed.

## Goals

- Minimize interaction during a live match: rapid opponent entry, two-click board placement,
  compact editors, automatic recalculation, and visible effective turn order.
- Reuse saved-team facts, calculator legality and Mega relations, and the validated damage engine
  without creating a second mechanics or data authority.
- Keep every automatic assumption visible through compact accounted-effects summaries rather than
  silently changing damage or Speed.
- Preserve state for benched Pokémon inside the current page while applying exact switch reset
  rules for stat stages.
- Provide keyboard, pointer, and touch parity with desktop-first, strong tablet, and functional
  phone layouts.

## Non-goals

- Saving, restoring, sharing, or URL-encoding a battle; replay logging; battle history; or syncing
  state across tabs, devices, or sections.
- Ad-hoc construction or correction of the user's team. Saved build facts remain read-only and
  Team Builder remains their editing boundary.
- Automatic damage application, HP deduction, turn counting, move selection/commitment, priority
  ordering, outcome simulation, or move-effect execution.
- Drag-and-drop, global keyboard shortcuts, voice input, or a full-screen SPA.
- More ally-wide mechanics than the calculator's validated Friend Guard input. Power Spot,
  Battery, Steely Spirit, Ruin abilities, and other partner-mechanics expansion remain outside this
  cycle.
- Helping Hand, critical-hit controls, accuracy/evasion stages, one-turn modifier controls, or
  weather, terrain, screen, Tailwind, and Trick Room duration tracking.
- A new Pokémon data import, normalized schema, migration, dependency, client state library, or
  server-side damage API.

## User-visible behavior

### Entry and lifetime

- `GET /battle-mode/` renders a dedicated authenticated page and carries the website's validated
  global `?regulation=` selection in primary navigation.
- Team selection lists only teams owned by the user and pinned to the exact active data-version and
  selected regulation row. The page fails closed when the active version, regulation, or calculator
  capability is unavailable. With no eligible team, it presents a clear empty state and a regulated
  link to Team Builder.
- Selecting a team loads its owner-checked detail, validates its pinned context against the page,
  and enables **Start battle**. Starting locks the selected team for the session. A load failure or
  stale/mismatched response stays in selection with an actionable error.
- **Start over** uses an in-page confirmation, clears the entire battle state, and returns to team
  selection. Reload, tab close, external navigation, logout, and regulation changes warn after a
  battle starts. Confirming departure discards the session; canceling preserves focus and state.
  No state is persisted or recoverable after departure.

### Rosters and board

- The selected saved team appears in the left roster. Species/form, nickname, gender default,
  ability, item, nature, SP, four move slots, Shiny state, and saved build facts are read-only.
  Incomplete but valid saved teams remain selectable; missing build facts produce explicit
  unavailable move/results rather than invented values.
- The opponent roster appears on the right with a calculator-style legal-form combobox. Committing
  a choice with Enter adds it and restores focus to the cleared Pokémon field for immediate next
  entry. The roster accepts at most six active-regulation non-Mega forms and rejects a second form
  of the same base species. A clear inline/status message explains duplicate or full-roster input.
- A new opponent defaults to zero SP in every stat, no item, Serious nature, the first legal ability
  in calculator slot order, four empty moves, full HP represented as 100%, no status, neutral
  stages, and non-Mega state. Opponents can be removed or replaced throughout the session.
- The central arena has two labeled slots per side. Selecting a roster member and then a slot places
  it with native button semantics; Enter and Space follow the same flow. Placing into an occupied
  slot benches the occupant and clears only that occupant's five stat stages. Selecting a Pokémon
  already active makes it the calculation attacker without moving or resetting it. Removing an
  active opponent also clears its slot and any selected-attacker reference.
- Benched Pokémon retain current HP, permanent status, and all saved or inferred set details. The
  board has no meaningful left/right position ordering beyond two distinct focusable slots.

### Live editors

- Every active Pokémon exposes current HP, permanent status, and Attack, Defense, Special Attack,
  Special Defense, and Speed stages from -6 through +6. Stages reset to zero when that Pokémon is
  benched; HP and status do not.
- The user's current HP uses a raw integer slider/value from 1 through its calculated maximum.
  Opponent HP uses a 1–100 percentage slider/value. For mechanics, opponent current HP is
  `max(1, floor(max HP * percentage / 100))`; the derived integer and maximum are visible in the
  accounted context. A fainted Pokémon leaves the board rather than remaining active at 0 HP.
- The user's legal Mega state is the only editable build property. An opponent editor permits four
  distinct legal moves, any regulation item, any legal ability for the base form, Serious or a
  stat-changing nature, and six independent 0–32 SP values with no aggregate cap. It also exposes
  a legal Mega toggle when the chosen item maps the base form to a Mega form.
- Mega state uses the existing relation's target form, types, base stats, sprite, and locked ability.
  Changing an item or form clears an invalid Mega state. Opponent edits and Mega state persist while
  benched; stage reset still applies on every transition off the board.
- High-frequency edits are browser-local, retain focus, and recalculate without a network request.
  The editor uses normalized contextual-descriptor defaults for conditional move, ability, and item
  state not covered by approved controls; each relevant default assumption is visible rather than
  implied.

### Field, calculations, and turn order

- Compact field controls provide mutually exclusive Sun, Rain, Sand, or Snow and Electric, Grassy,
  Psychic, or Misty Terrain cells. No selected cell means none; activating the selected cell clears
  its group. Trick Room is global. Each side independently toggles Tailwind, Reflect, Light Screen,
  and Aurora Veil. These controls do not count turns.
- Clicking an active Pokémon selects it as attacker. Its four moves calculate against both opposing
  active targets. Empty and status move slots explain why no damage is shown. Opponent calculations
  appear only for moves the user has entered.
- Damage into an opponent displays the integer roll range as a percentage of that opponent's maximum
  HP. Damage into the user's Pokémon displays raw integer HP, matching the information exposed by
  Pokémon Champions. Full descriptions and exact rolls remain accessible on demand.
- Spread reduction applies automatically while two valid opposing targets are active and applicable
  to the move; one opponent makes the move single-target automatically. A **Spread hits one target**
  override supports a predicted partner faint. The override resets whenever the attacker selection
  or active board composition changes.
- Friend Guard is inferred only from the active defending partner and feeds the existing calculator
  side input. No other partner ability is inferred in this cycle.
- A turn-order strip shows the four active Pokémon grouped from first to last by effective Speed.
  Trick Room reverses unequal Speed groups but not ties. Ordering uses exact calculated Speed after
  nature, SP, Speed stage, paralysis, Tailwind, supported ability/context, weather/terrain, and
  supported item modifiers; move priority is ignored.
- An accessible, compact **Accounted effects** area is generated from the same derived calculation
  inputs and never from a second rules table. It names at least:

  - automatic versus overridden spread/single-target state and the applicable multiplier;
  - active-partner Friend Guard, including the partner that supplies it;
  - each active Pokémon's base calculated Speed, applied stage/status/Tailwind/item/ability/
    weather/terrain modifiers, final effective Speed, tie group, and Trick Room reversal;
  - opponent percentage-to-integer HP conversion, active Mega form and locked ability, and any
    normalized conditional descriptor using its deterministic default; and
  - explicit weather, terrain, screen, Tailwind, and Trick Room selections already feeding the
    result, summarized without hiding their source side.

  Manual controls remain visibly pressed/labeled. Summary changes are available to assistive
  technology without announcing every slider intermediate value excessively.

### Responsive organization

- Desktop uses a three-area workspace: the user's roster/editor on the left, board plus turn order,
  field and damage results in the wider center, and opponent entry/roster/editor on the right. The
  selected attacker and target/result association remain visually and semantically explicit.
- Tablet keeps the board and results primary while placing the two rosters in a balanced responsive
  grid. Phone stacks board, results, and collapsible roster/edit sections in task order with no
  horizontal page overflow or unreachable control.
- Native buttons, labeled inputs, fieldsets, combobox/listbox semantics, visible focus, sufficient
  touch targets, and logical document order provide equivalent keyboard, pointer, and touch use.
  There are no global hotkeys; normal focus order plus Enter and Space is the keyboard contract.

## Decisions and assumptions

- The completed `grill-me` handoff and the later explicit accounted-effects requirement are
  authoritative; no material product question remains.
- The selected global regulation is the only regulation input. Battle Mode neither changes it nor
  lets team selection override it.
- Only the active immutable data version is eligible for a new battle. Retained historical teams
  remain saved but are not offered. Eligibility compares the exact `Regulation` row, not only its
  canonical ID.
- The existing `damage-calculator-data-v1` contract, formula engine, coverage registry, contextual
  defaults, and local sprite routes remain the mechanics boundary. Battle Mode consumes them; it
  does not fork or loosen them.
- The existing team-detail GET is the authoritative selected-team payload and continues to conceal
  non-owned IDs. Battle Mode does not need a new team-detail contract or mutation endpoint.
- The calculator form record lacks base-species identity. The Battle bootstrap therefore adds a
  compact canonical form-to-base-species map for searchable opponent forms so alternate forms
  cannot evade species clause. This is application serialization of existing normalized facts,
  not a Pokémon-data schema change.
- The opponent roster does not enforce item clause because items begin unknown and the user is
  modeling observations/hypotheses. Species clause and legal per-Pokémon choices remain enforced.
- Current HP never changes automatically. The user can move the appropriate raw or percentage
  slider when HP matters, but predicted damage never mutates it.
- The manual single-target override is selected-attacker/board transient state, not Pokémon state.
  All other approved field toggles survive switches until manually cleared or **Start over**.
- Use exact integer arithmetic for stats, opponent HP conversion, effective Speed, stages, and
  damage. Percentages are formatting over exact integer rolls and maximum HP.

## Scope and ownership

### Backend owner: `backend_coder`

Exclusive implementation ownership:

- new read-only Battle Mode boundary under `src/backend/bagredex/battle_mode/**`;
- Battle Mode route wiring in `src/backend/bagredex/urls.py`; and
- request, bootstrap, authorization, exact-version/regulation, query-bound, and unavailable-state
  coverage in `src/backend/tests/test_battle_mode.py`.

The backend owner adds no model, migration, mutation API, damage formula, or imported data. It may
reuse `damage_calculator.datasets.calculator_supported`, `teams.services.summary`,
`teams.services.team_queryset`, and existing URL names rather than duplicating policy.

### Web GUI owner: `web_gui_coder`

Exclusive implementation ownership:

- `src/web/templates/battle_mode.html` and the Battle Mode navigation link/current-route mapping in
  `src/web/templates/base.html`;
- the feature entry and modules under `src/web/src/battle-mode*`;
- narrowly shared Web helpers and engine exports under `src/web/src/damage-calculator/**` and
  `src/web/src/team-builder/**` when reuse requires them;
- Battle Mode styling under `src/web/static/web/css/battle-mode.css` and shared shell CSS only when
  needed for navigation;
- the Battle Mode input in `src/web/vite.config.ts`;
- component/contract/engine regression tests under `src/web/src/**`; and
- authenticated browser coverage in `src/web/tests/e2e/battle-mode.spec.ts`.

The Web owner must reuse the calculator engine and strict transport parsers, preserve Damage
Calculator and Team Builder behavior, and avoid a second formula implementation. Generated Vite
output follows the repository's established build/ignore policy.

### Data, review, documentation, and delivery owners

- No `pokemon_data_coder` or `src/data` change is planned. Evidence that the active calculator
  capability cannot support an approved mechanic returns to the architect instead of becoming an
  implicit data expansion.
- `backend_reviewer` reviews backend changes; `web_gui_reviewer` reviews Web changes; `architect`
  performs cross-scope consistency review and later owns
  `docs/reports/2026-10-24-battle-mode.md`.
- `deployment_agent` exclusively owns final validation, generated-output confirmation, staging, and
  local commits. No deployment-file change or remote operation is expected.

Backend bootstrap work and Web state/component work may proceed in parallel after this plan. Freeze
the bootstrap fixture and parser before final integration; exclusive paths above prevent source
ownership overlap.

## Data and interface impact

### Django bootstrap

Add `battle-mode-bootstrap-v1` to the server-rendered page with:

- exact active version and selected regulation ID/name;
- owned eligible team summaries in deterministic most-recently-updated order;
- the existing active calculator dataset URL;
- the existing owner-checked team-detail URL template; and
- a compact list or map of searchable legal form ID to base-species ID for opponent species-clause
  validation.

The page uses the same regulation request validation and selector context as Team Builder and Damage
Calculator. It filters `Team` by `owner=request.user` and `regulation=snapshot.regulation`; a team
from another data version with the same canonical regulation is never exposed. It verifies the
calculator capability before rendering the island and provides deliberate 503 unavailable states.
Bound queries independently of team/member count. The bootstrap contains no opponent state, battle
state, private team detail, or CSRF/mutation URL.

`GET /teams/<uuid>/` remains the selected-team request. The Web parser verifies `team-api-v1`, owner
success, exact version/regulation match, at most six unique positions, and canonical IDs resolvable
against the already parsed calculator dataset before enabling the battle. The existing endpoint's
404 concealment handles another user's or missing team.

### Browser contracts and state

Create a strict Battle bootstrap parser and compose the existing `parseCalculatorData` and
`parseTeam` boundaries instead of weakening them. Reject duplicate team/form mappings, non-local
URLs, unknown IDs, inconsistent Mega relations, and stale version/regulation pairs with an
identifiable page error.

Use a reducer or equivalently centralized immutable transition layer for:

- pre-battle selected/load state and started lifetime;
- stable session-only IDs for own and opponent roster members;
- four optional board occupants, selected placement member, and selected attacker;
- per-member persistent HP/status/set/Mega values and switch-reset stage values;
- shared and per-side field state, including Trick Room; and
- transient single-target override with reset keyed to attacker or board-composition change.

Reducer tests define replace, bench, remove, Start over, percentage-HP conversion, stage reset,
field persistence, attacker selection, and transient reset as explicit invariants. Do not write to
`localStorage`, `sessionStorage`, IndexedDB, cookies, history state, or URL parameters.

### Calculation and Speed reuse

Map each active member into the existing calculator `Combatant` and `Field` types by canonical ID.
For each selected attacker move/target pair, derive spread state and defending Friend Guard before
calling `calculate`. Format target-side output without changing the exact rolls returned by the
engine. Preserve explanatory no-damage and unsupported results.

Refactor the engine's current private effective-Speed path into a tested exported domain helper
that returns the exact final integer plus structured applied-modifier evidence. Both Electro Ball /
Gyro Ball damage and Battle Mode order/context consume that one helper. Do not reproduce Speed
rules in the component. Add Trick Room grouping/order as a Battle domain helper over exact effective
Speed results; stable display order is used only inside equal-Speed groups and never implies a
resolved speed tie.

Build **Accounted effects** from structured derived inputs and Speed evidence, not parsed damage
description strings. Context labels map canonical facts to names from the calculator dataset and
identify whether a state was manually selected, automatically inferred, overridden, or defaulted.

### Leave protection and DOM ownership

After start, install `beforeunload` protection plus the established Team Builder-style interception
for external anchors, external forms, and `bagredex:navigate` regulation events. Use an accessible
in-page confirmation for interceptable navigation and the browser-native prompt for unload. Battle
island controls do not trigger departure warnings. Confirmed **Start over** resets in place and does
not bypass ownership of the Preact root.

The Django template owns only the shell, bootstrap script, loading fallback, unavailable state, and
island root. Preact exclusively owns descendants after mount.

## Implementation sequence

1. `backend_coder` adds the Battle Mode view/bootstrap, exact eligible-team and base-species
   serialization, route, template context, and request tests. Freeze a representative
   `battle-mode-bootstrap-v1` fixture and query ceiling.
2. In parallel, `web_gui_coder` adds strict bootstrap parsing and reducer/domain tests for roster,
   board, switch, HP, Mega, field, attacker, spread-override, and Start-over transitions using a
   checked fixture.
3. `web_gui_coder` extracts/exports the single effective-Speed calculation with structured modifier
   evidence, rewires existing Electro Ball/Gyro Ball calls to it, and proves calculator roll parity
   and Speed behavior before building turn order.
4. Build team selection/loading and stale/owner failure handling. Hydrate the locked own roster from
   the existing team response and calculator indexes; no battle state exists until explicit start.
5. Build rapid opponent entry, duplicate-species/max-six checks, persistent member editors, legal
   four-move/ability/item/nature/SP/Mega behavior, and HP/status/stage controls.
6. Build the accessible two-click board and centralized bench/replacement/removal transitions.
   Then connect selected-attacker calculations, target-specific formatting, automatic/overridden
   spread, Friend Guard inference, field effects, turn-order grouping, and accounted-effects output.
7. Add the Django template, primary navigation/current state, Vite entry, light/dark CSS, loading,
   empty/error states, responsive desktop/tablet/phone organization, and leave/Start-over warnings.
8. Integrate against real local endpoints. Verify active-version/regulation changes, incomplete
   teams, unknown opponent details, Mega transitions, HP threshold mechanics, switching, ties,
   Trick Room, automatic inference summaries, focus recovery, and local recalculation.
9. Run focused and complete checks, then dispatch `backend_reviewer` and `web_gui_reviewer` in
   parallel. Return every actionable finding to its exclusive owner and repeat affected checks and
   reviews until no blockers remain.
10. Dispatch the architect for cross-scope review. After resolution, the architect writes the cycle
    report and the deployment agent runs final checks and creates justified local commit(s).

## Review and verification

### Backend review

`backend_reviewer` verifies authentication, global-regulation handling, exact active-version and
exact-row team filtering, owner isolation, capability failure, schema determinism, local URLs,
base-species accuracy, empty state, query bounds, and absence of persistence/mutation.

Run through the configured backend project:

- `uv run --project src/backend pytest src/backend/tests/test_battle_mode.py`
- `uv run --project src/backend pytest src/backend/tests/test_damage_calculator.py src/backend/tests/test_teams.py`
- `uv run --project src/backend python src/backend/manage.py check`
- `uv run --project src/backend python src/backend/manage.py makemigrations --check --dry-run`
- configured backend formatting, lint, and type checks from `src/backend/pyproject.toml`

### Web review

`web_gui_reviewer` verifies strict contracts, reducer invariants, calculator/Speed reuse, exact
rounding, no hidden inference, local interaction latency, focus recovery after rapid entry, native
board/toggle semantics, leave-confirmation focus, restrained announcements, DOM ownership, theme
contrast, touch targets, and responsive information priority.

Run from `src/web` without installing or updating packages:

- focused Vitest for Battle contracts, reducer/domain state, effective Speed, calculation adapter,
  and components;
- `npm test`
- `npm run check`
- `npm run build`
- focused `tests/e2e/battle-mode.spec.ts` on the configured desktop projects and an explicit
  `390 x 844` phone viewport;
- existing Damage Calculator and Team Builder Playwright regressions for shared helpers; and
- Vite manifest/static-asset coverage through existing backend tests.

Automated component/browser evidence must cover:

- exact team eligibility, selection/load/start lock, no-team and stale/unauthorized failures;
- six rapid Enter additions with focus returned each time, duplicate base-species and seventh-member
  rejection, removal, and legal opponent defaults;
- keyboard/pointer/touch placement, occupied-slot replacement, active selection, removal, bench
  stage reset, and HP/status/set persistence;
- read-only own build, raw own HP, rounded opponent percentage HP, unrestricted opponent SP, legal
  moves/abilities/Mega, and invalid-Mega clearing;
- both damage directions and target-specific units, HP-dependent mechanics, two-target spread,
  automatic one-target mode, manual override, and every required override reset;
- weather/terrain mutual exclusion and toggle-off, independent side effects, Friend Guard inference,
  Trick Room order, modifier-aware Speed, and visibly grouped ties;
- Accounted effects matching the exact derived inputs for Friend Guard, spread mode, HP conversion,
  Mega/default context, final Speed/modifiers, field state, and Trick Room;
- leave, logout, regulation, reload, and Start-over warnings/resets without warnings before start;
- focus stability, accessible names/states, light/dark desktop/tablet/phone layouts, and no phone
  overflow or hidden critical control.

### Integration and final validation

The architect compares this plan, complete diff, endpoint/parser fixtures, reviewer results, and
observed checks. Block on version/regulation drift, another user's team exposure, a second Speed or
damage implementation, hidden inferred state, mismatched switch resets, inaccurate unit formatting,
or missing end-to-end evidence.

Run `.codex/lint.sh` before review handoff and before commit. The deployment agent runs the complete
repository validation required by existing scripts and may use only already-local Bagredex Podman
assets or the narrowly allowed local Playwright retry policy. No agent downloads tooling, contacts
a registry, uses a Git remote, or claims an unobserved check.

## Risks

- Battle Mode combines several state lifetimes. A centralized transition model and invariant tests
  prevent a bench operation from clearing persistent opponent knowledge or retaining boosts.
- Automatic mechanics can become invisible and untrustworthy. Structured evidence from the same
  derivation path powers the accounted-effects UI; display-only reconstruction is prohibited.
- Effective Speed already affects damage moves. Duplicating it for ordering could drift. One
  exported helper must drive both calculations and the turn-order strip, with existing parity tests
  retained.
- The selected team is private and loaded separately. Exact bootstrap filtering, owner-checked team
  GET, context revalidation, and concealed 404 behavior prevent ID probing or cross-version mixing.
- Alternative forms can share a species. The bootstrap base-species mapping closes that gap without
  changing the calculator or imported-data schema.
- The full calculator dataset plus dense UI can be expensive on phones. Reuse indexed parsed data,
  memoize derived calculations, render only active editors/results, and measure before adding
  workers or virtualization.
- Navigation interception can conflict with logout or the regulation selector. Reuse the tested
  Team Builder event boundaries and verify focus plus one successful confirmed navigation per path.
- Shared engine or parser extraction can regress existing tools. Keep the refactor narrow and run
  complete Damage Calculator and Team Builder unit/browser suites.

## Completion criteria

- An authenticated user can open Battle Mode under the global regulation, choose only an exact
  active-context owned team, start a locked memory-only session, and deliberately discard it with
  the approved warnings.
- The left saved roster remains build-read-only; the opponent rapid-entry roster enforces six legal
  unique species and supports every approved persistent edit/default without a server round trip.
- The accessible doubles board implements placement, selection, replacement, removal, persistence,
  and stage-reset semantics exactly for keyboard, pointer, and touch.
- Selected-attacker moves recalculate against both targets with exact existing-engine rolls,
  opponent-percent/user-raw outputs, current HP, automatic and overridden spread, field/screens,
  and active-partner Friend Guard.
- Effective-Speed order covers every approved modifier, groups unresolved ties, reverses unequal
  groups under Trick Room, ignores priority, and shares its implementation with Speed-based damage.
- All automatically inferred/defaulted calculation and Speed inputs are visible in Accounted
  effects and agree with the actual engine inputs; no material assumption is hidden.
- Light and dark desktop/tablet/phone layouts preserve focus, readable associations, touch targets,
  and critical controls without overflow or disruptive latency.
- No battle persistence, model/migration, data release, dependency, operational connection, or
  unapproved partner/one-turn mechanic is added.
- Backend, Web GUI, and architect reviews report no unresolved blocking findings; required checks
  pass; the cycle report exists; and the deployment agent reports the final local commit(s).

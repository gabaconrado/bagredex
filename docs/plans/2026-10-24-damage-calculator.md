# One-on-one damage calculator

## Summary

Add an authenticated top-level **Damage Calculator** beside **Team Builder**. The page compares one
Pokémon on each side at level 50 under the globally selected Champions regulation. Each side has
six move slots, editable set and battle state, and immediate damage results against the opposite
side.

The active normalized Bagredex release remains the only runtime Pokémon-data source. Extend that
versioned contract with the Showdown facts needed for damage calculation, then adapt the damage
engine from the pinned local vgcmulticalc revision
`166578cf88c4219dff7dbaa562b0a4e798b274f3`. Do not copy vgcmulticalc's Pokémon, move, ability,
item, nature, or type datasets. Preserve its MIT notice with the adapted engine.

## Goals

- Calculate all six selected moves from either Pokémon into the Pokémon on the opposite side
  using exact level-50 VGC doubles rounding and all supported damage modifiers.
- Reuse regulation legality, Team Builder Mega behavior, SP controls, and Pokédex-style searchable
  choice interactions without introducing another data authority.
- Cover exact current HP, damage-relevant status and stat stages, agreed field and side effects,
  and contextual inputs required by conditional moves, abilities, and items.
- Keep typing, state edits, and damage recalculation browser-local and immediately responsive.
- Provide deterministic parity fixtures against the pinned vgcmulticalc engine and normalized
  Showdown data for representative ordinary and conditional calculations.

## Non-goals

- Saving calculator state, URL sharing, importing Team Builder teams, Poképaste, history, or user
  calculation records.
- More than one active Pokémon per side, multi-Pokémon batch calculation, KO probability across
  turns, end-of-turn recovery/damage, hazards, or full battle simulation.
- Field controls that affect only turn order or non-damage outcomes. Tailwind, rooms, Gravity,
  Protected, Unnerve, hazards, aura controls, and similar broader vgcmulticalc options are excluded.
- Editable level, IVs, base power, move type, species type, or arbitrary illegal choices.
- A server-side calculation API, a new persistence model, a SPA, a client state library, or a new
  downloaded package.
- Using vgcmulticalc's bundled game datasets or contacting either reference repository remotely.

## User-visible behavior

### Page and selection

- `GET /damage-calculator/` renders a dedicated authenticated page and preserves the existing
  validated `?regulation=` selector contract. The primary navigation orders **Damage Calculator**
  beside **Team Builder** and carries the selected regulation between pages.
- The page loads only the current active immutable data version and selected regulation. It has
  deliberate unavailable, loading, invalid-contract, empty-selection, and calculation-error states.
- Two opposing panels each begin with one Pokémon autocomplete. Its visual language and accessible
  combobox/listbox behavior follow the Pokédex search/list, but results contain only regulation-legal
  Pokémon names and sprites: no filters, sorting, or BST columns.
- Selecting a Pokémon initializes zero SP in every stat, Serious nature, its first legal ability,
  no item, six empty moves, neutral stat stages, no status, and full current HP. Replacing it resets
  that panel to the same defaults without changing the opposite Pokémon's set or battle state.
- Ability and move autocompletes contain only choices legal for that selected form. Item and nature
  autocompletes use the active regulation-wide lists. A move may appear in more than one of the six
  slots because the slots are independent calculations rather than a legal saved moveset.
- Mega preview uses the Team Builder interaction and exact stone-to-form relation. While active,
  the Mega form's types, base stats, sprite, and locked ability feed the calculation. Changing the
  item or Pokémon clears an invalid preview; no separate Mega form is selectable from search.

### Stats and battle state

- Each stat uses linked integer input and slider controls from 0 through 32 SP. The panel displays
  the sum of all six SP values but imposes no total cap. Nature and SP changes update exact displayed
  stats and every affected result immediately.
- Current HP is an exact integer input from 0 through the current calculated maximum, accompanied
  by its percentage. It defaults to full, clamps only through explicit valid input behavior, and
  updates when HP SP or form changes so the old value never exceeds the new maximum. HP-dependent
  effects such as Blaze and Eruption use the exact integer value.
- Each side exposes damage-relevant non-volatile status and Attack, Defense, Special Attack, and
  Special Defense stages from -6 through +6. Speed state is omitted unless the engine audit finds a
  legal damage formula that consumes it; if required, expose it contextually rather than silently
  assuming a value.
- Conditional inputs appear only for the selected move, ability, or item that consumes them. The
  registry covers every such input reachable in the active regulations, including activation state,
  allies fainted, hits taken, hit count, consecutive uses, prior success/failure, and equivalent
  battle history. Defaults are explicit. No reachable mechanic may silently use an invented state;
  an unrepresented condition produces an explanatory unavailable result until supplied.

### Field effects and results

- A control between the panels expands or collapses **Field Effects**. It starts collapsed and its
  button summarizes all active conditions.
- Shared choices are no weather or Sun, Rain, Sand, or Snow, and no terrain or Electric, Grassy,
  Psychic, or Misty Terrain. Each side has Reflect, Light Screen, Aurora Veil, Helping Hand, Friend
  Guard, Single Target, and Critical Hit toggles. Single Target suppresses the ordinary doubles
  spread modifier only for applicable spread moves; Critical Hit affects all applicable moves from
  that side. Screens and Friend Guard apply when that side defends, while Helping Hand applies when
  it attacks.
- Changing either selected Pokémon resets all shared and side-specific controls inside **Field
  Effects**. The unchanged Pokémon retains its set, current HP, status, and stat stages.
- Each selected move calculates against the opposite panel. Its compact leading result is
  `minimum ~ maximum | minimum% ~ maximum%`, using integer HP damage and vgcmulticalc-compatible
  percentage precision. Hover, keyboard focus, or touch activation reveals an accessible disclosure
  containing the complete calculation sentence and every roll in order.
- A status move displays an em dash and explains that it deals no direct damage. An immunity or
  another zero-damage guard also displays an em dash and explains the specific reason. Invalid or
  incomplete state never masquerades as `0 ~ 0`.
- All ordinary edits recalculate locally without a request, preserve focus, and announce changed
  results without producing excessive screen-reader output. Desktop shows opposing panels, tablet
  retains comfortable paired editing, and phone stacks the panels and field disclosure without
  losing any controls.

## Decisions and assumptions

- The completed `grill-me` handoff is authoritative and leaves no material product questions.
- Pokémon Showdown remains the sole source for Pokémon, form, type, stat, learnset, move, ability,
  item, nature, regulation, and mechanics facts. Existing local snapshots stay pinned to their
  recorded revisions; no source update or remote access is part of this cycle.
- The user approved vgcmulticalc solely as the damage-formula source. The implementation adapts the
  smallest framework-independent part of its TypeScript domain engine and tests. It does not add
  Angular, NgRx, or vgcmulticalc as a package dependency.
- Reused or substantially adapted vgcmulticalc files retain appropriate copyright/SPDX headers,
  and `src/web/THIRD_PARTY_NOTICES.md` plus a copied license under `src/web/licenses/` identify the
  pinned revision and modifications. This code-license provenance stays separate from Pokémon data,
  sprites, names, and trademarks.
- VGC doubles is the fixed game type. Level 50, max IV behavior, 0–32 SP, stat formulae, and nature
  percentages continue to come from the selected regulation's mechanics profile. The calculator
  intentionally ignores the Team Builder's 66-point aggregate cap.
- Browser arithmetic uses integers and the engine's explicit truncation, overflow, modifier-chain,
  and Pokémon-rounding helpers. Binary floating point is permitted only when formatting a percentage
  after the exact integer damage and HP values are known.
- The formula port is independent of UI components and transport contracts. Canonical IDs, not
  display names, select game data and mechanic branches; display names appear only in presentation
  and generated descriptions.
- Temporary state means a navigation, regulation change, or reload may discard the calculation
  without a warning.

## Scope and ownership

### Pokémon data owner: `pokemon_data_coder`

Exclusive ownership for this cycle:

- `src/data/importer/**`
- a new immutable release under `src/data/releases/**` generated only from the already supplied
  pinned local Showdown snapshots
- calculation fixtures and data documentation under `src/data/**`
- normalized model, bundle, loader, migration, admin, and validation changes under
  `src/backend/bagredex/pokemon_data/**`
- Pokémon-data tests in `src/backend/tests/test_pokemon_data.py`

This owner adds normalized calculation facts and goldens. It must not copy vgcmulticalc's generated
data tables or edit the damage formula, application routes, templates, or Web GUI.

### Backend owner: `backend_coder`

Exclusive ownership for this cycle:

- a new read-only application boundary under `src/backend/bagredex/damage_calculator/**`
- calculator routes in `src/backend/bagredex/urls.py`
- calculator request/contract tests in `src/backend/tests/test_damage_calculator.py`
- narrowly shared regulation or sprite helpers only when reuse requires them

This owner renders the page, validates the regulation and exact active version, and serializes the
calculation dataset. It owns no calculation formula, persistence, or imported data.

### Web GUI owner: `web_gui_coder`

Exclusive ownership for this cycle:

- the calculator template and primary-navigation edit under `src/web/templates/**`
- a feature-split entry and modules under `src/web/src/damage-calculator*`
- the adapted formula engine and its unit/parity tests under
  `src/web/src/damage-calculator/engine/**`
- calculator CSS under `src/web/static/web/css/**`
- `src/web/vite.config.ts`, Web documentation, third-party notice/license files, calculator
  Playwright coverage, and generated `src/web/static/web/dist/**`

This owner may extract Web-owned Team Builder autocomplete, Mega, and stat-control primitives into
shared modules only while preserving existing behavior and tests. It must not import runtime data
from `references/vgc-multicalc`, copy its UI/data modules, or edit backend/data files.

### Architect and deployment owner

- `architect` owns this plan, cross-scope review, and
  `docs/reports/2026-10-24-damage-calculator.md` after review.
- `deployment_agent` alone owns final checks, any necessary existing local Bagredex Podman
  validation, generated-runtime confirmation, staging, and local commits. No deployment-file change
  is expected, and no Git remote operation is permitted.

The data contract must be frozen before backend serialization and Web integration proceed. After
that handoff, backend and Web work may run in parallel against the same checked fixture. Generated
data and generated Web outputs retain their respective single owners.

## Data and interface impact

### Normalized calculation facts

Increment the bundle schema and importer version. Retain all older releases and keep their current
Pokédex and Team Builder behavior readable; only a release carrying the calculator capability can
serve the new page. Generate the new release from the same recorded local Showdown revisions rather
than changing upstream inputs.

The data owner first inventories every input read by the adapted engine for all legal active
regulation combinations. Add validated, version-owned facts sufficient for that inventory:

- exact Pokémon weight and any form property used by a reachable damage branch;
- an attacking-type to defending-type effectiveness relation from Showdown's effective type data;
- structured move calculation facts such as category, power, target, flags, accuracy/fixed damage,
  hit range, critical behavior, drain/recoil, defensive-stat override/ignore behavior, protection
  interaction, and the limited primary/secondary stat changes used in progressive hits;
- stable capability metadata naming the contextual input keys required by each legal move, ability,
  or item, with integer bounds or boolean choice and a deterministic default; and
- a calculator-capability/schema marker so an incomplete retained version fails closed.

Prefer typed columns and relations for scalar/shared facts. A constrained versioned JSON object is
acceptable for nested move effects and contextual-input descriptors only when the importer validates
its complete key/type/range schema and the loader repeats that validation. Never serialize or eval
Showdown callbacks. Formula-specific branches remain explicit code keyed by canonical IDs.

Bundle validation rejects cross-version/cross-regulation references, unknown type outcomes, unknown
calculation keys, unsupported nested shapes, and any legal damaging move without a classified engine
path. Semantic summaries include calculation-fact changes. Goldens include at least physical and
special STAB, immunity and effectiveness, spread versus Single Target, weather and terrain, screens,
critical hits and stages, burn/status interactions, current-HP power/ability changes, variable and
fixed power, multi-hit, Mega form state, relevant items and abilities, and every contextual-input
kind found by the inventory.

### Django contracts

Add two versioned read-only contracts:

- `damage-calculator-bootstrap-v1` in the server-rendered page: active version, regulation ID/name,
  and the exact local dataset URL;
- `damage-calculator-data-v1` from
  `GET /damage-calculator/data/<version>/<regulation>/`: legal selectable non-Mega forms, their
  types/stats/weight/ability and move IDs, sprites, regulation-wide abilities/items/natures/moves,
  Mega item relations and target form facts, mechanics parameters, type effectiveness, structured
  move calculation facts, and contextual descriptors.

The dataset may reuse serializer helpers from Team Builder but has its own schema and parser so
future calculator changes do not break saved-team contracts. It accepts only the exact active
loaded version and selected regulation, rejects malformed/duplicate regulation input, uses local
sprite URLs, and returns private caching consistent with an authenticated active-version payload.
There is no mutation endpoint, CSRF payload, database table, or retained-team authorization path.

### Web formula boundary

Parse the complete dataset before mounting editable controls. Convert canonical normalized records
into small engine inputs without name-based lookup. Keep three layers separate:

1. transport/schema validation and canonical-ID indexes;
2. framework-independent calculation models, exact arithmetic, modifier ordering, roll generation,
   and description output adapted from vgcmulticalc; and
3. Preact state, contextual-control registry, autocomplete, disclosures, and layout.

Pin parity fixtures to both the Bagredex data version/revisions and the vgcmulticalc revision. Each
fixture records combatants and field inputs plus exact ordered rolls, compact range, percentage
range, and full description. Adapt fixture facts to canonical IDs; do not make tests depend on the
reference repository at runtime. A coverage audit maps every formula branch and contextual key
reachable from the active release to a test or explicit unsupported classification. Approved scope
cannot ship with silent fallback arithmetic.

## Implementation sequence

1. `pokemon_data_coder` inventories the pinned vgcmulticalc engine inputs against legal records in
   the existing active Showdown releases, defines the typed calculation-fact/context descriptor
   schema, and commits representative contract fixtures for consumer review.
2. `pokemon_data_coder` extends extraction, bundle validation, Django normalized models/migrations,
   atomic loading, semantic summaries, and golden tests; generates a new immutable bundle from the
   already supplied snapshots and proves old bundles remain readable.
3. Freeze `damage-calculator-data-v1` with a checked representative JSON fixture. The architect
   confirms canonical IDs, field direction, contextual keys, Mega behavior, and license boundary
   before consumers duplicate the contract.
4. `backend_coder` implements the authenticated page/bootstrap and exact-active-version dataset
   endpoint, including unavailable/stale/error handling, bounded queries, caching, and request and
   serializer tests.
5. In parallel after step 3, `web_gui_coder` adapts the minimum MIT formula engine, records license
   provenance, builds its canonical-data adapter and parity suite, and implements browser state,
   controls, accessible results, responsive layout, and the new Vite entry. Shared Web refactors
   preserve all Team Builder and Pokédex tests.
6. Integrate the real endpoint and island; validate both calculation directions, regulation changes,
   field reset semantics, Mega transitions, stale/unavailable data, keyboard/touch disclosure, and
   focus stability. Rebuild committed Vite outputs through the locked existing toolchain.
7. Dispatch `pokemon_data_reviewer`, `backend_reviewer`, and `web_gui_reviewer`, followed by the
   architect's integration review. Return every actionable finding to its owning coder and repeat
   matching reviews until no blockers remain.
8. The architect writes the cycle report. The `deployment_agent` runs final checks and local
   Bagredex runtime validation, then creates justified local commit(s).

## Review and verification

### Data review

`pokemon_data_reviewer` verifies the Showdown-only fact lineage, pinned revisions and hashes,
schema/version increments, old-release compatibility, canonical IDs, type chart, move fact
normalization, contextual descriptor completeness, semantic diff, deterministic regeneration,
license separation, and representative goldens. It must confirm no vgcmulticalc game-data table was
imported.

Likely focused checks, run through the configured backend project where applicable:

- `uv run --project src/backend pytest src/backend/tests/test_pokemon_data.py`
- importer fixture/schema tests using the repository's existing importer commands and local inputs
- deterministic bundle validation and semantic comparison for the new release
- `uv run --project src/backend python src/backend/manage.py makemigrations --check --dry-run`

### Backend review

`backend_reviewer` verifies authentication, strict query/version validation, active-version failure,
schema shape, normalized-only serialization, no persistence, cache privacy, query bounds, Mega and
legality scoping, and old Team Builder/Pokédex compatibility.

Likely focused checks:

- `uv run --project src/backend pytest src/backend/tests/test_damage_calculator.py`
- `uv run --project src/backend pytest src/backend/tests/test_teams.py src/backend/tests/test_pokedex.py`
- `uv run --project src/backend python src/backend/manage.py check`
- configured backend formatting, lint, and type checks from `src/backend/pyproject.toml`

### Web review

`web_gui_reviewer` verifies exact roll parity and modifier ordering, canonical-ID use, formula/data/UI
separation, contextual-input completeness, license notices, local recalculation latency, combobox
semantics, disclosure access by hover/focus/touch, announcements, focus preservation, reset rules,
and light/dark desktop, tablet, and phone layouts.

Likely focused checks from `src/web` without installing or updating dependencies:

- `npm test`
- `npm run check`
- `npm run build`
- focused Playwright calculator flows plus existing Team Builder and Pokédex regression flows
- Vite manifest/static-asset verification through existing backend tests

### Integration and final validation

The architect compares the approved plan, complete local diff, data/backend/Web contracts, and all
reviewer results. It blocks on any unclassified legal damage path, silent conditional default,
formula/data provenance leak, cross-scope schema drift, inaccessible result, or missing critical
end-to-end flow.

Before review handoff and before commit, run `.codex/lint.sh`. The deployment agent then runs the
complete repository validation required by existing scripts and may use only already-local Bagredex
Podman assets if runtime validation is necessary. No agent downloads a tool, contacts a registry or
remote repository, or claims an unobserved check.

## Risks

- Damage mechanics have a much larger state surface than the visible formula. The inventory,
  contextual descriptor registry, reachable-branch audit, and fail-closed result prevent plausible
  but incorrect numbers when state is missing.
- The reference engine may contain data assumptions or mechanics beyond Champions. Keeping all
  facts in the normalized Showdown contract and porting only reachable formula branches avoids a
  second data authority; parity tests expose intentional differences.
- Copying a large engine wholesale would increase maintenance and license risk. Adapt the smallest
  dependency-free domain slice, retain notices, document modifications, and exclude Angular/UI/data
  modules.
- The enriched payload may be large. Measure serialized size, parse time, and recalculation latency;
  deduplicate indexed facts and use private immutable-version caching before considering workers or
  endpoint fragmentation.
- A data activation during an open session can stale the calculator. Version every contract and
  fail clearly on reload rather than mixing releases.
- Shared Team Builder control extraction can regress saved-team validation or focus behavior. Keep
  calculator policy separate and run the full existing Web regression suite after refactoring.

## Completion criteria

- The authenticated top-level calculator works for M-A, M-B, and M-C against the selected active
  supported release and uses only normalized Showdown facts at runtime.
- Both panels select legal Pokémon and sets, reuse correct Mega behavior, expose six independent
  moves, allow 0–32 SP per stat without a total cap, show total SP, and handle exact current HP.
- All agreed status, stage, field, side, and contextual inputs affect results immediately and reset
  exactly as specified; no reachable legal mechanic silently assumes unavailable battle state.
- Every damaging move produces exact ordered rolls and the approved compact/full outputs in both
  directions. Status, immunity, incomplete, and unsupported states are explanatory rather than
  misleading zero ranges.
- Parity fixtures cover the required mechanic matrix and the reachable-branch audit has no
  unclassified active-regulation calculation path.
- Keyboard, pointer, and touch critical flows pass with accessible autocomplete and disclosures;
  light/dark desktop, tablet, and phone layouts remain usable and responsive.
- The new bundle is reproducible, validated, provenance-complete, rollback-safe, and compatible with
  retained older releases. The vgcmulticalc-derived code carries its MIT notice and pinned revision.
- Matching data, backend, Web, and architect reviews have no blocking findings; focused and complete
  checks pass; the cycle report exists; and the deployment agent reports the final local commit(s).

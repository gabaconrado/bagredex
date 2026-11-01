# Form search, SP controls, and move-modifier popovers

## Summary

Refine three high-frequency tools in one coordinated feature cycle. Team Builder will prevent Stat
Point edits from exceeding the 66-point total, add per-stat zero and maximum shortcuts, and allow
Mega forms to be found as explicit search choices that resolve to a valid base-form team member,
required Mega Stone, and active Mega preview. Pokédex will group selected battle or cosmetic forms
under one searchable base entry with a detail-pane variant selector, while presenting male and
female Meowstic as separate searchable entries. Damage Calculator move-specific contextual inputs
will move out of document flow into an anchored popover or narrow-screen modal.

The completed `grill-me` handoff in the feature request is authoritative and leaves no material
questions. The implementation preserves canonical form identifiers, server validation, the
versioned data pipeline, Django-owned data delivery, and focused Preact islands.

## Goals

- Clamp every Team Builder SP edit immediately so a stat is always an integer from 0 through 32
  and the member total is always at most 66.
- Add compact, accessible `0` and `Max` controls for each Team Builder stat without weakening the
  authoritative backend invariant.
- Include legal Mega forms in Team Builder Pokémon search and translate a Mega choice into the
  canonical base form, required stone, and enabled preview in one local state transition.
- Give Castform, Aegislash, Gourgeist, and Squawkabilly one Pokédex search/list entry per base name,
  with all requested forms selectable inside detail.
- Give Meowstic male and female separate Pokédex search/list entries named `Meowstic-Male` and
  `Meowstic-Female`, each resolving to its own canonical details.
- Show move-specific Damage Calculator inputs in an anchored overlay without moving surrounding
  content, with collision-aware placement and a usable narrow-screen modal treatment.
- Preserve keyboard, touch, focus, theme, stale-data, and responsive behavior across all changes.

## Non-goals

- Changing the 0–32 per-stat or 66 total Champions mechanics, level-50 stat formulae, damage
  arithmetic, move contextual-input meanings, or backend team validation.
- Persisting a Mega form as a team member's selected form; Mega selection remains shorthand for
  base form plus required held item and preview state.
- Grouping every Pokédex form family. This cycle groups only Castform, Aegislash, Gourgeist, and
  Squawkabilly, and special-cases the two Meowstic sex forms as confirmed.
- Making a grouped variant searchable by its variant name, adding aliases, changing URL routing,
  or deep-linking the selected grouped variant.
- Changing Team Builder search grouping for ordinary non-Mega forms.
- Changing ability/item conditional inputs or the global Field Effects panel in Damage Calculator.
- Adding a popover library, component library, client state library, SPA behavior, new operational
  service, or upstream network dependency.
- Hand-editing generated release records or silently replacing an active data version.

## User-visible behavior

### Team Builder Stat Points

- Slider movement, number input, `0`, and `Max` all use the same clamp. For edited stat `s`, let
  `otherTotal` be the sum of the other five current stat values. The accepted value is
  `min(32, max(0, integerRequested), max(0, 66 - otherTotal))`. Equivalently, the available total
  includes the edited stat's current allocation, so reducing and reallocating a stat never loses
  its existing allowance.
- A number input that is temporarily empty or non-finite resolves to 0 at the edit boundary. The UI
  never stores `NaN`, a fraction, a negative number, a value over 32, or a total over 66.
- Each row has compact native buttons labeled `0` and `Max`. `0` assigns zero. `Max` assigns
  `min(32, 66 - otherTotal)`. Both update the calculated stat and total immediately.
- Controls retain visible labels, focus, logical tab order, and touch-operable targets. The total
  remains visible as `current / 66`; the existing backend total/per-stat rejection remains as
  defense against stale, malformed, or bypassed clients.

### Team Builder Mega search

- Pokémon search results include each legal Mega target represented by the active regulation's
  canonical Mega-item relation. Mega rows display the Mega name, sprite, typing, and Mega base
  stats so searching and sorting describe the result being chosen.
- Selecting a Mega row creates/selects the relation's non-Mega base form, assigns that relation's
  required Mega Stone even if another item value would otherwise be present, and turns Mega preview
  on. The member then uses existing preview behavior for sprite, stats, and locked Mega ability.
- The stored and submitted `form_id` remains the base form ID. The selected item is the canonical
  stone item ID and `mega_preview` is `true`; the Mega search ID is never submitted as a member
  form.
- Existing duplicate-species and duplicate-held-item feedback still applies. If the required stone
  is already held by another member, the deterministic selection still assigns it to the selected
  member and the existing local/server uniqueness error blocks save until the user resolves the
  conflict; the feature does not silently edit another member.
- Selecting an ordinary form keeps the existing defaults. Later changing or clearing the required
  item continues to disable/reset preview through the existing invalidation path.

### Pokédex grouped forms

- The searchable table, Pokémon suggestions, sorting, and filter results contain exactly one base
  entry for each of Castform, Aegislash, Gourgeist, and Squawkabilly. Names such as
  `Castform-Rainy`, `Aegislash-Blade`, `Gourgeist-Small`, and `Squawkabilly-Blue` do not appear as
  Pokémon search suggestions or independent rows.
- Search matches only the visible base-name entry for those families. Variant names are not hidden
  aliases. Filtering a grouped row by type, ability, or move uses the currently listed base form's
  canonical summary, not a union that could claim one impossible combination across variants.
- A compact labeled `Form` dropdown appears in detail for a grouped family. Its options are the
  base display label plus the canonical variant labels: Castform's base, Rainy, Snowy, and Sunny;
  Aegislash's Shield and Blade; Gourgeist's Average, Large, Small, and Super; and Squawkabilly's
  Green, Blue, White, and Yellow. The base record receives the user-facing Shield, Average, or
  Green label where needed without changing its canonical ID or imported upstream name.
- Changing the dropdown updates the selected canonical form and immediately replaces sprite,
  types, stats, abilities, and moves from that form's existing details. It resets detail scroll and
  move sort consistently with an ordinary form switch, preserves the shiny choice, and does not
  create another searchable/list row.
- Male and female Meowstic are not grouped together. The table and Pokémon suggestions expose
  separate `Meowstic-Male` and `Meowstic-Female` entries backed by `meowstic` and `meowsticf`, with
  their own sprite, types, stats, abilities, and moves. Their canonical Mega controls remain based
  only on valid Mega relations supplied by the selected data version.
- Other current base, regional, battle, and Mega rows retain their existing search and detail
  behavior, including the established Mega icon controls.

### Damage Calculator move modifiers

- A move with contextual inputs shows a compact, clearly named modifier trigger beside its move
  selector. Activating it opens one panel anchored to that move row; the former inline fieldset is
  absent, so opening and closing it does not change panel height or move neighboring controls.
- The overlay contains the same generated contextual controls and writes to the same
  `moveContexts[index]` object, so damage updates immediately and selection/reset semantics do not
  change. The trigger exposes expanded state and an accessible relationship to the panel.
- On ordinary desktop/tablet widths, placement is measured after open against the trigger and
  viewport: prefer the available inline side, otherwise flip, and constrain/shift within viewport
  gutters. It may use a portal owned by the calculator island so ancestor overflow cannot clip it.
- On narrow screens, the same content becomes a compact modal overlay with backdrop, bounded
  scrolling, and no horizontal overflow. The exact breakpoint follows the existing phone layout
  rather than introducing device detection.
- Escape and outside activation close the overlay; opening another move modifier closes the first.
  Focus enters the modal treatment when required, remains usable by keyboard in the anchored
  treatment, and returns to the invoking trigger on close. Resize, scroll, or a changed/cleared move
  repositions or closes stale content safely. Reduced-motion mode adds no required animation.

## Decisions and assumptions

- The formulas and behavior above are the completed interview handoff. No additional product
  choice is inferred.
- Grouping is a Pokédex presentation contract, not a normalized-data identity change. Every
  variant remains an independent canonical `PokemonForm` and `PokemonProfile` with its own
  learnset, sprite, legality, and version.
- The current pinned Showdown snapshot contains `meowsticf`, but the active generated release omits
  it because related-form selection currently follows legal roots and Mega forms only. The data
  owner must extend deterministic related-form inclusion from source relationships and regenerate
  a new immutable release; generated JSON must not be patched by hand.
- Imported names remain source facts. `Meowstic-Male`, `Meowstic-Female`, Shield, Average, and Green
  are explicit consumer display labels in the Pokédex contract. This avoids a manual data override
  whose only purpose would be UI wording.
- A new data version is required because adding `meowsticf`, its profile, learnset, sprite mapping,
  and sprite records changes normalized canonical content. Existing retained versions remain valid
  and rollback-capable. Existing persisted teams keep their pinned version and are not migrated.
- The new release uses only already-local, user-supplied snapshots and their exact recorded
  revisions. If required sprite/PokeAPI inputs are not present locally, implementation stops and
  reports the missing input rather than downloading it.
- Team Builder Mega search is driven by `MegaItemRelation`, not by `is_mega` alone, because the
  required stone and regulation-specific legal relation are part of the selection behavior.
- Backend schema strings are versioned contracts. Incompatible additions to Pokédex index/details
  and Team Builder data use new schema versions, with parsers failing closed on mismatches.
- Native buttons, a labeled native `select`, and existing contextual controls are preferred. The
  move overlay may use Preact's portal support and browser geometry APIs; no dependency is needed.

## Scope and ownership

### Pokémon data owner

`pokemon_data_coder` exclusively owns:

- `src/data/importer/legality.mjs` and, only if needed to preserve source relationship metadata,
  `src/data/importer/extract.mjs`, for deterministic inclusion of the female Meowstic source form;
- `src/data/importer/bundle.py` for reviewed sprite mapping/provenance expectations if the added
  canonical form requires the existing `meowstic-female` mapping exception;
- `src/data/tests/test_bundle.py` for extraction, normalization, semantic-diff, identity,
  learnset, profile, sprite, and generated-release regression coverage;
- the next immutable directory under `src/data/releases/`, generated from the same pinned local
  Showdown, sprite, and PokeAPI inputs with complete manifest, provenance, validation, semantic
  diff, license, records, and sprites; and
- `src/data/schema/*` only if validation proves the existing schema cannot represent the added form.
  No schema change is expected because `meowsticf` is an ordinary canonical form.

The data owner must not edit prior release directories or activate data in an operational service.

### Backend owner

`backend_coder` exclusively owns:

- `src/backend/bagredex/pokemon_data/bundles.py` for recognizing the new reviewed immutable release
  and its exact counts/hashes while preserving all prior retained versions;
- `src/backend/bagredex/pokedex.py` for explicit Pokédex search grouping, display labels, grouped
  variant metadata, and versioned index/details serialization;
- `src/backend/bagredex/teams/datasets.py` for regulation-specific Mega search entries tied to base
  form, required stone, target profile, target types/stats/abilities, and sprite identity;
- `src/backend/tests/test_pokemon_data.py`, `src/backend/tests/test_pokedex.py`, and
  `src/backend/tests/test_teams.py` for loading, retained-version, query-count, contract, grouping,
  Meowstic, Mega-search, and invariant regressions; and
- model or migration files under `src/backend/bagredex/pokemon_data` only if implementation proves
  normalized source records cannot be loaded unchanged. No model or migration change is expected.

`src/backend/bagredex/teams/services.py` remains the authoritative SP and Mega-preview validator.
It should receive regression assertions, not relaxed behavior.

### Web GUI owner

`web_gui_coder` exclusively owns:

- `src/web/src/team-builder/model.ts`, `contracts.ts`, `app.tsx`, and their adjacent tests for the
  shared SP clamp, shortcut controls, Mega search contract, and atomic Mega selection;
- `src/web/static/web/css/team-builder.css` for compact responsive SP controls and Mega result
  presentation;
- `src/web/src/contracts.ts`, `model.ts`, `app.tsx`, and their adjacent tests for versioned Pokédex
  grouped-entry parsing/filtering and the detail form dropdown;
- `src/web/static/web/css/pokedex.css` for the compact variant selector in both themes and supported
  viewports;
- `src/web/src/damage-calculator/app.tsx` and `app.test.tsx` for overlay state, positioning,
  dismissal, focus, and unchanged contextual-input updates;
- `src/web/static/web/css/damage-calculator.css` for anchored and narrow-modal treatments;
- `src/web/tests/e2e/team-builder.spec.ts`, `pokedex.spec.ts`, and
  `damage-calculator.spec.ts` for critical browser flows; and
- shared Web helpers only when a focused reuse is demonstrably smaller than feature-local code.

### Review, documentation, and delivery owners

- `pokemon_data_reviewer` reviews data extraction, generated artifacts, provenance, semantic diff,
  retained versions, and all data consumer assumptions without editing.
- `backend_reviewer` reviews Django selectors, serializers, validation preservation, query growth,
  schema versioning, and tests without editing.
- `web_gui_reviewer` reviews interactions, contracts, DOM ownership, accessibility, responsive
  overlay geometry, themes, latency, and tests without editing.
- `architect` owns cross-scope consistency review and
  `docs/reports/2026-11-01-form-search-sp-popovers.md` after findings are resolved.
- `deployment_agent` owns final local validation, activation/load checks against the local Bagredex
  runtime when available, all staging and commits, report hash correction, and candidate query.

## Data and interface impact

### Normalized data and versioning

The importer must include `meowsticf` from the pinned Showdown Pokédex whenever the selected legal
family contains Meowstic. Inclusion must follow a deterministic, tested source relation and must
not broadly admit unrelated cosmetic-only forms. The generated release must contain:

- form metadata for `meowsticf` retaining its canonical ID, source name/form label, National Dex
  number, base relationship, female-only gender, and non-Mega marker;
- a profile for each supported regulation where the form is effective, preserving female stats,
  types, abilities, and weight;
- its resolved learnset with provenance and inheritance semantics;
- membership only where Showdown legality says the female form is independently legal;
- normal and shiny sprite mappings/records using the reviewed female identifier; and
- no invented Mega-item relation. Existing male and female Mega records remain exactly as sourced,
  and only actual `MegaItemRelation` rows may drive Team Builder Mega choices.

The importer version, release ID, manifest hashes/counts, semantic diff, provenance, validation,
and backend retained-release allow-list advance together. Prior releases and active-version rollback
remain available. Loading and activation are explicit local deployment steps, not importer side
effects.

### Pokédex contracts

Bump the index contract from `pokedex-index-v1` and bulk detail contract from
`pokedex-details-v1` to new versions because grouping metadata changes parser expectations. Keep
canonical detail records for all forms. The backend owns a small explicit family map containing
the four approved base IDs, ordered member IDs, and consumer labels; startup/request serialization
must fail closed or omit an unavailable variant consistently rather than emit dangling IDs.

Each index row gains enough identity to distinguish its searchable entry ID from detail choices,
or keeps the base canonical ID while exposing ordered `variant_ids` and labels. Only the base row
is serialized for grouped families. `meowstic` and `meowsticf` are both serialized and receive the
confirmed display names. Index type/stat/ability/move fields continue to describe that row's
canonical form, preserving meaningful sorting and conjunctive filters.

Each bulk detail form remains keyed by canonical ID. Add an ordered form-selector group only to
the approved grouped families, with a stable group label and `{id, label}` options. Existing
`base_id`/`mega_ids` continue to drive Mega controls and must not be overloaded for non-Mega
variants. Web parsing validates unique option IDs, known form targets, one selected form per group,
and no dangling forms. Selecting an option calls the existing canonical selection path so all
detail fields derive from one `BulkForm` record.

### Team Builder dataset and draft contract

Bump `team-builder-data-v3` to a new version. Preserve `forms` as legal persisted non-Mega member
forms. Add a separate ordered `mega_search_entries` collection generated from effective
`MegaItemRelation` rows. Each entry includes:

- unique Mega target ID and display name;
- `base_form_id` and required `item_id`;
- target sprite form, types, base stats, ability IDs, and inherited legal move IDs needed by search,
  filters, and sorting; and
- only local URL/template-derived sprite information already used by the island.

The Web contract converts ordinary forms and Mega entries into a discriminated palette-choice
model. Ordinary choice returns `newMember(baseId, seriousId, position)`. Mega choice performs one
immutable update setting `form_id = base_form_id`, `item_id = item_id`, and
`mega_preview = true`; it does not place the target ID into the draft. Existing
`team-builder-draft-v1` and response schemas do not change. Backend `validate_draft` remains the
authority for 32-per-stat, 66-total, legal item relation, species clause, and item clause.

The Team Builder client derives SP limits from `data.mechanics.sp_max` and `sp_total_max`, not
duplicated literals. Export one pure clamp/max helper and route range, numeric, zero, and max edits
through it. Local validation remains as defensive detection for parsed/stale state even though
normal controls can no longer create an excessive total.

### Damage Calculator interface

No Django or calculator dataset schema change is planned. Move descriptors and
`moveContexts[index]` remain unchanged. Add component-local identity for the open side/move index,
an invoker reference, and measured overlay geometry. Render the overlay within the calculator
island (a portal to `document.body` is acceptable only with explicit ownership, cleanup, and
theme-token inheritance). Use fixed/viewport positioning for the anchored presentation and a CSS
media query for the modal presentation.

Positioning must use the trigger rectangle, overlay dimensions, viewport dimensions, and fixed
gutters; choose/flip side and clamp block position without mutating page layout. Event listeners
exist only while open and are removed on close/unmount. Outside-click logic must treat both trigger
and portal panel as inside. The modal presentation has dialog semantics, an accessible name,
backdrop, bounded height, focus containment, and invoker restoration. The anchored presentation
must not trap focus unnecessarily but must support tabbing through controls and closing with Escape.

## Implementation sequence

1. The data owner adds failing focused tests proving source-related inclusion of `meowsticf`, exact
   identity/profile/learnset/sprite output, deterministic extraction, and no unrelated form
   expansion. Implement the narrow importer rule and regenerate a complete candidate release from
   already-local pinned inputs. Validate its semantic diff and provenance.
2. After the release identity and records are stable, the backend owner adds the release to the
   retained allow-list and tests load/build behavior. This is the dependency boundary for backend
   Meowstic behavior; no Web contract work should assume an unreviewed generated ID.
3. In parallel after step 2, the backend owner can implement Pokédex grouping/display metadata and
   Team Builder Mega search serialization with new schema versions. Add focused serializer,
   retained-version, stale-version, query-count, and validation-regression tests.
4. Once response shapes are fixed, the Web owner updates strict parsers and contract fixtures
   before UI behavior. Invalid versions, duplicate/dangling variant IDs, missing relation items,
   and malformed stats must fail closed with existing unavailable/error states.
5. The Web owner implements and unit-tests the pure Team Builder SP clamp, routes all four edit
   mechanisms through it, and adds compact per-stat controls. Then add discriminated Mega palette
   choices and the atomic base/item/preview transition without changing submitted draft shape.
6. The Web owner implements Pokédex grouped-row behavior and the labeled detail selector using the
   canonical selection path. Preserve current Mega controls, shiny state, sorting, filters,
   keyboard shortcuts, loading/error behavior, and detail scroll rules.
7. Independently of steps 1–6, the Web owner may implement the Damage Calculator move modifier
   trigger and overlay because it has no data/backend dependency. Add one-open-panel state,
   geometry placement, narrow modal semantics, dismissal, focus restoration, and cleanup while
   retaining existing `ContextControl` and calculation state.
8. Add focused Playwright coverage for SP edge cases and buttons, Mega search/selection/save,
   grouped Pokédex search/details, both Meowstic entries, and modifier overlay geometry and focus at
   desktop/tablet/phone widths. Exercise light and dark themes where visual tokens change.
9. Each coder runs owned checks and hands evidence to the matching reviewer. Findings return to the
   exclusive owner and affected checks/reviews repeat until no blocker remains.
10. The architect reads the approved plan, full local diff, all reviewer results, and affected
    interfaces for integration review. Resolve contract/version/provenance/end-to-end drift before
    writing the cycle report.
11. The deployment agent runs the full final local suite, verifies a new data version can be built,
    loaded, explicitly activated, and exercised in the isolated Bagredex runtime using only local
    assets, then creates the feature commit. The architect records its exact hash/subject in the
    report; the deployment agent commits that narrow correction and verifies the human-review
    candidate is `available` for the exact feature commit.

## Review and verification

### Pokémon data checks

The data owner runs the focused and complete `src/data/tests/test_bundle.py` suite through the
backend `uv` project, plus the established local build/validate/semantic-diff commands for the new
release. Evidence must show deterministic repeat output, exact source revisions and hashes, prior
release retention, `meowsticf` source identity/profile/learnset/sprites, unchanged unrelated form
selection, and no hand-edited generated files. Missing local snapshots or conversion tools are a
hard stop and must not be installed or downloaded.

`pokemon_data_reviewer` verifies the inclusion rule is source-based and narrow, memberships are not
invented, male/female and Mega identities are not flattened, sprite provenance is complete, all
generated records agree, semantic diff is reviewable, and rollback remains possible.

### Backend checks

The backend owner runs from the backend uv project:

- Ruff format check and lint, mypy, and `python manage.py check`;
- focused Pytest for `test_pokemon_data.py`, `test_pokedex.py`, and `test_teams.py`, then the complete
  backend suite against PostgreSQL through the established local workflow; and
- migration consistency checks, confirming no migration is emitted unless the reviewed design
  actually requires one.

Backend tests must prove:

- only approved Pokédex families collapse to one index row and variant names are not search rows;
- index filters/stats describe the base row while details retain each canonical variant's own
  sprite/types/stats/abilities/moves;
- both Meowstic entries have confirmed labels and distinct canonical details;
- grouped option order/labels and Mega controls contain no dangling IDs across all supported
  regulations and retained versions;
- Team Builder Mega search entries are exactly relation-backed, carry the required stone and target
  presentation data, and never alter persisted form semantics;
- malformed drafts over 32 or 66, invalid Mega/item pairs, duplicate species, and duplicate items
  are still rejected; and
- selector query counts remain fixed rather than growing per form or relation.

`backend_reviewer` checks schema bumps, canonical identity, thin selectors, fail-closed behavior,
stale-version responses, query growth, validation preservation, and test quality.

### Web GUI checks

The Web owner runs from `src/web`:

- `npm run check`;
- focused Vitest for Team Builder, Pokédex contracts/model/app, and Damage Calculator app, followed
  by `npm test`;
- `npm run build`, observing the relevant Vite entries and manifest; and
- focused authenticated Playwright specs for Team Builder, Pokédex, and Damage Calculator across
  configured desktop projects plus representative tablet and `390 × 844` phone coverage when the
  established local runtime is available.

Web evidence must prove:

- SP edits clamp correctly at 0, 32, and a nearly/full 66 total; editing a currently allocated stat
  includes its own current points; range/number/`0`/`Max` agree; no transient `NaN` reaches state;
- keyboard and touch activation work, total/calculated stats update immediately, and save still
  succeeds for valid allocations while malformed bypass payloads remain rejected by backend tests;
- Mega rows can be searched, filtered, and sorted by target presentation, and selection produces
  only base form plus exact stone plus preview; item/species conflicts remain visible and blocking;
- only one row/suggestion exists for each grouped Pokédex family, variant-only queries do not return
  Pokémon suggestions, dropdown selection replaces every requested detail section, and
  `Meowstic-Male`/`Meowstic-Female` remain separate;
- ordinary forms and existing Mega detail navigation do not regress;
- opening move modifiers causes no measurable surrounding-layout shift, uses the correct side and
  move context, updates damage, flips/clamps within viewport, closes/restores focus correctly, and
  allows only one panel;
- the narrow treatment has modal semantics, contained scrolling and focus, no clipping or page
  overflow, while desktop remains anchored; and
- all new controls have visible focus, names, state announcements where needed, sufficient contrast
  and targets in light/dark themes, and functional reduced-motion behavior.

`web_gui_reviewer` checks strict contract parsing, local interaction latency, immutable state,
exclusive Preact ownership including any portal, native-control semantics, overlay event cleanup,
focus restoration, collision handling, responsive/theme CSS, and non-brittle behavior tests.

### Integration and final checks

The architect verifies that generated data, Django models, all response schemas, TypeScript
parsers, fixtures, and end-to-end expectations agree; grouped presentation never erases canonical
identity; Team Builder never submits Mega IDs; no data version is silently activated; and every
approved behavior has an end-to-end observation.

Before review handoff and final commit, run `.codex/lint.sh` and `git diff --check`. The deployment
agent runs `./bagredex.sh check` and the established isolated runtime/browser validation using only
already-local images and dependencies. No agent contacts a Git remote, registry, upstream API, or
operational service. No check is reported passed unless its output was observed.

## Risks

- Broadening related-form selection could unexpectedly expand every cosmetic family and release
  payload. Keep the source relation rule narrow, assert the semantic diff, and test unrelated
  families/counts.
- Meowstic's female form and female Mega have different identities and may not share the male
  stone relation in every regulation. Never infer a relation from names; serialize only normalized
  `MegaItemRelation` rows.
- Grouping by `base_form_id` alone would collapse regional forms and Meowstic contrary to scope.
  Use the explicit approved family map and independent canonical records.
- Unioning variant filters would produce misleading combinations. Keep the index summary tied to
  the searchable base form and switch full details only after selection.
- A Mega search row could leak its target ID into a draft or preserve the wrong prior item. Use a
  discriminated choice and one tested atomic transition that overwrites item and enables preview.
- Separate SP handlers could diverge or allow a short-lived invalid total. Centralize the pure
  clamp and derive constants from mechanics data.
- Portal overlays can lose CSS variables, be clipped, leak listeners, or misclassify outside
  clicks. Give the portal explicit island ownership, token context, cleanup, and browser geometry
  tests; use fixed positioning rather than changing ancestors.
- Anchored popovers near viewport edges can cover the wrong panel or become unreachable under
  zoom. Flip and clamp on measured geometry, bound dimensions, and use the modal breakpoint.
- A new release changes active runtime content. Retain old versions, inspect the semantic diff,
  require explicit local activation, and verify pinned historical teams continue resolving.

## Completion criteria

- All normal Team Builder SP interactions maintain integer values in 0–32 and a total at most 66,
  with correct `0` and `Max` behavior and unchanged backend rejection of invalid payloads.
- Every relation-backed legal Mega is searchable in Team Builder, and choosing it deterministically
  produces the canonical base member, exact required stone, and active preview without submitting
  a Mega form ID.
- Pokédex shows one searchable base-name row for Castform, Aegislash, Gourgeist, and Squawkabilly;
  their labeled detail dropdowns switch sprite, types, stats, abilities, and moves; variant names
  are not independently searchable.
- Pokédex shows distinct `Meowstic-Male` and `Meowstic-Female` searchable entries with canonical,
  form-specific details from a validated new immutable data release.
- Move-specific Damage Calculator inputs open in a collision-aware anchored overlay without layout
  shift and become an accessible compact modal on narrow screens, with unchanged calculations and
  reliable dismissal/focus restoration.
- Prior data releases remain loadable, the new release has complete provenance/validation and an
  observed semantic diff, existing pinned teams remain compatible, and activation is explicit.
- Data, backend, and Web reviewers report no blocking findings; architect integration review finds
  no cross-scope incompatibility, ownership violation, unplanned behavior, or missing verification.
- All focused and complete owned checks, `.codex/lint.sh`, `git diff --check`, full local checks, and
  required browser flows pass with observed output.
- The cycle report exists, names the exact feature commit after correction, the correction is a
  separate commit, and `./bagredex.sh human-review candidate` reports the exact feature boundary as
  `available`.

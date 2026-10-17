# Basic team builder

## Summary

Add Bagredex's second authenticated page: a keyboard-first team builder and **My Teams** list for
private Champions teams. A team is an explicitly saved aggregate of zero to six members, pinned to
the exact immutable data-version/regulation row that validated it. The global regulation selector
filters the list by regulation ID; opening a saved team loads the retained dataset to which that
team is pinned.

The existing normalized data supplies forms, regulation membership, abilities, learnsets, Mega
form edges, sprites, and exact level-50 stat arithmetic. It does not supply items, item legality,
Mega-stone mappings, nature definitions, or the 66-point total SP limit. Those become versioned
Pokémon-data contracts before application persistence or UI implementation depends on them.

## Goals

- Let signed-in users create, name, save, reopen, rename, and permanently delete their own private
  teams.
- Show six ordered slots and support adding, editing, removing, and reordering zero to six members.
- Enforce the selected Champions regulation, one member per base species, one copy of each held
  item, legal form/ability/move/item choices, zero to four distinct moves, and SP limits.
- Reuse the Pokédex's browser-local search concepts for a centered Pokémon command palette with
  Pokémon-name search and combinable type, ability, and learnable-move filters using AND semantics.
- Make entry flow smoothly by keyboard in this order: Pokémon, nickname, ability, item, four moves,
  nature, then six SP values. Enter accepts an autocomplete value and focuses the next field.
- Display exact Champions stats immediately, including the selected nature and SP, without showing
  the fixed level or IV concepts.
- Preserve exact regulation, form, Shiny, and Mega-preview choices across explicit saves.

## Non-goals

- Anonymous or public teams, sharing links, collaboration, publishing, or permissions beyond the
  owning user.
- Import/export, matchup analysis, damage-calculator integration, battle simulation, or Showdown
  team serialization.
- Automatic saving, stale-write/version conflict rejection, history, archive, restore, or delete
  undo.
- Gender, Poké Ball, friendship, level, IV, or other set metadata.
- Full battle-team validation beyond the approved builder rules, such as requiring six complete
  members or four moves before save.
- A SPA, client state library, DRF, OpenAPI, HTMX, Alpine, Tailwind, component library, or another
  frontend framework.
- Fetching Pokémon data from a remote. All source work uses the supplied pinned local Showdown
  snapshots.

## User-visible behavior

### Page and team list

- The authenticated application header links to **Pokédex** and **Team Builder**. `GET /teams/`
  renders the second page through Django and carries the selected regulation in the existing
  `?regulation=` query contract. Invalid or duplicate regulation parameters fail as they do on the
  Pokédex page.
- **My Teams** shows only the current user's teams whose pinned regulation canonical ID matches the
  global selector. It orders them by most recent successful save, newest first. A team retained
  against an older loaded data version remains visible under the same regulation ID and loads its
  own pinned dataset when opened.
- Selecting a team opens it directly in the editable builder. With no selected team, the page shows
  the list and an intentional empty state rather than six editable slots.
- **New Team** asks for a required name of at most 80 characters. Names are case-insensitively
  unique within one user but may be reused by different users. A new local draft is pinned by the
  server to the currently active version and selected regulation when it is first saved.
- A saved team's name can be edited and persisted with **Save**. Deletion is a separate POST/DELETE
  action with an explicit confirmation; success permanently removes it and returns to the empty
  selection state.
- Every local edit marks the builder visibly unsaved. Save is explicit. Starting another team,
  opening another team, changing the regulation, using application navigation, reloading, closing,
  or browser history while dirty asks the user to keep editing or discard. A successful save clears
  the dirty state. Failed validation or transport leaves the draft and dirty state intact.

### Slots and member editing

- A selected draft displays six numbered slots. Empty slots are add controls. Filled slots can be
  removed and moved earlier or later with labeled keyboard/touch controls. Drag-and-drop is an
  optional enhancement only if it preserves those controls and the same deterministic order.
- Clicking an empty slot opens a centered modal command palette. Its single search input and result
  list follow the existing Pokédex combobox behavior and matching model, while allowing Pokémon
  names plus type, ability, and learnable-move filters. Multiple filters combine with AND semantics.
  Results contain only non-Mega forms legal in the pinned regulation. Legal non-Mega alternate
  forms remain independently selectable.
- The same base species may occur only once. The species identity is the selected form's normalized
  `base_form`, matching Champions Species Clause across alternate forms. Unavailable results are
  removed or disabled with an explanation before selection, and the server enforces the rule again.
- Selecting a Pokémon creates a member with blank nickname, blank ability/item/moves, Serious
  nature, zero SP in all six stats, Shiny off, and Mega preview off. A filled member is saveable with
  only that species and these defaults; every optional value that is present must be valid.
- Nickname is optional and at most 12 characters. Ability choices are only the selected non-Mega
  form's legal abilities. Mega-only abilities never appear in the base ability autocomplete. Item
  choices are legal for the pinned regulation, and an item already held by another member is not
  selectable. Each of four ordered move inputs offers only the selected form's legal learnset and
  rejects a move already selected for that member.
- Nature autocomplete contains Champions-valid stat-changing natures plus Serious as the only
  neutral choice exposed by Bagredex. Serious is the default. The UI and persisted model use exact
  plus/minus stat identities rather than a display-only multiplier label.
- Each stat has a linked 0–32 integer slider and directly editable numeric input. The six values may
  total no more than 66. Client controls prevent or explain over-allocation, and authoritative save
  validation rejects per-stat, integer, and total violations without silently clamping values.
- Real HP, Attack, Defense, Special Attack, Special Defense, and Speed update locally after each
  nature or SP edit using exact integer Champions arithmetic. Level 50 and maxed IVs are mechanics
  inputs but are not displayed as editable or informational fields.

### Shiny and Mega display

- Shiny is always an available labeled toggle, affects the sprite, and persists.
- When the selected item is the selected form's own normalized Mega Stone, a labeled Mega preview
  toggle appears on the sprite. It is off by default. Turning it on changes the sprite, displayed
  stats, and displayed ability to the mapped Mega profile; the saved member remains the legal base
  or non-Mega form and its chosen base ability remains stored unchanged.
- Multiple members may independently retain Mega preview on. This is presentation state, not a
  one-Mega team restriction.
- Changing or clearing the item immediately hides and resets Mega preview when the item/form pair no
  longer has that Mega mapping. Changing species also resets it. The server rejects a persisted true
  value unless the exact pinned regulation, item, base form, and Mega target relation agree.
- Where one base has multiple Mega forms, the stone-to-form mapping, not relation order, determines
  the single preview target. The displayed Mega ability comes from the target profile and cannot be
  edited while previewing; turning preview off restores the base form and selected base ability.

### States and errors

- The page has deliberate unavailable, loading, empty-list, empty-team, saving, save-success,
  validation-error, load-error, deletion-error, and pinned-data-unavailable states. Errors are
  announced and associated with the affected field or team without discarding input.
- Requests for another user's team return not found and never disclose its name or contents.
  Anonymous requests use the existing login redirect behavior. All mutations require CSRF.
- There is deliberately no optimistic-lock token. If the same team is saved from two tabs, the last
  valid complete aggregate received wins.

## Decisions and assumptions

- The completed `grill-me` discovery in the parent feature thread is the authoritative handoff;
  there are no remaining material product questions.
- A regulation dataset means the exact `pokemon_data.Regulation` row and therefore its immutable
  `DataVersion`. Changing the active pointer never retargets an existing team. Deletion of referenced
  versions/regulations remains protected.
- The global selector filters by regulation canonical ID, not current version primary key. This is
  necessary for older pinned teams to remain usable while preserving immutable mechanics.
- A new draft may be local before first save, but its bootstrap names the active version and exact
  selected regulation. Create validation resolves that pair again and fails clearly if it is no
  longer available; it never silently pins a different regulation or version.
- The current Showdown Champions validator fixes all IVs at 31, caps each Stat Point value at 32,
  derives a total cap of 66 from `EV Limit = Auto`, and uses the existing formulas in
  `data/mods/champions/scripts.ts`. Bagredex stores no IV or level field.
- Showdown's validator contains guidance involving other neutral natures, but the approved product
  rule exposes only Serious as neutral. This restriction must be explicit, deterministic, and
  regression-tested rather than inferred from missing source rows. Stat-changing nature definitions
  still come from the pinned Showdown source.
- Zero total SP with Serious is allowed for an incomplete Bagredex member despite Showdown's
  advisory “did you forget to invest” validation message. The explicit incomplete-save requirement
  controls builder persistence; numeric bounds remain authoritative.
- Empty ability, item, and move slots are valid persisted values. Nature and SP defaults are present
  whenever a member exists. A team may have zero members.
- The backend owns all domain validation and exact arithmetic. The island duplicates calculation and
  validation only for immediate feedback; shared JSON mechanics facts and cross-language golden
  tests prevent drift.

## Scope and ownership

### Pokémon data owner: `pokemon_data_coder`

Exclusive ownership for this cycle:

- `src/data/importer/**`
- `src/data/releases/<new-team-builder-bundle>/**`
- `src/data/README.md` and data fixtures needed for item/nature/mechanics goldens
- Pokémon-data model, load, bundle, admin, and migration changes under
  `src/backend/bagredex/pokemon_data/**`
- Pokémon-data-specific tests in `src/backend/tests/test_pokemon_data.py`

This owner extends the immutable bundle and loader with normalized items, regulation-effective item
legality, nature effects, stone-specific Mega relations, and total SP cap. It does not create user
team models, views, templates, or UI code.

### Backend owner: `backend_coder`

Exclusive ownership for this cycle:

- New team domain/application package under `src/backend/bagredex/teams/**`, including models,
  migrations, aggregate validation, serialization, views, and admin where useful
- Team routes and integration edits in `src/backend/bagredex/urls.py`
- Narrow shared regulation/snapshot helpers in `src/backend/bagredex/regulations.py` or
  `src/backend/bagredex/pokedex.py` only when required by both pages
- Backend team tests in a new `src/backend/tests/test_teams.py`, plus narrowly affected existing
  backend tests

This owner consumes the normalized data contract, owns private persistence and authenticated JSON
boundaries, and supplies the Django template context. It does not edit `src/data` or `src/web`.

### Web GUI owner: `web_gui_coder`

Exclusive ownership for this cycle:

- Team-builder Django templates under `src/web/templates/**` and navigation edits to existing
  templates
- A separate team-builder Preact/Vite entry and its TypeScript modules/tests under `src/web/src/**`
- Team-builder plain CSS under `src/web/static/web/css/**`
- Vite manifest/build configuration only as needed for the new feature-split entry
- Team-builder Playwright coverage under `src/web/tests/e2e/**`
- Generated `src/web/static/web/dist/**` outputs produced by the existing build

The Web owner may refactor Pokédex search/filter primitives into shared Web-owned modules, retaining
the Pokédex behavior and tests. It does not implement authoritative legality or edit backend/data
files.

### Architect and deployment owner

- `architect` owns this plan, later cross-scope consistency review, and the cycle report under
  `docs/reports/2026-10-17-basic-team-builder.md`.
- `deployment_agent` alone owns final `.codex/lint.sh`, any required existing local runtime
  validation, local Git staging, and justified commit(s). No Git remote operation is permitted.
- No deployment-file change is expected. If migration/startup behavior exposes a deployment defect,
  the deployment agent owns the minimum `deploy/**` correction after architect review.

The data stage precedes dependent backend and Web contracts. After its schema is agreed, backend
and Web work may proceed in parallel against the frozen JSON contract; generated release files and
generated Vite outputs retain their respective single owners.

## Data and interface impact

### Normalized immutable Pokémon data

Increment the bundle schema and importer version because existing releases lack required records.
Keep retained schema-1/schema-2 releases readable exactly as today, but only the new schema can back
new team creation. The new bundle adds:

- `items.json`: version-owned canonical item ID and display name.
- `item_profiles.json`: regulation-effective legal item records. Preserve enough normalized source
  status/provenance to prove inclusion and reject nonstandard, unavailable, or banned items rather
  than shipping an unfiltered base item table.
- `natures.json`: canonical nature ID/name with nullable `increased_stat` and `decreased_stat` IDs;
  retain stat-changing Champions-valid natures and Serious. Validation rejects any other neutral
  nature from the builder allow-list.
- `mega_item_relations.json`: regulation-scoped item profile + selectable base/non-Mega form + exact
  Mega target form. Derive it from the effective Showdown item's `megaStone` mapping and effective
  form data. Validate target `is_mega`, base/target relationship, same regulation/version, and
  uniqueness of `(regulation, item, base_form)`.
- `mechanics_profiles.json`: add `sp_total_max: 66` while preserving level 50, 0–32 per-stat bounds,
  nature percentages, and formulas.

Add corresponding version-owned Django models such as `Item`, `ItemProfile`, `Nature`, and
`MegaItemRelation`; exact names may follow existing conventions. Use uniqueness, version-locality,
and referential constraints comparable to abilities/moves/profiles. The load remains atomic,
idempotent, hash-verified, reviewable by semantic diff, and activation remains explicit. Loading
the new release does not mutate old rows.

The semantic comparison and validation summary include added/removed/changed items, item profiles,
natures, Mega-item mappings, and mechanics total cap. Golden fixtures cover an ordinary item, a
legal Mega Stone with an unambiguous target, a base with multiple possible Mega targets resolved by
different stones, every nature plus/minus direction, Serious, all three regulations, and an invalid
cross-version/cross-regulation relation.

### Team persistence

Create a dedicated user-authored team aggregate, separate from imported data:

- `Team`: owner FK with cascade on user deletion; protected FK to exact `Regulation`; name up to 80;
  created and updated timestamps. Add a database `UniqueConstraint(Lower("name"), "owner")` and an
  index supporting owner + regulation canonical ID + newest-update listing.
- `TeamMember`: team FK, position 0–5, exact selectable `PokemonProfile` FK, redundant protected
  `species_form` FK equal to `profile.form.base_form` for a durable `(team, species_form)` uniqueness
  constraint, optional nickname up to 12, optional base `AbilityProfile`, optional `ItemProfile`,
  required Serious-or-stat-changing `Nature`, six integer SP columns defaulting to zero, Shiny
  boolean, and Mega-preview boolean. Constrain `(team, position)`, `(team, species_form)`, and
  conditional `(team, item_profile)` uniqueness; constrain each SP column to 0–32. Aggregate
  validation proves all imported FKs belong to the team's exact regulation/version, total SP is at
  most 66, selected form is a non-Mega member, ability belongs to that profile, and true Mega
  preview has the matching stone relation.
- `TeamMemberMove`: member FK, position 0–3, `MoveProfile` FK; constrain position and move uniqueness
  within a member. Aggregate validation proves the move is in the selected profile's learnset in the
  pinned regulation.

Because PostgreSQL constraints cannot express every cross-table regulation rule, write all creates
and replacements through one domain service inside `transaction.atomic()`. Lock the owned team row
for update during replacement to avoid partial aggregates, but deliberately do not compare a client
revision. Never trust redundant species identity or regulation identifiers from the client; derive
them from normalized rows. Deleting a team cascades only its user-authored members/moves, never
imported data.

Use a normal migration with no fabricated teams. Existing accounts and Pokémon data remain intact.
Rollback before users create teams is the reverse migration; after team creation, rollback requires
an explicit data-retention decision and must not drop user teams silently.

### HTTP and JSON contracts

Django owns HTML, authentication, ownership, CSRF, persistence, and validation. Preact owns the
mounted builder root only. Use same-origin endpoints without DRF:

- `GET /teams/?regulation=<id>` renders the page, selector, regulation-filtered team summaries, and
  a versioned bootstrap object. Summary fields are team ID, name, pinned version/regulation label,
  member count, and last-saved timestamp.
- `GET /teams/data/<version>/<regulation>/` returns a cacheable-private builder dataset for a loaded
  retained exact pair. The response includes non-Mega selectable form summaries and search filter
  IDs, per-form legal ability/move IDs, all legal items, approved natures, mechanics bounds/formula
  identifiers, Mega item mappings and target profile facts, and normal/Shiny sprite URL templates.
  It is a team-specific schema rather than silently widening the current Pokédex schemas.
- `GET /teams/<team-id>/` returns the complete aggregate only after owner filtering. It includes the
  pinned version/regulation and ordered members/moves with canonical IDs.
- `POST /teams/` creates a team from one complete draft payload. The server pins the exact active
  version + selected regulation from validated create context, not arbitrary client FKs.
- `PUT /teams/<team-id>/` replaces one owned aggregate atomically, including rename/order/removals.
  The pinned regulation/version cannot change.
- `DELETE /teams/<team-id>/` permanently deletes one owned aggregate after the UI's confirmation.

Use opaque team identifiers (UUID preferred) and do not expose ownership through predictable-error
differences. Mutations accept JSON plus Django's CSRF token and return one documented versioned
envelope. Success returns the canonical saved aggregate and refreshed summary/update time. Errors
use stable codes plus general and field paths such as `name`, `members.2.item`, or
`members.2.sp.attack`; never return raw database errors. Define payload size/count limits before
deserializing nested members. Unsupported schema, malformed JSON, duplicate keys represented in
arrays, unknown IDs, unavailable pinned data, and method errors fail closed.

The builder dataset endpoint differs from existing Pokédex endpoints: it must serve any retained
loaded version referenced by an owned team, not only the active pointer. A new-team bootstrap may
use only the active exact pair. Keep retained-version resolution separate from the Pokédex's
active-version stale-response policy so neither page's semantics regress.

### Browser contracts and interaction architecture

Add a separate Vite entry (for example `src/web/src/team-builder.tsx`) and manifest key. The Django
template emits JSON with `json_script`; TypeScript performs strict runtime parsing before mounting.
No user-authored content is inserted as HTML.

Keep one reducer-owned draft containing the server baseline, working aggregate, selected slot,
palette/autocomplete state, load/save state, and a structural dirty comparison. Do not use request
round trips for filtering, autocomplete, SP changes, stat calculation, reordering, Shiny, or Mega
preview. Fetch each exact builder dataset once per opened pinned pair and retain it for that page
session. Abort or ignore superseded team/data loads.

Extract or reuse Web-owned pure search functions from the Pokédex for normalized matching,
suggestions, and AND filters. The team palette excludes `is_mega` and non-members before presenting
results. Field autocompletes use semantic combobox/listbox patterns, deterministic name ordering,
Arrow navigation, Escape dismissal, Enter acceptance, and focus advancement. Do not make Enter on
an unconfirmed arbitrary string persist an ID.

Use the normalized formula contract and exact integer truncation in a pure TypeScript stat helper.
Nature changes only its declared plus/minus non-HP stats; HP is never nature-modified. Mega preview
uses the Mega target's base stats and displayed ability while retaining base member fields. Backend
and frontend goldens must share representative expected values, including truncation boundaries,
SP 0/32, total 66, Serious, increasing/hindering stats, and Mega targets.

Dirty navigation protection combines an in-app confirmation for actions the island controls with
`beforeunload` for browser departure. The server-rendered global selector/navigation outside the
root must expose an event hook the island can cancel while dirty; the island must not mutate those
nodes. Confirmed discard performs the original action and restores no draft.

All controls have programmatic labels, visible focus, touch-sized targets, and announced results.
The modal traps focus, closes on Escape, restores focus to the originating slot, and supports
reduced motion. Reordering announces the new position. Responsive behavior prioritizes desktop,
supports tablet editing without hover, and retains a functional vertically stacked phone layout.
Light and dark themes reuse existing semantic tokens and Indigo Purple accents.

## Implementation sequence

1. The Pokémon data owner records current bundle/source facts, adds the bundle schema/importer
   contract for items, item legality, natures, stone mappings, and `sp_total_max`, and writes failing
   fixture/schema/golden tests. Inspect the exact local historical/current Showdown trees selected
   for M-A/M-B/M-C; do not infer all regulations from the current checkout.
2. Extend deterministic extraction, normalization, manifest hashing, validation, semantic diff,
   loader models/migration/services, and database guards. Build and validate one new immutable
   multi-revision release from already-local pinned inputs, then load and explicitly activate it in
   the controlled validation environment. Review its semantic summary before downstream work.
3. Freeze and document the team builder dataset and aggregate JSON examples in tests. Backend and
   Web owners agree on schema versions, canonical ID fields, error paths, and retained-version
   behavior. No application implementation proceeds against guessed item/nature structures.
4. The backend owner creates team persistence and migrations, then implements a pure aggregate
   validator/service with exact arithmetic and atomic create/replace/delete behavior. Cover database
   constraints and malicious cross-version/cross-user/cross-regulation combinations before views.
5. Add authenticated page/data/team endpoints, CSRF-protected mutations, ownership filtering,
   bounded parsing, query-efficient summaries, and bootstrap context. Render a semantic no-script
   shell with useful list/unavailable content and a single exclusive island root.
6. In parallel after contract freeze, the Web owner extracts shared Pokédex search primitives with
   regression coverage and creates the feature-split team-builder entry, strict contract parsers,
   reducer/domain helpers, stat arithmetic, and request layer.
7. Build the My Teams/list/create/open/save/rename/delete flows, dirty guards, six-slot editing,
   accessible reorder/remove controls, command palette, field autocompletes and Enter progression,
   SP controls, calculated stats, sprites, Shiny, and item-gated Mega preview. Add drag reorder only
   after the accessible controls and tests are complete.
8. Owners run their focused checks and hand off to `pokemon_data_reviewer`, `backend_reviewer`, and
   `web_gui_reviewer`. Return every actionable finding to its exclusive owner and repeat focused
   review/checks until no blocking finding remains.
9. The architect reviews the approved plan, complete local diff, data/reviewer results, endpoint and
   schema agreement, retained-version behavior, and end-to-end evidence. Resolve all blocking
   integration findings, then write `docs/reports/2026-10-17-basic-team-builder.md`.
10. The deployment agent runs the final local checks, verifies migrations and already-local Podman
    behavior if needed, then creates justified local commit(s). It performs no remote operation.

## Review and verification

### Pokémon data checks

- Run the importer unit tests and bundle validation/compare commands documented in
  `src/data/README.md` against the new release and its predecessor.
- Build twice from identical pinned local inputs and compare every normalized JSON, manifest,
  validation summary, and hash byte-for-byte.
- Prove M-A/M-B/M-C legal item coverage, excluded invalid/nonstandard items, exact nature set and
  effects, Serious policy, per-stat 32 and total 66 mechanics, and stone-to-base-to-Mega mappings.
- Reject duplicate IDs, invalid stat IDs, unsupported neutral natures, missing profiles, wrong
  regulation/version edges, non-Mega targets, ambiguous mappings, changed hashes, and unsupported
  bundle schemas. Verify older retained releases still validate/load under their existing contract.

### Backend checks

Run from `src/backend` through uv:

```text
uv run ruff format --check .
uv run ruff check .
uv run mypy bagredex tests
uv run python manage.py makemigrations --check --dry-run
uv run python manage.py check
uv run pytest
```

Focused tests must cover:

- authentication redirects, CSRF, method restrictions, owner isolation with indistinguishable 404s,
  and no cross-user list/detail/mutation leakage;
- required/trimmed/max-length names, case-insensitive per-user uniqueness including concurrent
  attempts, rename conflicts, ordering by successful save, regulation filtering, and delete cascade;
- empty teams, incomplete members, six-member/position bounds, reorder replacement, nickname 12,
  non-Mega membership, base-species uniqueness across forms, held-item uniqueness, form abilities,
  learnsets, duplicate/ordered moves, nature allow-list, SP integer/range/total, Shiny, and Mega
  preview invariants;
- cross-version/cross-regulation forged IDs, unavailable retained versions, pinned-regulation
  immutability, atomic rollback on one invalid nested field, and last-valid-save-wins behavior;
- exact stat goldens for base and Mega forms, all nature branches, truncation, and SP boundaries;
- fixed/bounded query counts for team lists, aggregate reads, and builder datasets; bounded payloads
  and stable structured errors; and no regression in existing Pokédex active-version/ETag behavior.

### Web checks

Run from `src/web` using the existing installed toolchain:

```text
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Unit/component tests cover strict schemas, normalized search, mixed AND filters, Mega exclusion,
species/item/move duplicate prevention, incomplete drafts, reducer dirty/baseline transitions,
request races/failures, field-error mapping, focus progression, SP linked controls, exact stats,
stone gating/reset, and persisted Shiny/Mega preview.

Playwright exercises authenticated create/save/reopen/rename/delete and owner isolation with the
local test server in Chromium and Firefox. The critical keyboard run creates a team, selects a
Pokémon through the centered palette and mixed filters, enters nickname → ability → item → moves →
nature → all SP values via Enter, checks calculated stats, toggles Shiny and eligible Mega preview,
adds another member, reorders, saves, reloads, and verifies exact restoration. Additional runs cover
validation recovery, duplicate prevention, unsaved prompts for every exit path, cancel/discard,
empty and unavailable states, light/dark/reduced-motion, desktop/tablet/phone, focus trap/restore,
touch targets, and no unexpected console or external-network errors.

### Cross-scope and final checks

- Run `.codex/lint.sh` before review handoff and again before commit; correct owned failures.
- Verify Vite emits a distinct team-builder entry in the manifest and Django resolves it without
  loading the Pokédex application bundle on `/teams/`.
- Inspect migrations forward and backward on a disposable PostgreSQL database, then verify existing
  account/Pokédex behavior and exact active-data selection remain intact.
- Inspect the full diff for ownership violations, generated-file provenance, accidental remote
  references, secrets, unrelated edits, dependency additions, and documentation drift.
- The architect must explicitly state whether blocking integration findings remain. Deployment may
  commit only after all three scope reviewers and architect report no blockers.

## Risks

- Showdown item legality is ruleset- and mod-dependent, not equivalent to copying `data/items.ts`.
  The importer must resolve the pinned effective format and fail closed on unsupported rule shapes.
- The current `MegaRelation` says which forms relate but not which item selects a target. Guessing
  by names would mis-handle bases with multiple Mega forms; normalized item mappings are mandatory.
- Existing builder-adjacent endpoints reject non-active versions. Reusing that resolver would make
  older pinned teams unusable after activation changes; retained exact-pair resolution needs focused
  authorization and regression tests.
- Cross-table legality cannot all be expressed as database constraints. One authoritative atomic
  service, redundant constrained species identity, and adversarial request tests reduce drift and
  race exposure.
- Case-insensitive name behavior can diverge between Python and PostgreSQL. The database expression
  constraint is authoritative; request validation should translate its integrity error cleanly.
- Large learnsets and complete item/form metadata can make the initial payload heavy. Measure the
  compressed builder dataset and interaction latency before adding virtualization or workers; keep
  it regulation/version scoped and avoid repeating metadata per form.
- Dirty navigation spans Preact-owned and Django-owned controls. An explicit cancelable integration
  hook is required so the island does not take ownership of header DOM.
- Client and backend stat implementations can drift. Formula identifiers, integer-only arithmetic,
  and shared golden examples gate acceptance.
- The approved Serious-only neutral policy is narrower than hints in the local Showdown validator.
  Keep it explicit in validation and documentation so a future import cannot silently widen it.
- Removing the feature after real use risks user-authored data loss. Rollback must preserve team
  tables unless deletion is separately approved.

## Completion criteria

- A validated, deterministic, explicitly activated immutable bundle normalizes regulation-legal
  items, approved natures, stone-specific Mega mappings, and the 66-point SP cap with full
  provenance, semantic diff, database loading, and retained old-release compatibility.
- Signed-in users can use `/teams/` to create, explicitly save, reopen, rename, reorder, and delete
  only their own regulation-pinned zero-to-six-member teams; My Teams filters by global regulation
  and orders by latest successful save.
- All approved legality, incompleteness, nickname, duplicate, nature, SP, Shiny, Mega-preview, and
  exact-stat behaviors are enforced authoritatively and reflected immediately in the accessible UI.
- Pokémon selection uses the centered reusable name/type/ability/move AND-filter palette; remaining
  fields use keyboard-operable autocomplete and Enter advances through the agreed field order.
- Dirty state and discard protection cover switching/new/open/regulation/navigation/reload/close,
  and failures never silently discard or rewrite the draft.
- The page remains a Django-rendered shell with one feature-split Preact island, plain themed CSS,
  no prohibited architecture/dependency, and no external runtime or build-time data access.
- Pokémon data, backend, Web GUI, and integration reviews have no blocking findings; every required
  focused and full check above is observed passing; the cycle report exists; and the deployment
  agent reports the final local commit(s) with no remote operation.

# Item information

## Summary

Add regulation-effective held-Item short and full effect descriptions to the next immutable
Pokémon data release, persist them without rewriting retained releases, and expose them through
the team builder's established accessible information control. Pokémon Showdown remains the sole
source, and all text comes from the already-pinned local revisions.

This plan completes the work deferred by
[`2026-10-23-item-information.md`](../tasks/2026-10-23-item-information.md).

## Goals

- Extract each legal held Item's text from that regulation's exact-revision
  `data/text/items.ts`, preserving source wording after trimming surrounding whitespace. Use
  `shortDesc` for the short description and `desc`, when present, for the full description;
  otherwise use that same revision's `shortDesc` as the canonical full-description fallback. The
  exact six-Item M-A compatibility overlay documented below is the sole source-revision exception.
- Create and validate a new immutable normalized bundle whose Item descriptions are complete,
  versioned, provenanced, and visible in semantic comparisons.
- Load descriptions atomically into nullable database fields so previously loaded versions remain
  valid and unchanged.
- Serve Item details from the requested active or owner-authorized retained data version without
  per-click requests or N+1 queries.
- Reuse the team builder's Ability/Move tooltip, dialog, keyboard, touch, and focus behavior for a
  valid selected Item.
- Preserve Item legality, held-Item uniqueness, Mega mappings, team persistence, and existing
  Ability/Move information behavior.

## Non-goals

- Updating either local Showdown snapshot or changing the approved upstream source.
- Showing regulation, legality, `source_status`, or provenance metadata in the Item dialog.
- Backfilling old loaded database versions or generically borrowing descriptions from another
  source revision. The approved, explicitly enumerated six-Item M-A text overlay described below
  is the only exception.
- Changing Item legality, held-Item uniqueness, Mega Stone mappings, or team save semantics.
- Adding a live upstream dependency, runtime scraping, Web-bundled Item copy, discretionary
  editorial overlays, a new client framework, or a per-Item details endpoint.
- Entering the optional human-review workflow without a later explicit `$human-review` request.

## User-visible behavior

- A valid selected Item with descriptions has an `(i)` control beside its autocomplete field.
- Hovering or focusing the control shows the Showdown short description. Activating it by click,
  touch, or the field's `Alt+I` shortcut opens a modal containing only the Item name and full
  description.
- Closing the modal by its close button, `Escape`, or backdrop restores focus to the invoking Item
  field or information button, following the existing Ability/Move behavior.
- Blank, invalid, unavailable, or legacy-version Items without descriptions have no enabled or
  focusable information control. Their normal editing and saving behavior remains unchanged.
- The behavior remains usable on desktop, tablet, and phone, in light and dark themes, with the
  established visible focus, tooltip, and responsive dialog styling.

## Decisions and assumptions

- Regulation M-A uses local Showdown commit
  `b555f4d8ce7250e72939fe0c12cc5b303741d203`; M-B and M-C use
  `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`. The sprites and PokeAPI mapping pins remain
  unchanged.
- The version-effective `data/items.ts` tables continue to determine legal Item identity and
  status, but Item descriptions come from the owning revision's `data/text/items.ts` table. The
  extractor does not use `source_status` as descriptive content.
- `shortDesc` must exist and remain non-empty after surrounding-whitespace trimming. It supplies
  `short_description`. A present, non-empty trimmed `desc` supplies `description`; otherwise the
  same record's trimmed `shortDesc` supplies `description`. Each normalized profile records
  whether the full description came from `desc` or the `shortDesc` fallback.
- One narrow source exception is approved. Historical M-A commit
  `b555f4d8ce7250e72939fe0c12cc5b303741d203` legally enables exactly six Items that are absent
  from that commit's `data/text/items.ts`: `chimechite`, `crabominite`, `glimmoranite`, `golurkite`,
  `meowsticite`, and `scovillainite`. The already-pinned current commit
  `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640` contains text for all six. Their normalized M-A
  profiles may obtain text only from that current commit. Implement this as one documented,
  machine-validated, version-pinned compatibility overlay/set containing exactly those six keys.
  Each transition records the target regulation and Item, target historical revision, text-source
  revision, exact before/after transition, rationale, date, and regression fixture. The set changes
  text provenance only; legality, identity, status, and Mega relations remain determined by the
  historical M-A tables.
- Every other cross-revision text substitution is forbidden. The overlay matcher must fail closed
  if either pinned revision changes, the target keys differ from the exact six-member set above,
  the set cardinality is not six, historical text unexpectedly appears for any member, current
  source text disappears or changes from a fixture, or any before/after transition does not match
  exactly.
- The pinned current source demonstrates why fallback is required: every standard base Item has
  `shortDesc`, while 232 of 249 lack `desc`; among extracted legal Items, 146 of 148 M-B profiles
  and 164 of 166 M-C profiles lack `desc`. The historical M-A revision is evaluated independently
  under the same deterministic rule before the approved six-Item compatibility overlay is applied.
- Source wording and internal whitespace are preserved. Bagredex performs no punctuation,
  capitalization, terminology, markup, or line-break normalization beyond trimming the beginning
  and end.
- Increment the portable bundle schema, importer version, and source-shape version. The new schema
  requires `short_description`, `description`, and record-level `description_source` provenance on
  every `item_profiles.json` record; retained schemas keep their original shape and validation
  rules.
- Add nullable Item description columns in Django. A new-schema load always writes non-null,
  non-empty values, while rows belonging to already-loaded releases remain null. No data migration
  mutates those rows.
- Increment `team-builder-data-v2` to `team-builder-data-v3`. Every serialized Item has
  `short_description` and `description`, each either a non-empty string from its exact ItemProfile
  or `null` for a retained legacy profile. The Web parser rejects half-present pairs, empty
  strings, and incorrect types. This explicit compatibility signal avoids changing the meaning of
  the existing dataset schema silently.
- The bootstrap, team draft, team API, persisted team, and URL schemas do not change. Dataset
  authorization and retained-version resolution continue to select one exact snapshot before
  serialization.
- No new package or dependency is needed.

## Scope and ownership

### Pokémon data coder

Owns all changes under `src/data`, including:

- `src/data/importer/extract.mjs` allow-listing and exact-revision extraction of Item text from
  `data/text/items.ts`, including deterministic same-record fallback provenance;
- one `src/data/overrides` compatibility overlay/set and six regression fixtures for exactly the
  enumerated M-A source-text transitions, with no reusable cross-revision fallback mechanism;
- `src/data/importer/bundle.py` version constants, normalized records, strict validation,
  provenance/inventory coverage, and semantic comparison behavior;
- `src/data/tests` fixtures and tests for trimming, absent or malformed `shortDesc`, present,
  absent, blank, or malformed `desc`, fallback counts, duplicates, regulation/revision scoping,
  the exact overlay preconditions and provenance, rejection of any other cross-revision source,
  retained schemas, and reviewable description changes;
- `src/data/README.md` bundle-contract and version documentation; and
- the newly generated `src/data/releases/showdown-multi-s4-i5-<hash>/` directory. Existing release
  directories must not be edited or removed.

### Backend coder

Owns all changes under `src/backend`, including:

- a new additive `bagredex/pokemon_data/migrations` migration;
- `bagredex/pokemon_data/models.py`, bundle reader/validation, load services, and read-only admin
  representation for nullable legacy versus required new-schema Item descriptions and their
  internal source marker;
- `bagredex/teams/datasets.py` and its contract constant to serialize exact-version Item details
  in `team-builder-data-v3` using the existing set-based Item query; and
- backend bundle, migration/load/activation/admin, dataset, authorization, retained-version,
  query-count, Mega mapping, and team-save tests.

The backend coder does not edit generated data releases or Web files.

### Web GUI coder

Owns all changes under `src/web`, including:

- `src/web/src/team-builder/contracts.ts` Item-detail typing and strict
  `team-builder-data-v3` parsing;
- `src/web/src/team-builder/app.tsx` Item lookup, autocomplete information associations,
  `Alt+I`, and the Item branch of the shared information control;
- existing team-builder CSS only if a demonstrated Item placement or responsive defect requires
  it; and
- unit/component, contract, accessibility, keyboard, touch, unavailable-state, theme, and E2E
  coverage, including replacement of assertions that Item information is always absent.

The Web GUI coder does not duplicate descriptions in TypeScript fixtures beyond test values and
does not add a per-click request.

### Architect and deployment agent

- The architect owns this plan, cross-scope integration review, and the final cycle report under
  `docs/reports`.
- The deployment agent owns `deploy/pokemon-data.env`, any necessary deployment documentation or
  scripts, final validation, local Git staging, and the justified local commit. It pins the exact
  newly reviewed bundle ID; it does not contact a registry, server, or Git remote.

## Data and interface impact

The new portable data contract adds the following required fields to each new-schema
`item_profiles.json` record:

```json
{
  "regulation_id": "m-a",
  "id": "exampleitem",
  "name": "Example Item",
  "source_status": "standard",
  "short_description": "Short Showdown effect text.",
  "description": "Full Showdown effect text.",
  "description_source": "desc"
}
```

Bundle validation must enforce exact keys and types, canonical `(regulation_id, id)` uniqueness,
known Item/regulation references, `source_status == "standard"`, non-empty trimmed description
text, `description_source` restricted to `desc` or `shortDesc`, exact manifest hashes, and the
existing pinned two-source provenance. A `shortDesc` source marker requires `description` to equal
`short_description`; importer tests prove a `desc` marker corresponds to a present non-empty
same-revision source value. Provenance and validation inventory record the source-marker counts by
regulation so fallback use is explicit and reviewable. Inventory counts remain stable unless the
pinned source proves otherwise; description or source-marker changes appear as changed
`item_profiles.json` keys in `compare` output. Tests must prove descriptions for the same Item are
resolved from the regulation's owning revision rather than merged across revisions, except for the
exact enumerated six-Item M-A overlay.

The six-Item overlay is part of the canonical bundle input and appears in `provenance.json`, the
manifest overlay inventory, validation output, and semantic review. Its provenance records both
`b555f4d8ce7250e72939fe0c12cc5b303741d203` as the target/legality revision and
`3a766f2cfb5e51c1e428cfe87d0dba91a8f01640` as the text-source revision, plus its rationale and
six fixture hashes. Validation requires the sorted target-key inventory to equal exactly
`chimechite`, `crabominite`, `glimmoranite`, `golurkite`, `meowsticite`, and `scovillainite`, with
cardinality six. Each normalized Item profile still carries the ordinary resolved description
fields and source marker; no overlay metadata is sent in `team-builder-data-v3` or shown in the UI.

`ItemProfile.short_description`, `ItemProfile.description`, and the internal description-source
marker are nullable solely for retained pre-feature releases. The new-schema reader rejects
missing or blank normalized text and invalid source-marker combinations before the atomic load
transaction, and the loader persists all three values with the owning DataVersion and Regulation.
The database migration is additive and does not activate a release or update existing rows.

The `team-builder-data-v3` Item shape is:

```json
{
  "id": "exampleitem",
  "name": "Example Item",
  "short_description": "Short Showdown effect text.",
  "description": "Full Showdown effect text."
}
```

For an authorized retained pre-feature version, both description fields are `null`. The dataset
continues to return all Item choices in one response and uses the already-resolved snapshot; it
must neither fall through to the active version nor query by click. The Preact Item-detail type
represents the paired nullable fields and creates information state only when both are non-null.

## Implementation sequence

1. The Pokémon data coder advances the portable contract, adds `data/text/items.ts` to both
   current and historical local extraction allow-lists, joins text to effective legal Items within
   each exact revision, and applies and records the deterministic `desc`/`shortDesc` rule.
2. The Pokémon data coder adds the single version-pinned M-A compatibility overlay/set with its six
   enumerated keys and regression fixtures. Tests prove exact set equality and cardinality, all
   per-Item overlay preconditions, both revision pins, exact before/after content,
   provenance/inventory visibility, unchanged M-A legality and Mega relations, and rejection of
   any unlisted cross-revision substitution. Strict validation/diff tests also prove an unmodified
   retained schema-3 release still validates.
3. The Pokémon data coder builds the new release from the approved local snapshots, validates it,
   compares it against `showdown-multi-s3-i4-5073b2ab1402`, reviews the semantic inventory, and
   records the exact generated bundle ID and hash. Existing releases remain byte-for-byte intact.
4. After the data contract is stable, the backend coder adds nullable fields and migration,
   recognizes both retained schemas and the new schema/importer/source-shape tuple, requires Item
   descriptions only for the new schema, and loads them in the existing atomic transaction.
5. The backend coder advances the builder dataset to `team-builder-data-v3`, emits paired nullable
   Item details from the exact snapshot, and proves active and owner-authorized retained datasets,
   authorization, bounded queries, loading, activation, rollback, Mega relations, and team saving.
6. Once the backend JSON shape is fixed, the Web GUI coder updates the strict parser and reuses
   `FieldInformationControl` for Item. The Item field supplies the same description association
   and `Alt+I` behavior as Ability/Move; the Item modal renders only name and full description.
7. The deployment agent updates `deploy/pokemon-data.env` to the reviewed new bundle. No runtime
   activation occurs during implementation; production deployment remains an explicit later
   operation using existing load and activation commands.
8. Matching reviewers inspect their scopes, and the architect reviews schema/version alignment,
   exact-version behavior, old-version fallback, and end-to-end acceptance. Owners resolve every
   actionable finding and repeat review until no blockers remain.
9. The architect writes `docs/reports/2026-10-24-item-information.md`. The deployment agent runs
   final local validation and creates the cycle's local commit without any remote operation.

Steps 4 and 6 depend on the normalized and transport contracts respectively. Data tests may be
developed alongside backend migration scaffolding, but generated-release integration and Web
contract work must use the finalized preceding interface.

## Review and verification

### Pokémon data review

The `pokemon_data_reviewer` checks `data/text/items.ts` allow-listing, joins to effective legal
Items, revision scoping, exact text preservation, same-record fallback behavior and counts, source
markers, schema compatibility, provenance, hashes, deterministic generation, inventory counts,
semantic diffs, and unchanged retained releases. Tests explicitly cover present `desc`, missing or
blank `desc`, mandatory `shortDesc`, the exact six-member M-A compatibility set with both revision
pins, set/cardinality validation, each transition fixture, unchanged historical legality and Mega
relations, overlay semantic/provenance visibility, and rejection of every other cross-revision
substitution. Run and observe at minimum:

```text
python -m unittest discover -s src/data/tests
python -m src.data.importer validate src/data/releases/<new-bundle-id>
python -m src.data.importer compare \
  src/data/releases/showdown-multi-s3-i4-5073b2ab1402 \
  src/data/releases/<new-bundle-id>
```

### Backend review

The `backend_reviewer` checks migration safety, nullability limited to compatibility, strict
new-schema validation, atomic idempotent load/activation, exact-version serialization,
authorization, admin visibility, and query growth. Run through the configured backend project:

```text
uv --directory src/backend run ruff format --check .
uv --directory src/backend run ruff check .
uv --directory src/backend run mypy --config-file pyproject.toml .
uv --directory src/backend run python manage.py makemigrations --check
uv --directory src/backend run python manage.py check
uv --directory src/backend run pytest -c pyproject.toml
```

Database-backed checks use the repository's existing local Podman workflow and already-local
images; missing host tools are reported rather than installed.

### Web review

The `web_gui_reviewer` checks strict parsing, DOM ownership, Item control availability, tooltip and
dialog content, focus restoration, `Alt+I`, pointer/touch behavior, invalid/blank/legacy states,
responsive layout, themes, and regressions in Ability/Move controls and autocomplete. Run:

```text
npm --prefix src/web run check
npm --prefix src/web test
npm --prefix src/web run build
```

Run the existing Playwright team-builder suite in the repository's local review environment to
cover a described Item and a retained version with null descriptions. Confirm the dataset is
loaded once, opening Item information causes no request, and no unexpected console or page errors
occur.

### Integration and final validation

The architect checks that bundle schema/importer/source-shape constants, Django reader/model/load,
dataset schema, TypeScript parser, generated release, and deployment pin agree exactly. Before
review handoff and again before commit, run:

```text
.codex/lint.sh
```

The deployment agent then runs the complete repository validation appropriate to the affected
data, backend, Web, and deployment scopes, including the pinned-bundle deployment tests, before
staging and committing.

## Risks

- Showdown text and effective Item tables are separate, and a legal Item may be missing from its
  revision's text table. Fail closed with the regulation, revision, and Item identifier unless the
  target belongs to the exact six-member M-A overlay and all of its preconditions match; do not
  generalize the exception or hand-author text.
- A broad cross-revision fallback could silently detach text from regulation history. Keep the
  six-Item exception as a declarative exact set of transitions, pin both source and target
  revisions, validate set equality and cardinality, surface every member in provenance and semantic
  review, and reject unmatched, extra, missing, duplicate, or stale overlay input.
- Most pinned legal Items have no `desc`. The normalized source marker and per-regulation
  provenance counts prevent the approved `shortDesc` fallback from becoming an invisible or
  ambiguous transformation.
- A blank or absent `shortDesc` cannot support either user-visible field and fails validation. A
  blank or absent `desc` is not an error when the same revision's non-empty `shortDesc` supplies
  the full description.
- Non-null database fields would break retained loaded versions; unconstrained nullable fields
  would weaken new imports. The reader enforces the new-schema invariant while nulls remain a
  deliberate legacy representation.
- Changing Item objects without advancing the dataset schema could make old clients misinterpret
  the payload. Backend and Web advance to `team-builder-data-v3` together.
- Per-member Item lookup could create hidden query growth. Serialize the regulation's ItemProfile
  set once and reuse it across all member controls.
- Shared information-control changes can regress Ability/Move keyboard or focus behavior. Extend
  the discriminated union narrowly and rerun all existing information-control tests.
- A generated release or deployment pin mismatch could load the wrong contract. Review and test
  the exact bundle ID/hash and pin them in the same cycle commit.

## Completion criteria

- Every legal Item in the new bundle has non-empty, trimmed short and full descriptions from its
  regulation's exact pinned `data/text/items.ts`; full text uses non-empty `desc` when available or
  the same record's `shortDesc` otherwise. The six enumerated M-A Items are the sole exceptions and
  use text from the pinned current revision through the reviewed compatibility overlay. Source
  markers, overlay provenance, counts, and hashes are deterministic.
- Validation rejects missing or blank `shortDesc`, malformed text, invalid fallback/source-marker
  combinations, duplicates, every unlisted cross-version substitution, dangling records, stale or
  mismatched overlay inputs, an overlay set other than the exact six keys, an incorrect cardinality,
  or unprovenanced Item details. Comparison reports
  description/source-marker changes by regulation/Item key and exposes the overlay in semantic
  review.
- The M-A compatibility overlay records both exact revisions and, for each of its six enumerated
  targets, the key, rationale, date, exact transition, and regression fixture. It supplies text
  only and leaves historical M-A legality, identity, status, and Mega relationships unchanged.
- A newly generated immutable release validates, is semantically compared with the current pin,
  and is pinned for deployment without modifying any retained release.
- Django migrates additively, loads the new release atomically and idempotently, retains old rows,
  and supports explicit activation and rollback without upstream availability.
- Active and owner-authorized retained datasets use the requested exact version, perform no
  per-click or N+1 queries, and emit paired strings for new profiles or paired nulls for legacy
  profiles.
- A described selected Item exposes the accessible short tooltip and name/full-description modal;
  blank, invalid, unavailable, and legacy Items expose no information control.
- Focus restoration, `Alt+I`, mouse, keyboard, touch, light/dark themes, desktop/tablet/phone
  behavior, Ability/Move information, Item legality, Mega mapping, saving, and retained-team
  behavior pass their automated and representative browser checks.
- Pokémon data, backend, Web GUI, and architect reviews report no blocking findings; full local
  validation passes; the cycle report exists; and the deployment agent creates and reports the
  local commit without any remote operation.

# Pokédex data foundation

## Summary

Build the first of two Pokédex feature cycles: a reproducible, reviewable pipeline that extracts
the current Pokémon Champions VGC Regulation M-C and M-B data from the user-supplied local Pokémon
Showdown snapshot, derives static HOME sprites from the user-supplied local PokeAPI sprite
snapshot, loads an immutable normalized version into PostgreSQL, and activates it through one
atomic global pointer.

This cycle establishes data, provenance, validation, rollback, operator commands, and production
bootstrap behavior. It intentionally does not replace the authenticated landing page or deliver the
searchable Pokédex interface; that visible experience belongs to cycle two.

## Goals

- Import only from the clean local Pokémon Showdown repository at
  `references/pokemon-showdown`, pinned to commit
  `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640` from 2026-10-13.
- Resolve the effective `[Gen 9 Champions] VGC 2026 Reg M-C` and
  `[Gen 9 Champions] VGC 2026 Reg M-B` formats without network access, dependency installation, or
  a compiled Pokémon Showdown tree.
- Produce a deterministic, portable, human-reviewable release bundle containing both regulations
  and identified by its Showdown revision, bundle schema, importer identity, and content hash.
- Normalize stable identifiers and display names for regulations, forms, types, abilities, moves,
  legality, and full validator-legal learnsets, while preserving regulation-specific effective
  values.
- Represent ordinary and Mega forms independently, including multiple Mega forms and bidirectional
  base/Mega relationships.
- Persist immutable versions in PostgreSQL, retain prior versions, and keep activation separate,
  explicit, atomic, and reversible.
- Generate validation summaries and semantic diffs from the active version before activation.
- Encode each regulation-relevant normal and shiny PokeAPI HOME PNG as a static 384 by 384 WebP and
  commit only those derivatives, with complete input, tool, command, structural, and hash
  provenance in the manifest.
- Bootstrap the approved bundle idempotently in production only when no active Pokémon data
  version exists; never replace an existing active version during deployment.
- Preserve and test the exact level-50 Pokémon Champions stat semantics needed by cycle two.

## Non-goals

- The regulation selector, Pokémon list, search and filters, sorting, keyboard navigation, selected
  Pokémon pane, sprite controls, or move and ability detail pane.
- Any change to `/`, templates, CSS, Vite, Preact, TypeScript, or other files under `src/web`.
- A public or browser-facing Pokémon JSON API.
- Damage calculation, team building, journey logging, usage statistics, tiers as a user-facing
  concept, or mechanics beyond the data required by the agreed Pokédex.
- Serving source PNGs, animated sprites, back sprites, icons, trainers, artwork, or any sprite
  family other than the normal and shiny PokeAPI HOME sources and their static derivatives.
- Committing, copying into an image, or deploying the complete approximately 1.4 GB user-supplied
  sprite archive.
- Fetching Pokémon Showdown, sprites, packages, images, or other upstream content. No Git remote,
  registry, or operational-service access is permitted.
- Automatically activating later data updates, deleting superseded versions, or reversing schema
  migrations during application rollback.
- Claiming a sprite or trademark license that the user did not supply.

## User-visible behavior

There is no new browser-visible Pokédex behavior in this cycle. The existing authenticated landing
page remains unchanged.

Operators gain these management-command contracts:

```text
python manage.py build_pokemon_data \
  --showdown references/pokemon-showdown \
  --sprites references/sprites \
  --pokeapi references/pokeapi

python manage.py load_pokemon_data \
  src/data/releases/<version>/

python manage.py activate_pokemon_data <version>
```

- `build_pokemon_data` verifies the local source revision and source shape, builds into a temporary
  directory, validates the complete result, and only then publishes an immutable bundle under
  `src/data/releases`. Its final identifier includes the Showdown commit prefix, schema and importer
  versions, and a canonical content-hash prefix. Rebuilding identical inputs is byte-for-byte
  identical and reports the existing bundle rather than rewriting it.
- `load_pokemon_data` verifies the manifest, every declared hash, schema version, cross-reference,
  and validation result before changing PostgreSQL. It creates the immutable version and all child
  rows in one transaction, or recognizes an identical prior load as a no-op. The same identifier
  with different content is an error. It records and prints a deterministic summary and semantic
  diff against the version active at load time.
- `activate_pokemon_data` accepts only a completely loaded and validated version. In one database
  transaction it locks the singleton active pointer, changes that pointer, records the transition,
  and prints the old and new identifiers. Repeating activation of the current version is a clear
  no-op. Naming a prior retained version performs rollback through the same checks and operation.
- A deployment-only `--if-none` activation mode takes the same lock and activates the named version
  only when the pointer is empty. If a version is already active, it reports that fact and leaves it
  unchanged. This avoids a check-then-act race and is not the normal update workflow.
- All failures identify the affected file, record, relationship, or invariant, leave the previous
  active pointer and immutable versions untouched, and return a nonzero status.

## Decisions and assumptions

- The supplied local repositories are clean at these confirmed revisions:
  - Pokémon Showdown at `references/pokemon-showdown`, commit
    `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`;
  - PokeAPI sprites at `references/sprites`, commit
    `ba403973fdf9d0ac59175813861e6a1f8ed5020c`;
  - PokeAPI data at `references/pokeapi`, commit
    `81d20919845b6a445969b9265aab5cec6b04cece`.
  The build command verifies each local Git HEAD and clean tracked working tree, rejects another
  revision or tracked changes, and never invokes a remote Git operation.
- Node 26.7.0 is available. `node_modules` and `dist` are absent by design. The extractor may use
  Node's built-in TypeScript support and Python's standard library, but must not run package
  installation or assume compiled Showdown output. It loads only an audited allow-list of local
  format and data modules; it must not start the Showdown server.
- The extractor resolves the Showdown base data plus the `champions` and `championsregmb` mod
  inheritance and the two exact VGC formats. Unknown exports, executable data that cannot be safely
  represented, unexpected inheritance, unresolved rules, or changed source shapes fail with an
  actionable diagnostic rather than being skipped.
- Pokémon Showdown remains the sole upstream source for Pokémon identities, form relationships,
  effective regulation legality, types, base stats, abilities, learnsets, move metadata and flags,
  and descriptions. The PokeAPI data checkout may supply only the mapping from Showdown canonical
  form identity to PokeAPI sprite identifier and sprite provenance; it cannot override or fill a
  Pokémon fact. The importer does not infer Pokémon facts from sprite filenames.
- Stable canonical identifiers follow Showdown's normalized IDs and are stored separately from
  display names. A form identity is not collapsed into its base species. National Dex number is a
  required positive field for every selectable form and remains equal across related forms.
- The bundle includes the union of M-C and M-B legal selectable forms plus any base or Mega form
  required to make a legal form's toggle relationship complete. Regulation membership remains an
  explicit relation, so supporting counterparts need not appear in a regulation's future list.
- Regulation-scoped profiles preserve effective facts after mod inheritance. This avoids assuming
  that M-C and M-B give the same form, move, ability, or learnset identical metadata merely because
  their stable IDs match.
- Mega profiles use their own effective types, base stats, and abilities. Their regulation-specific
  learnset is the resolved full legal learnset of the corresponding base form. Multiple Megas point
  to the same base; every relation is traversable in both directions.
- Full legal learnsets contain every move accepted for that exact form by the effective format.
  Champions supplies flattened full entries and its `learnsetParent` behavior stops at an existing
  entry instead of traversing its pre-evolution. Therefore moves already present in a flattened
  entry have direct form resolution even when their game acquisition history may involve an earlier
  evolution; the importer must not infer acquisition provenance by comparing other tables. It
  follows a pre-evolution only when Showdown's resolver would actually do so after finding no form
  or changed-form entry. The pinned selected output truthfully has zero such traversals.
- Learnset provenance has three orthogonal parts. `form_resolution` is `direct`, `changed-form`,
  `base-to-mega`, or `pre-evolution`; `source_form_id` is the exact effective learnset-table entry
  whose keys supplied the move. `source_mod` is `base`, `champions`, or `championsregmb`.
  `source_kind` is target-mod-relative: `direct` when the target mod introduces the complete entry
  with no parent entry, `inherited` when the effective entry comes unchanged from its parent layer,
  or `override` when the target mod supplies a replacement for a parent entry. If an inherited entry
  delegates its learnset field to its parent, provenance follows the layer that supplied that field.
  Resolution rejects cycles and dangling references and excludes moves unavailable in the effective
  Champions format.
- Move data preserves display name, type, physical/special/status category, base power, accuracy
  including always-hit semantics, PP, priority, target, short and full effective descriptions, and
  every upstream flag as normalized flag identifiers and relations. Ability data preserves display
  name and effective short and full descriptions. Unknown flags fail schema validation so new
  upstream semantics require review.
- Types are ordered on each profile. Ability slots preserve Showdown slot identity, including
  hidden or special slots, rather than reducing abilities to an unordered string list.
- Each regulation names the `champions-level-50-v1` mechanics profile and preserves SP minimum `0`,
  SP maximum `32`, and level `50`. The shared exact-integer domain helper implements:
  - HP: `base + SP + 75`, with no nature modifier;
  - other stats: `base + SP + 20`, then truncate `value * 90 / 100` for a hindering nature or
    `value * 110 / 100` for an increasing nature.
- PostgreSQL is the only runtime canonical Pokémon-data store. Portable files are reviewed import
  artifacts and bootstrap inputs, not a runtime alternate database.
- A data version is immutable after load. The global active pointer is a dedicated singleton row,
  not a mutable flag duplicated across versions. Activation transitions are retained for audit;
  they do not modify imported rows.
- The bundle format is canonical UTF-8 JSON or JSON Lines with sorted keys, stable record order,
  final newlines, no volatile build timestamps, and SHA-256 hashes.
- PokeAPI sprites commit `ba403973fdf9d0ac59175813861e6a1f8ed5020c` is the sole sprite
  asset source. Normal input PNGs come from `sprites/pokemon/other/home/<id>.png` within that
  checkout; shiny input PNGs come from `sprites/pokemon/other/home/shiny/<id>.png`. PokeAPI data
  commit
  `81d20919845b6a445969b9265aab5cec6b04cece` may provide identifier mapping and provenance only.
  Sprite provenance is recorded separately from the Showdown MIT code notice and makes no
  unverified asset-license claim.
- Sprite lookup maps each Showdown canonical form ID through pinned PokeAPI CSV identities to one
  exact PokeAPI numeric Pokémon ID and then to the two fixed HOME paths. Fuzzy matching, National
  Dex-number filename fallback, filename suffix discovery, another PokeAPI sprite family, and a
  Showdown sprite fallback are forbidden. The verified source has 353 unique form mappings and both
  variants for every form: 353 normal plus 353 shiny files, or 706 files total. A missing,
  ambiguous, duplicate, or case-colliding mapping or source file fails the entire build.
- Every source must be a 512 by 512, 8-bit, RGBA, non-interlaced PNG. The importer validates those
  structural properties before conversion and fails on a malformed file or any property mismatch.
- Each source PNG is encoded directly as a static transparent 384 by 384 WebP with this exact
  argument order over stable staged paths:

  ```text
  cwebp input.png -resize 384 384 -q 82 -alpha_q 100 -m 6 -pass 10 \
    -sharp_yuv -metadata none -o output.webp
  ```

  The importer must use installed `cwebp` version 1.3.2 exactly, check its version before writing
  output, and fail rather than install a tool or accept a different version. It validates that the
  output is a static 384 by 384 WebP with alpha support and no retained metadata.
- For each normal and shiny derivative, the manifest records the PokeAPI sprite and mapping
  repository revisions, exact repository-relative input path, input PNG SHA-256, input width,
  height, bit depth, color type, and interlace mode, `cwebp` version, exact argument vector, output
  repository-relative path, output SHA-256, dimensions, alpha presence, animation absence, and
  metadata absence. The exact argument vector is recorded as an array, not a shell string. Each
  source is copied into a deterministic relative staging layout before tool execution, so recorded
  arguments and output bytes do not contain a run-specific temporary-directory prefix.
- The generated sprite subset and manifest are committed. The ignored `references` tree remains
  local-only. Previously activated committed release bundles are retained so database rollback does
  not refer to sprite assets removed from the application release.
- Manual corrections are optional overlays under `src/data/overrides`, never edits to generated
  records. Each overlay names the target upstream revision and record, rationale, authoring date,
  before/after values, and a regression fixture. Applied overlays are listed and hashed in the
  manifest and surfaced in validation and semantic diffs. No overlay is added without an observed
  source defect.

## Scope and ownership

### Pokémon data coder

Own only `src/data`, including:

- `src/data/importer/**` for the dependency-free local Showdown extractor, inheritance and legality
  resolution, normalization, sprite selection, hashing, validation, and semantic bundle comparison;
- `src/data/schema/**` for the versioned portable-bundle contract and supported source-shape
  contract;
- `src/data/fixtures/**` and `src/data/tests/**` for focused upstream-shaped fixtures, golden
  records, invalid inputs, deterministic builds, PokeAPI mapping, and PNG conversion cases;
- `src/data/overrides/**` for the documented overlay schema and any evidence-backed overlay;
- `src/data/releases/<version>/**` for the reviewed M-C/M-B records, validation summary, manifest,
  applicable Showdown code notice, sprite provenance, and derived static WebPs;
- `src/data/README.md` for local build inputs, reproducibility, provenance, and bundle review.

This owner publishes the exact bundle schema and canonical-hashing rules to the backend coder. It
does not edit Django models or commands, deployment files, templates, or CSS.

### Backend coder

Own only `src/backend`, including:

- `bagredex/pokemon_data/**` for Django models, migrations, typed bundle reader, transactional load
  and activation services, exact Champions stat arithmetic, admin read-only inspection where useful,
  and the three management commands;
- `tests/**` for schema-consumer, persistence, command, constraint, idempotency, concurrency,
  activation, rollback, semantic-diff, and stat golden tests;
- project settings or `pyproject.toml` only if needed to register the Django app or expose the local
  management commands. No third-party import dependency is planned.

`build_pokemon_data` is a thin Django command adapter over the executable importer interface owned
under `src/data`; extraction and normalization policy must not be duplicated in the backend. The
backend owner does not edit generated bundles, sprites, deployment automation, or Web GUI files.

### Deployment agent

Own `deploy/**`, deployment-facing portions of `README.md`, final local validation, and all local
Git mutations. Expected work includes:

- copying the approved `src/data/releases` content required for load and later sprite serving into
  the application image without copying `references`;
- running `load_pokemon_data` after migrations and before release switch, then running
  `activate_pokemon_data <version> --if-none` in the same pre-switch phase;
- proving load or first activation failure prevents the release switch, while an existing active
  version is never auto-switched;
- documenting the build, load, explicit activation, rollback, first-bootstrap, retained-version,
  and no-automatic-update procedures;
- extending deterministic shell and Containerfile tests without executing a remote, registry, or
  production operation.

Deployment must refer to one explicit approved bundle identifier in release-controlled
configuration, not choose the lexically newest directory. It must not edit backend or data-pipeline
files, remove old database rows, remove previously activated bundles, or deploy `references`.

### Reviewers and architect

- `pokemon_data_reviewer` reviews `src/data` and its consumer contract without editing, emphasizing
  source fidelity, provenance, inheritance, legality, form identity, sprite mapping, overrides,
  validation, and determinism.
- `backend_reviewer` reviews `src/backend` without editing, emphasizing constraints, migration
  safety, immutable loading, transaction boundaries, locking, command behavior, integer arithmetic,
  query readiness for cycle two, and failure atomicity.
- The architect reviews the approved plan, complete local diff, both reviewer results, deployment
  changes, and observed checks for cross-scope schema, identifier, version, bootstrap, rollback, and
  sprite-retention consistency.
- No Web GUI coder or reviewer participates because `src/web` must not change.
- After all blocking findings are resolved, the architect owns
  `docs/reports/2026-10-15-pokedex-data-foundation.md`. The deployment agent owns final checks,
  staging, and one or more justified local commits.

## Data and interface impact

### Portable bundle

The bundle manifest is the authoritative interchange contract. It records:

- bundle identifier and canonical bundle hash;
- full Showdown, PokeAPI sprites, and PokeAPI mapping commits; local clean-tree assertions;
  Showdown commit date; source-shape version; importer version; and bundle schema version;
- both exact format names, Showdown format IDs, mod IDs, and mechanics-profile ID;
- deterministic counts by entity, regulation, relation, move flag, and sprite variant;
- every data file and derived static WebP path, byte size, and SHA-256 hash;
- the PokeAPI HOME sprite family, PokeAPI mapping rule version, installed `cwebp` version, exact
  encoding rule, and an explicit `license-not-supplied` marker;
- each sprite variant's exact input PNG path, hash, dimensions, bit depth, color type, and interlace
  mode, plus its exact `cwebp` argument array and 384 by 384 output WebP path, hash, dimensions,
  alpha, animation, and metadata properties;
- applied overlay identifiers and hashes, or an explicit empty list;
- validation status and validation-summary hash.

The normalized records contain stable identity tables and regulation-scoped effective profiles:

- regulations and mechanics profiles;
- Pokémon forms, display names, National Dex numbers, base-form identity, and form labels;
- regulation/form membership with six base stats and derived BST;
- ordered types and slotted abilities per regulation/form profile;
- base-to-Mega relations, including one-to-many relations;
- abilities and regulation-effective descriptions;
- moves, regulation-effective metadata and descriptions, move flags, and move/flag relations;
- regulation/form/move legal-learnset relations with `form_resolution`, `source_form_id`,
  `source_mod`, and `source_kind`; these distinguish form fallback from mod-layer origin without
  inventing acquisition history;
- normal and shiny sprite logical paths and hashes for every included form.

The validation summary is deterministic and includes source and output counts, ignored source
categories with reasons, legality totals by regulation, relationship and learnset coverage,
learnset counts by each provenance dimension, sprite coverage, overlays, warnings, and errors. For
this pinned bundle it explicitly reports zero `pre-evolution` form-resolution rows rather than
manufacturing them. Warnings cannot stand in for violated required invariants.

### PostgreSQL model

The backend migration adds an isolated `pokemon_data` app with the equivalent normalized model:

- immutable `DataVersion` provenance, hashes, schema/importer versions, validation summary, load
  status, and the semantic diff observed at load;
- `ActiveDataVersion`, constrained to the singleton key, with a nullable version only before first
  activation;
- append-only `DataActivation` audit rows containing previous version, new version, and timestamp;
- version-owned stable identities for `Regulation`, `MechanicsProfile`, `PokemonForm`, `Type`,
  `Ability`, `Move`, and `MoveFlag`;
- version- and regulation-scoped profile and join tables for legality, stats, ordered types, slotted
  abilities, legal moves, move metadata, descriptions, flags, Mega relationships, and sprites.

Database constraints enforce version-local references; unique stable IDs per version; one profile
per regulation/form; six bounded nonnegative base stats; stored BST equal to the six-stat sum in the
load service and protected by tests; type positions; ability slots; one relation per form/move;
normal and shiny sprite uniqueness; base and Mega forms being distinct; matching National Dex
numbers for Mega relations; and no cross-version joins. Indexes support the next cycle's regulation
form list, National Dex ordering, stat sorting, and AND-filter joins by type, ability, and move
without encoding presentation behavior in the model.

Imported entities and relationships are never updated or deleted after a version reaches loaded
state. A failed load rolls back all rows for the candidate. The active pointer and activation audit
are the only normal mutable data in this app.

### Compatibility and deployment

The schema migration is additive and the current application ignores the new tables. Applying it
before release switch remains compatible with the prior application image. Database rollback does
not reverse the migration.

The application image contains reviewed bundle data needed by the commands. It does not contain the
Showdown checkout or full sprite archive. The data release directories remain versioned and
immutable. Cycle two will define the final browser asset-serving route; this cycle must retain
logical sprite paths and package the files without changing current Nginx routes.

Production release order becomes: start and verify PostgreSQL, apply migrations, validate and load
the explicit approved bundle, atomically activate it only if the active pointer is empty, then
continue the existing server switch and health checks. If loading or initial activation fails, the
new release is not switched into service. If later health checks fail after a first activation, the
application release rolls back while the valid data pointer may remain; the preceding application
is compatible because the migration is additive. The retry is idempotent.

## Implementation sequence

1. Pokémon data coder defines the versioned portable schema, canonical serialization and hashing,
   source-shape assertions, overlay contract, and fixture corpus. Publish those interfaces before
   backend persistence work begins.
2. Pokémon data coder implements the allow-listed local extraction boundary for the exact formats
   and their inherited data. Resolve stable IDs, legality, form profiles, Mega relationships, full
   legal learnsets, their orthogonal form and mod-layer provenance, descriptions, move metadata, and
   every move flag. Preserve source layer before effective-table merging. Unknown source structure
   or unresolved semantics must stop the build.
3. Pokémon data coder implements deterministic Showdown-to-PokeAPI numeric ID mapping, HOME path
   resolution, PNG structural validation, direct `cwebp` resizing and encoding, and bundle
   validation. Exercise normal and shiny HOME sources, multiple Mega forms, punctuation and form
   mappings, missing variants, ambiguous or duplicate mappings, duplicate or case-colliding paths,
   malformed or structurally invalid PNG input, tool-version mismatch, and unexpected output
   alpha, animation, metadata, or dimensions.
4. Pokémon data coder runs the importer against all three confirmed repositories and installed
   `cwebp`, reviews the deterministic summary, and commits only the resulting minimal bundle
   under `src/data`. Re-run into two temporary directories and compare every byte and path before
   handing off.
5. Once the bundle schema is fixed, backend coder adds the `pokemon_data` Django app, additive
   migration, constraints, indexes, typed bundle reader, and exact Champions stat helper. Backend
   model names may follow repository conventions, but must preserve every contract above without
   flattening regulation-scoped effective data.
6. Backend coder implements transactional idempotent load and semantic diff. The loader rechecks
   all hashes and invariants, bulk-loads only after validation, compares candidate records to the
   locked current active version by stable keys, stores added/removed/changed counts and record-level
   review details, and leaves no partial candidate on failure.
7. Backend coder implements activation and rollback with `transaction.atomic()` plus row locking on
   the singleton pointer. Add the race-safe deployment-only `--if-none` behavior and append-only
   transition audit. Expose build as a thin adapter to the data-owned importer.
8. Pokémon data reviewer and backend reviewer inspect their completed scopes. Return each actionable
   finding to its owner and repeat the matching review until neither scope has a blocker.
9. After command paths and the approved bundle ID are stable, deployment agent packages the bundles,
   adds the pre-switch idempotent load and first-activation steps, updates deployment tests and
   operator documentation, and proves existing active data cannot be automatically replaced.
10. Architect performs integration review over the complete diff and reviewer results. Resolve all
    bundle/model, version, sprite, command, transaction, migration, release-order, and rollback
    inconsistencies; repeat affected reviews after fixes.
11. Architect writes the cycle report. Deployment agent runs final checks, inspects the complete and
    staged diffs, stages only this cycle, and creates one or more coherent local commits without any
    remote Git operation.

Steps 2 and 3 may proceed in parallel only after the schema and canonical form-to-sprite input
contract are fixed. Backend schema work may overlap final bundle generation after the interchange
schema is frozen. Deployment work waits for stable management-command and bundle-ID contracts.

## Review and verification

### Data pipeline

The Pokémon data owner and reviewer must run and observe:

- unit and schema tests using the repository's available Python and Node runtimes, without npm,
  network access, or the Showdown build;
- a build from all three clean local pinned commits into a temporary directory using the observed
  `cwebp` version 1.3.2;
- a second independent build with byte-for-byte path, JSON, manifest, report, and static WebP hash
  equality;
- a rebuild against the committed output that reports an identical no-op;
- rejection of the wrong revision or dirty tracked tree for any of the three repositories, a
  missing Showdown module, changed export/source shape, unresolved inheritance, dangling ID,
  duplicate stable ID, inheritance cycle, unknown move flag, malformed overlay, and schema mismatch;
- golden legality coverage for both M-C and M-B, including a form legal in M-C but illegal in M-B;
- golden form coverage for a regional form, a gender or special selectable form where present, a
  single-Mega species, and a species with two Megas such as Charizard;
- real-bundle learnset goldens for direct form resolution, a changed-form fallback, a Mega receiving
  its base form's full resolved legal learnset, an ordinary M-B entry inherited from `champions`,
  and the Archaludon M-B `championsregmb` override;
- explicit real-bundle assertion that `pre-evolution` form-resolution count is zero, plus a
  synthetic source-shaped fixture proving the resolver and cycle protection follow a pre-evolution
  only when no effective form or changed-form entry exists;
- schema and validator assertions that each learnset row has one valid `form_resolution`, exact
  `source_form_id`, `source_mod`, and target-relative `source_kind`, with no legacy ambiguous
  `provenance` field retained;
- golden metadata for physical, special, status, always-hit, priority, and multi-flag moves, plus an
  ability with effective Champions text;
- exact National Dex, ordered type, six-stat, BST, ability-slot, relationship, and description
  assertions for representative records;
- normal and shiny HOME sprite coverage for all 353 included forms, exactly 353 unique strict
  Showdown-to-PokeAPI ID mappings and 706 unique source paths, and unconditional failure when either
  source variant or an unambiguous mapping is missing;
- source validation goldens proving every input is a 512 by 512, 8-bit, RGBA, non-interlaced PNG,
  plus rejection of malformed input or any structural mismatch;
- direct encoding goldens proving a static transparent 384 by 384 WebP using the exact
  ordered `cwebp` arguments for quality 82, alpha quality 100, method 6, ten passes, sharp YUV, and
  metadata removal; deterministic output hashes; and rejection of unavailable or non-1.3.2
  `cwebp`, malformed input, animated output, wrong dimensions, retained metadata, or changed output
  hash;
- manifest verification for all three full source revisions, input paths, input and output hashes,
  PNG and WebP structural properties, exact `cwebp` version and argument arrays, schema/importer
  identity, sprite provenance, license marker, applicable Showdown notice, and overlay list.

Generated output review must inspect the human-readable counts and a semantic comparison between
M-C and M-B, not only assert that files exist. Unexpected mass additions, removals, empty learnsets,
or missing relation categories are blockers.

### Backend and PostgreSQL

Backend verification runs through uv against PostgreSQL and includes:

- Ruff format and lint, strict mypy, the complete pytest suite, and focused `pokemon_data` tests;
- `manage.py check` under local settings and `check --deploy --fail-level WARNING` with complete
  placeholder production variables;
- `manage.py makemigrations --check --dry-run`, migration from an empty database, and migration over
  the current schema with existing account data preserved;
- successful bundle validation and load, exact persisted counts, query reconstruction of golden
  records, and absence of runtime reads from `references` or upstream source files;
- rejection of a modified static WebP, modified JSON record, wrong manifest hash, unsupported
  schema or importer identity, incomplete validation, invalid cross-reference, and reused
  identifier with different content;
- transaction rollback after failures early, midway, and at the end of load, proving no partial
  version or child rows remain;
- idempotent repeated load with no duplicated or updated entities;
- semantic diff coverage for no active version, identical candidate, and representative added,
  removed, and changed forms, legality, stats, abilities, moves, flags, learnsets, relationships,
  sprites, and overlays;
- activation refusal for missing, loading, invalid, or hash-mismatched versions; successful atomic
  activation; repeat no-op; rollback to a prior version; retained prior rows; and accurate audit;
- concurrent activation and concurrent `--if-none` tests proving locking, one coherent winner, no
  cross-version state, and no lost audit transition;
- database constraint tests for uniqueness, singleton pointer, version locality, ordering, stat
  bounds, relationship integrity, and required sprite variants;
- stat goldens for HP and every non-HP nature branch at SP 0 and 32, including values where integer
  truncation is observable and rejection outside the 0-32 SP range.

Management-command tests cover help and argument validation, exit statuses, diagnostics, printed
old/new identifiers, active-diff summary, build adapter argument fidelity, and paths containing
spaces. They must not hide errors from the data-owned importer.

### Deployment and final checks

Deployment verification includes:

- Containerfile assertions that the approved bundle and selected sprites are present and
  `references`, all other sprite families, and local source snapshots are absent;
- `bash -n`, ShellCheck, and the existing Bats suites plus focused release-worker tests;
- stubbed release tests proving migration precedes load, load precedes `--if-none` activation,
  activation precedes release switch, and a load or activation failure prevents that switch;
- first deployment, retry after partial deployment, repeated deployment with the same bundle, and
  deployment with a different existing active version, proving only the empty pointer is automated;
- application rollback tests proving database versions and the active pointer are not deleted or
  reversed and retained bundle assets remain packaged;
- resolved local and production Compose configuration and an application-image build only if all
  required images and dependencies are already local. Agents never pull to make checks pass;
- `.codex/lint.sh`, `git diff --check`, complete-diff inspection, staged-diff inspection, and a clean
  status after the deployment agent's local commit.

No check may be reported as passing unless it ran and its result was observed. Missing tools,
uncached images, permissions, or environment limitations are reported exactly; agents do not
install, download, contact an operational service, or weaken a check.

## Risks

- Showdown's effective format and mod behavior is richer than static object copying. The importer
  mitigates silent drift with an allow-listed source boundary, explicit inheritance and legality
  resolution, structural assertions, representative goldens, and fail-closed unknown handling.
- Source modules may contain executable callbacks that cannot be serialized. The bundle stores only
  agreed Pokédex facts and mechanics profile identifiers; encountering a callback that affects
  those facts blocks import until its semantics are deliberately implemented and tested.
- Showdown canonical form IDs and PokeAPI numeric IDs are separate identity systems. The pinned CSV
  join, exact 353-row bijection, collision checks, and complete 706-file dual-variant coverage
  prevent fuzzy or silent mismatches.
- Deterministic output depends on the exact encoder implementation and argument order. Pinning
  `cwebp` 1.3.2, recording its ordered argument vector, hashing inputs and outputs, and failing on a
  version mismatch prevent an unnoticed encoder change from altering committed assets.
- Asset rights are not established by Showdown's code license or by using PokeAPI's identifier
  mapping. Separate PokeAPI sprite provenance and the explicit license marker avoid overstating
  rights, but the user remains responsible for production use of the supplied sprite assets.
- Full learnset materialization creates many join rows. Bulk transactional loading and indexes are
  needed, but correctness and reviewability take priority over premature denormalization. Cycle two
  must measure actual list/filter query plans.
- Keeping prior versions and sprite subsets consumes increasing storage. This is required for safe
  rollback; retention or archival policy is a separate explicitly planned feature.
- A valid first activation can remain after a later application health failure. This is safe because
  migrations are additive and the prior app ignores the new data, but deployment tests and operator
  documentation must make the behavior clear.
- The ignored reference trees are not production inputs. A clean checkout can run and serve already
  committed bundles, but cannot rebuild them until the user supplies local sources again.

## Completion criteria

- A deterministic reviewed bundle records Showdown commit
  `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`, PokeAPI sprites commit
  `ba403973fdf9d0ac59175813861e6a1f8ed5020c`, and PokeAPI mapping commit
  `81d20919845b6a445969b9265aab5cec6b04cece`. It contains both exact VGC M-C and M-B formats, all
  agreed normalized data, complete base/Mega relations and legal learnsets, and both required
  static 384 by 384 WebP variants with provenance and hashes.
- Two clean builds from the same inputs with `cwebp` 1.3.2 are byte-for-byte identical. Every
  specified malformed, structurally invalid, missing, drifted, ambiguous, or tool-version-mismatched
  input fails closed with useful diagnostics, and no sprite-family fallback occurs.
- PostgreSQL can load the bundle atomically and idempotently, reconstruct golden records, retain
  immutable prior versions, produce a semantic diff from active data, and reject corrupt or
  incompatible bundles without partial state.
- Explicit activation and rollback atomically move one global pointer, record accurate transitions,
  and remain correct under concurrency. Deployment-only activation changes only an empty pointer.
- The stat mechanics profile and exact integer calculator pass all level-50, nature, truncation, and
  SP-boundary goldens.
- Production packaging excludes `references` and the full sprite archive; release automation loads
  before switch, bootstraps only an empty database, and never auto-replaces active data.
- Existing authentication, landing page, health, migration, and deployment behavior remains valid,
  and no file under `src/web` changes.
- Pokémon data, backend, deployment, and architect reviews have no unresolved blocking findings.
- Required lint, type, schema, test, migration, determinism, shell, deployment, and safe available
  container checks pass or a concrete environment limitation is accurately recorded.
- The cycle report records the delivered foundation, review iterations, observed checks, residual
  risks, and the intentional cycle-two UI deferral. The deployment agent creates and reports the
  local cycle commit or commits without any Git remote operation.

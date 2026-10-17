# Regulation M-A and global selector

## Summary

Complete the available Pokémon Champions regulation set by adding Regulation M-A from the exact
historical tree already present in the user-supplied local Pokémon Showdown checkout. Publish and
activate a new immutable Bagredex data release containing M-A, M-B, and M-C, while retaining the
existing releases for rollback.

Move regulation selection out of the Pokédex title and into the authenticated global header. The
selection remains URL-scoped: M-C is the default whenever the current URL has no `regulation`
parameter, and no cookie, session, local storage, or other persistence is introduced.

## Goals

- Import Regulation M-A from Pokémon Showdown commit
  `b555f4d8c` (the initial Champions implementation) using only the existing local object database
  at `references/pokemon-showdown`.
- Continue importing M-B and M-C from the checkout's current pinned commit
  `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`.
- Produce one deterministic, validated release containing canonical regulation identifiers `m-a`,
  `m-b`, and `m-c`, with exact per-regulation source provenance.
- Preserve prior loaded and committed releases and make the new provenance contract compatible
  with explicit load, activation, rollback, and production bootstrap behavior.
- Make M-C the default on every request that omits `regulation`; an explicit `?regulation=m-a` or
  `?regulation=m-b` affects only that URL.
- Render the regulation selector in the authenticated site header, outside the Pokédex Preact
  root, with options labelled `Regulation M-C`, `Regulation M-B`, and `Regulation M-A`.
- Remove the selector and its space from the Pokédex title area while preserving an accessible
  label for the header control without a separate visible top label.

## Non-goals

- Persisting a regulation in a cookie, Django session, database preference, local storage, or
  browser history state beyond ordinary URL navigation.
- Automatically carrying a selected regulation into links that omit the query parameter. Such a
  destination defaults to M-C.
- Changing regulation legality, mechanics, or descriptions by hand, or combining M-A rules with
  facts from a different Showdown revision.
- Fetching, pulling, installing, or otherwise obtaining upstream content. No Git remote operation,
  registry access, or operational external service is permitted.
- Adding another client framework, global state library, API framework, or frontend dependency.
- Changing the Pokédex search, filtering, sorting, detail, sprite, or damage/stat behavior except
  where three-regulation coverage and the relocated selector require it.
- Deleting old bundles, loaded data versions, or sprite assets.

## User-visible behavior

- An authenticated request to `/` with no `regulation` parameter renders Regulation M-C.
- `/` with exactly one supported value, `m-c`, `m-b`, or `m-a`, renders that regulation. Unknown,
  empty, or duplicate regulation values retain the existing explicit invalid-request behavior.
- The authenticated site header contains one native select control. Its visible option text is,
  in newest-first order, `Regulation M-C`, `Regulation M-B`, and `Regulation M-A`; there is no
  separate visible `Regulation` label above it.
- The select has an accessible name of `Regulation`, keyboard focus styling, and a non-JavaScript
  submission path. Progressive enhancement may submit immediately on change, but the server-side
  GET form remains usable without JavaScript.
- Choosing a value reloads the current canonical page with exactly one `regulation` query
  parameter. The choice is not stored. Visiting or following a URL without that parameter returns
  to M-C.
- The Pokédex title contains the title and result metadata but no regulation selector. Loading,
  unavailable, and ready states do not duplicate the selector inside the Preact root.
- M-A supports the same regulation-scoped Pokédex list, search, filters, details, Mega relations,
  moves, abilities, stats, sprites, stale-version handling, and authenticated data endpoints as
  M-B and M-C.

## Decisions and assumptions

- Discovery is complete and no material product question remains. The default is M-C and URL
  omission deliberately resets to that default.
- The user-supplied checkout is at current commit
  `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`, and its local history contains commit `b555f4d8c`.
  Implementation must resolve and verify the full historical commit ID before publishing a bundle;
  abbreviated IDs are for display only.
- M-A is extracted from the complete tree at `b555f4d8c`, including its base data, Champions mod,
  text, and exact `[Gen 9 Champions] VGC 2026 Reg M-A` format. It must not be reconstructed by
  applying old format files to the current M-B/M-C tree.
- The importer may read the supplied repository's local Git object database through deterministic,
  read-only commands and stage the required committed files in a temporary directory. It verifies
  both pinned commits and rejects a missing object, unexpected source shape, uncommitted current
  tree changes, submodule or path escape, or mismatched commit metadata. It never checks out,
  switches, fetches, or mutates the source repository.
- M-B and M-C retain their current exact source revision and semantics. M-A records carry their
  historical revision explicitly. Source counts and semantic summaries are separated by revision
  and regulation so provenance cannot imply that all three came from one tree.
- The portable contract advances to a new schema/importer/source-shape combination because the
  existing manifest, provenance, validation, identifier, and strict backend reader encode one
  Showdown revision. The new bundle identifier deterministically represents the multi-revision
  source set and content hash; it must not misleadingly name only the current revision.
- The new reader accepts the new contract and continues accepting both retained schema-1 bundles
  by their exact pinned identifiers and hashes. No existing immutable bundle is rewritten. The
  database already stores manifest and provenance as JSON, so a migration is expected only if
  implementation demonstrates a relational constraint that cannot represent the new contract.
- Shared identities are the union required by all three regulations and their Mega relationship
  closure. Regulation-effective profiles, ability text, move metadata, flags, and learnsets come
  from that regulation's source tree. Global identity fields must merge deterministically; an
  incompatible canonical ID, form relationship, or display identity across revisions fails the
  build with a focused diagnostic rather than silently preferring one revision.
- Sprite mapping and conversion continue using the already pinned PokeAPI mapping and sprite
  snapshots. The new release contains the union needed by all three regulations. Existing exact
  mapping, image validation, conversion, hash, and asset-provenance rules remain unchanged.
- All three regulations use the existing `champions-level-50-v1` mechanics profile unless the
  historical source proves a different supported contract; an inconsistency is a blocking data
  finding, not an inferred override.
- Regulation resolution is authoritative in Django and shared by page bootstrap and the global
  header context. The Preact application consumes the resolved bootstrap but no longer owns or
  renders the selector.
- Header selection uses an ordinary GET form with a visually hidden label and a no-JavaScript
  submit control. A small dependency-free enhancement owned by `src/web` may submit on `change`
  and hide only the redundant submit control after initialization. It must not mutate the Pokédex
  Preact root.
- The selector appears only for authenticated users and only when an active data version supplies
  the supported regulations. An unavailable active dataset keeps the existing clear unavailable
  state and must not present choices that cannot work.

## Scope and ownership

### Pokémon data coder

Own only `src/data`:

- Extend `src/data/importer/**` to verify and materialize the two pinned local Showdown trees,
  extract M-A independently, combine all three regulation datasets deterministically, and fail
  closed on cross-revision identity conflicts.
- Version `src/data/schema/**` for multi-revision source shape, manifest, provenance, validation,
  and canonical bundle identification while retaining validation of the two exact old releases.
- Extend `src/data/fixtures/**` and `src/data/tests/**` for missing historical objects, wrong commit
  trees, historical-tree isolation, three-regulation legality, provenance, union closure, conflict
  rejection, determinism, comparison, and retained-release validation.
- Generate and review the new immutable release under `src/data/releases/<new-bundle-id>/**`,
  including three-regulation records, union sprites, validation, semantic diff, source-specific
  provenance, hashes, and the applicable Pokémon Showdown notice.
- Update `src/data/README.md` with the exact local-history inputs, reproducible build and validation
  commands, identifier semantics, provenance layout, and no-network constraint.

This owner publishes the complete schema and representative records to the backend coder before
backend contract work begins. It does not edit Django, templates, CSS, deployment files, or Git
state.

### Backend coder

Own only `src/backend`:

- Extend the strict bundle reader and tests to accept the new versioned multi-revision contract,
  exact new release, M-A source-mod values, counts, hashes, and provenance while continuing to
  accept both retained releases unchanged.
- Prove that loading the new bundle remains transactional and idempotent, activation remains
  explicit and atomic, rollback to a retained version remains possible, and activating an old
  bundle makes M-A unavailable without corrupting M-B/M-C behavior.
- Centralize supported regulation order and request resolution as M-C, M-B, M-A, with M-C as the
  omission default, and expose server-rendered header choices and same-page URLs through validated
  context rather than frontend-owned policy.
- Extend page and JSON endpoint coverage for M-A, default M-C, explicit non-default URLs, duplicate
  and unknown values, active-version changes, unavailable regulations, and three-regulation
  contract serialization.
- Keep the existing authenticated, GET-only, ETag, stale-version, and immutable snapshot
  boundaries. Do not add a general API framework or persistence mechanism.

The backend owner does not edit generated data, Web GUI files, or deployment configuration.

### Web GUI coder

Own only `src/web`:

- Render the accessible regulation GET form in `templates/base.html`'s authenticated header using
  backend-provided values, explicit option labels, a visually hidden `Regulation` label, and a
  progressive no-JavaScript submission path.
- Remove the selector from every loading and ready Pokédex branch in `templates/home.html` and the
  Preact application, then simplify bootstrap types and tests only as required by the new ownership
  boundary.
- Add a small dependency-free site enhancement if needed for change-to-submit behavior, without
  crossing the Preact root boundary or adding packages.
- Update plain site and Pokédex CSS for desktop, tablet, phone, light/dark themes, focus, long option
  labels, account controls, and the reclaimed Pokédex title space.
- Extend component and Playwright coverage for one header selector, M-A navigation, default reset
  on a URL without the parameter, keyboard use, accessible naming, no duplicated visible label,
  unavailable state, and responsive header layout.

The Web GUI owner does not edit Django resolution policy, data files, or deployment files.

### Deployment agent

Own only `deploy/**`, deployment-facing root documentation or scripts, final validation, and all
local Git mutations:

- After the exact new bundle ID is published and reviewed, update the deployment pin and its tests
  so new environments load and `--if-none` activate that release.
- Preserve the rule that existing active environments are never silently switched. Document and
  validate the explicit activation command required to expose M-A on an existing installation and
  the retained-release rollback command.
- Confirm the application image contains the new and retained release artifacts but no local
  `references` checkout or materialized historical source tree.
- Run the final repository and authorized local Bagredex Podman checks, stage the complete reviewed
  cycle, and create one or more justified local commits. Do not perform a Git remote operation.

### Architect and reviewers

- The architect owns this plan, contract resolution, cross-scope integration review, any approved
  focused deferral under `docs/tasks`, and the final report at
  `docs/reports/2026-10-16-regulation-ma-global-selector.md`.
- `pokemon_data_reviewer` reviews `src/data` and the backend consumer interface without editing,
  emphasizing exact historical-tree fidelity, provenance, deterministic combination, legality,
  source-mod semantics, sprite union, old-release compatibility, and reviewable diffs.
- `backend_reviewer` reviews `src/backend` without editing, emphasizing strict contract validation,
  load/activation/rollback safety, allow-listing, default resolution, context behavior, request
  validation, query bounds, and test coverage.
- `web_gui_reviewer` reviews `src/web` without editing, emphasizing semantic header ownership,
  progressive enhancement, no selector duplication, keyboard and screen-reader behavior,
  responsive layout, Preact boundaries, and URL-only state.
- After owner fixes and reviewer rechecks leave no blockers, the architect reviews the approved
  plan, complete diff, reviewer findings, data artifacts, and observed checks for cross-scope
  consistency.

## Data and interface impact

- The release adds `m-a` to `regulations.json` and regulation-scoped memberships, profiles,
  abilities, moves, flags, learnsets, and validation counts. Forms, Mega relations, sprite mappings,
  and sprites expand only where the three-regulation union requires it.
- Manifest and provenance contracts change from one Showdown source object to an ordered,
  regulation-addressable source set containing the full resolved revisions and commit dates for
  M-A and M-B/M-C. Validation records counts and coverage per source and per regulation.
- Learnset provenance must identify the historical M-A source without pretending it is current
  `champions` data. Any new `source_mod` encoding is versioned and accepted end to end by schemas,
  importer, backend reader, model choices if necessary, semantic inventory, and tests.
- The new bundle is loaded as another immutable `DataVersion`; the active pointer and prior rows
  remain intact. Activation changes the whole coherent three-regulation snapshot, never individual
  regulations.
- The server-rendered header context gains the selected regulation and ordered choices with
  same-page URLs. It contains no user preference and derives its value solely from the validated
  current request and active version.
- The page bootstrap retains the selected regulation and regulation-scoped endpoint URLs needed by
  the Pokédex island. Selector-specific choice data may move out of the Preact contract once the
  header is server-owned; backend and TypeScript contract fixtures must change together.
- URLs and JSON endpoint paths remain backward compatible. `m-a` becomes an additional allow-listed
  value. M-C remains first/default, so old URLs without a query keep their behavior.
- Deployment pins the exact new content-addressed release. Retained bundles remain packaged and
  loadable; rolling back to one naturally removes M-A from the active snapshot and header choices.

## Implementation sequence

1. The Pokémon data coder resolves the full `b555f4d8c` object ID and commit date locally, captures
   source-shape evidence, defines the versioned multi-source contract, and shares it with the
   backend coder. Stop for architect resolution if the historical object or exact format is absent.
2. The Pokémon data coder implements isolated historical-tree extraction, three-regulation
   normalization, provenance, validation, deterministic combination, and focused tests. Generate
   the candidate release only after tests pass; validate it and compare it semantically with the
   active M-B/M-C release.
3. After the schema is fixed, the backend coder updates strict reading/loading compatibility and
   proves new-load, activation, and old-release rollback behavior. In parallel, the backend coder
   may implement shared M-C/M-B/M-A request/header context once canonical IDs and order are fixed.
4. After the backend header context contract is published, the Web GUI coder moves the selector to
   the base header, removes all Pokédex-owned selector markup/state, and updates responsive,
   accessibility, component, and browser tests.
5. The deployment agent updates the exact bundle pin only after data and backend reviews accept the
   generated identifier. Deployment changes must not race candidate bundle regeneration.
6. Run the matching data, backend, and Web GUI reviews. Return every actionable finding to its
   exclusive owner and repeat focused checks and review until no blocker remains.
7. The architect performs integration review across provenance, bundle-reader compatibility,
   active-version behavior, context/bootstrap contracts, header ownership, URL defaults, deployment
   pinning, and observed end-to-end coverage.
8. The architect writes the concise cycle report. The deployment agent runs final checks, stages
   only the reviewed cycle, and creates the local commit or commits.

## Review and verification

### Data checks

- Run the focused `src/data` test suite, including deterministic rebuilds from the same local object
  database and negative cases for absent/wrong historical objects and mixed-tree extraction.
- Build the release twice and prove byte-for-byte identity or recognition of the identical existing
  bundle without rewriting it.
- Run importer validation on the new release and both retained releases.
- Compare the current active release to the new release and review the semantic diff. It must show
  the intended M-A additions and union effects without unexplained M-B/M-C changes.
- Inspect representative M-A legal, illegal, ordinary, alternate, and Mega forms; representative
  moves and abilities; exact format/ruleset; per-regulation source revisions; complete sprite
  coverage; zero validation errors; and expected warnings only.

### Backend checks

- Run backend formatting, lint, typing, Django system checks, migration consistency checks, and the
  complete backend test suite through `uv run` using the repository's established commands.
- Test strict reading and transactional loading of the new bundle plus strict validation of both
  retained bundles. Test identical-load no-op, hash/provenance tampering failure, explicit
  activation, repeat activation, and rollback.
- Test `/`, `/?regulation=m-c`, `/?regulation=m-b`, and `/?regulation=m-a`; no parameter must select
  M-C, and invalid, empty, or duplicate values must fail predictably.
- Test M-A index, bulk details, form detail, sprites, ETags, stale-version responses, authentication,
  allowed methods, deterministic order, exact stat values, and bounded query counts.
- Test header context on authenticated supported, unavailable, and retained-old-version states.

### Web GUI checks

- Run the established formatter, linter, TypeScript compiler, unit/component tests, production Vite
  build, and asset-manifest validation without adding dependencies.
- Run Playwright coverage for default M-C, explicit M-A and M-B selection, return to M-C through a
  parameter-free URL, one header selector, browser back/forward URLs, keyboard operation, focus,
  and unavailable/stale states.
- Manually verify authenticated desktop, tablet, and phone layouts in light and dark schemes. Check
  the visually hidden label, focus indicator, full option names, account-control fit, no horizontal
  page overflow, reclaimed Pokédex title space, and functional no-JavaScript form submission.

### Repository and deployment checks

- Run `.codex/lint.sh` before review handoff and again before commit.
- Run existing deployment shell/Bats checks and authorized local Bagredex Podman validation after
  the exact bundle pin is updated. Confirm a fresh empty database receives the new active bundle,
  while a database with an existing active version loads but does not auto-switch.
- Exercise the documented explicit activation and rollback paths locally and confirm retained
  release assets remain available.
- Inspect the final diff for exclusive ownership, no `references` content, no source-tree staging,
  no unrelated changes, and no persistence mechanism.

## Risks

- Combining regulation data from two full Showdown trees can conceal cross-revision identity drift.
  Isolated extraction, strict conflict checks, regulation-scoped effective records, and a reviewed
  semantic diff mitigate this; unexplained drift blocks publication.
- A single-revision bundle label or provenance object could falsely attribute M-A. The versioned
  multi-source contract and deterministic identifier must name the source set unambiguously.
- Backend strictness could reject retained releases or accept malformed new provenance. Exact
  pinned compatibility tests and tamper cases cover both directions.
- M-A may expand the form/sprite union or expose an unmapped historical identity. The importer must
  fail closed; manual mapping or overrides require evidence, provenance, and reviewer approval.
- Moving the selector outside Preact can create duplicate controls or inconsistent selected state
  during loading/error branches. One Django-owned header control and removal of all island copies
  make the ownership boundary explicit.
- A header select can crowd account controls on narrow screens or become inaccessible if its label
  is merely removed. Responsive wrapping, a visually hidden semantic label, native control
  behavior, and viewport/accessibility checks mitigate this.
- Updating the deployment pin does not switch an existing active database by design. The release
  report and operator documentation must call out the required explicit activation so M-A is not
  mistaken for active merely because its files are packaged.

## Completion criteria

- A deterministic reviewed release exists with valid M-A, M-B, and M-C data and exact
  per-regulation Showdown provenance from the two supplied local commits.
- The new release loads and activates atomically; both prior releases still validate, load, and can
  be explicitly reactivated for rollback without data loss.
- M-A passes the same authenticated Pokédex request and interaction coverage as M-B/M-C, and M-C is
  demonstrably the default whenever the URL omits `regulation`.
- Exactly one regulation selector appears in the authenticated global header with explicit option
  text, an accessible hidden label, working keyboard and no-JavaScript behavior, and no persisted
  state.
- The Pokédex title no longer contains or reserves layout for a regulation selector, and responsive
  light/dark layouts remain functional.
- Data, backend, Web GUI, deployment, and architect reviews report no blocking findings; all required
  checks have observed passing results; `.codex/lint.sh` passes; and no unapproved deferral remains.
- The cycle report records the exact new bundle ID, source revisions, semantic diff outcome,
  activation behavior, review iterations, observed checks, deferrals, and local commit or commits.

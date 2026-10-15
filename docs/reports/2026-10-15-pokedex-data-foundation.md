# Pokédex data foundation report

## Outcome

Bagredex now has a deterministic, versioned Pokémon data foundation for Champions VGC Regulations
M-C and M-B. The reviewed release can be loaded into PostgreSQL, activated or rolled back through
one atomic global pointer, and bootstrapped safely before a production release switch.

See the [Pokédex data foundation plan](../plans/2026-10-15-pokedex-data-foundation.md).

## Changes

- Added a dependency-free importer for the pinned local Pokémon Showdown and PokeAPI snapshots,
  with explicit inheritance, regulation legality, complete resolved learnsets, Mega relationships,
  move flags, source provenance, validation, and canonical hashing.
- Added the immutable release `showdown-3a766f2c-s1-i1-923ba416555c`, containing 353 forms, 667
  regulation memberships, 706 regulation-scoped profiles, 43,891 learnset entries, and 84 Mega
  relationships.
- Added 706 deterministic 384 by 384 WebP derivatives: normal and shiny PokeAPI HOME sprites for
  every included form. The manifest records exact source revisions, mappings, input and output
  hashes, structural properties, and the pinned `cwebp` 1.3.2 invocation.
- Added normalized, immutable Django models; strict bundle validation; transactional and idempotent
  loading; semantic diffs; exact level-50 stat arithmetic; explicit activation and rollback; and an
  append-only activation audit.
- Added database guards for version-local references and sealed-version immutability, plus indexes
  supporting the next cycle's regulation list, stat sorting, and AND filters.
- Packaged committed releases without the local `references` repositories. Production now loads the
  explicitly pinned bundle and performs race-safe `--if-none` activation before switching the
  application release, while preserving any existing active version.

## Review cycles

The Pokémon data review approved the normalized contract, source fidelity, legality, learnset
resolution, sprite coverage, provenance, validation, and deterministic rebuild after owner
corrections. The backend review approved persistence, constraints, immutability, transaction and
locking behavior, rollback, command behavior, and stat arithmetic after corrections.

Final integration review found no blocking cross-scope findings. The bundle identifier, hashes,
schema versions, counts, logical sprite paths, Django reader, deployment pin, image contents, and
bootstrap order agree. No Web GUI files changed, and the existing authenticated landing page
remains unchanged. The user-owned `.gitignore` addition for local `references` is preserved; no
incomplete release staging directory remains.

The backend reviewer noted no dedicated regression for simultaneous first-time singleton creation
or direct raw deletion of the singleton row. This is non-blocking: primary-key uniqueness makes
service initialization idempotent, operational activation and loading lock the established row,
and services recreate an absent pointer. Explicit coverage and a database-level deletion guard are
reasonable future hardening if mutation outside the supported services is introduced.

## Verification

- All 16 data tests passed. Validation confirmed 353 forms, 706 complete normal/shiny sprites,
  43,891 legal learnset entries, zero errors or warnings, and full profile, learnset, Mega, and
  sprite coverage.
- Rebuilding from the three clean pinned repositories with `cwebp` 1.3.2 was byte-for-byte
  deterministic; rebuilding the published release was an idempotent no-op.
- All 39 focused PostgreSQL Pokémon-data tests and the complete 146-test backend suite passed,
  including real load, reload, activation, rollback, concurrency, constraints, corruption
  rejection, and stat arithmetic.
- All 35 Bats tests passed. Offline image validation confirmed the bundle is packaged without
  `references`, and real deployment-path checks confirmed migration, load, initial activation, and
  release-switch ordering.
- Repository documentation lint and `git diff --check` passed during final integration review.

Registry publication, SSH deployment, certificate operations, and production-host smoke testing
remain human-run operations and were not performed.

## Deferred work

The visible Pokédex remains the deliberate second cycle: regulation selection, searchable Pokémon,
move, ability, and type filters with AND semantics, stat sorting, keyboard navigation, independent
Mega forms, normal/shiny controls, and the selected Pokémon and detail panes.

## Commits

This report is included in the pending cycle commit.

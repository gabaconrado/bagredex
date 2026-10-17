# Regulation M-A and global selector report

## Outcome

Bagredex now includes Pokémon Champions Regulation M-A alongside M-B and M-C in the immutable
release `showdown-multi-s2-i3-fc85b358deaa`. M-C remains the default when a URL omits
`regulation`; explicit choices are URL-scoped and are not stored.

Authenticated pages now present regulation selection in the global header with explicit
`Regulation M-C`, `Regulation M-B`, and `Regulation M-A` options and an accessible hidden label.
The Pokédex no longer owns or duplicates that control.

See the
[Regulation M-A and global selector plan](../plans/2026-10-16-regulation-ma-global-selector.md).

## Changes

- Added a schema-2, importer-3 multi-revision data contract. M-A is sourced from the complete local
  Pokémon Showdown tree at `b555f4d8ce7250e72939fe0c12cc5b303741d203`; M-B and M-C remain
  sourced from `3a766f2cfb5e51c1e428cfe87d0dba91a8f01640`.
- Generated the validated release `showdown-multi-s2-i3-fc85b358deaa`, with canonical hash
  `fc85b358deaa105d4fcd57602dee863e29a57fa62e7bb6b1b69018ddd2dbd038`, exact per-source
  provenance, 272 M-A legal forms, and complete regulation-scoped profiles and learnsets.
- Extended the strict Django reader for the multi-revision contract while retaining exact support
  for both schema-1 releases. Loading remains immutable and idempotent; activation remains atomic,
  explicit, and reversible.
- Centralized newest-first regulation policy as M-C, M-B, M-A. Requests without a regulation use
  M-C, and empty, duplicate, or unsupported values fail validation.
- Moved the native selector into the authenticated base header. Its ordinary GET form works without
  JavaScript; a dependency-free enhancement submits on change. The Preact bootstrap and Pokédex
  title no longer carry selector state or markup.
- Updated the deployment pin, identifier validation, tests, and operator documentation for the new
  release. Existing active installations still require explicit activation, and retained releases
  remain the rollback path.

## Review cycles

Pokémon data review approved historical-tree isolation, exact provenance, cross-revision identity
checks, legality, deterministic generation, retained-release compatibility, and the semantic diff.
Backend review approved strict schema dispatch, pinned release validation, regulation resolution,
header context, bootstrap and endpoint contracts, and load/activation/rollback behavior. Web GUI
review approved the Django/Preact ownership boundary, accessible progressive enhancement,
responsive header layout, and URL-only selection. Deployment review approved the exact pin,
`--if-none` behavior, retained assets, shell safety, and activation and rollback documentation.

Owner corrections resolved review findings before final review. Every scope reviewer reported no
remaining blockers. Architect integration review found the data provenance, reader allowlist,
runtime regulation behavior, header/bootstrap boundary, URL behavior, and deployment contract
consistent, with no blocking or nonblocking implementation findings.

## Verification

- All 30 data tests passed. Explicit validation passed the new release and both retained i1/i2
  releases. An identical-input rebuild returned the same identifier and full canonical hash without
  rewriting the release.
- The semantic comparison from the active i2 release to the new release reported zero removals or
  changes. It added only M-A-scoped records plus the newly referenced global move Pound, with no
  form, sprite, or sprite-mapping delta.
- All 32 non-database Pokémon-data backend tests passed; 15 PostgreSQL-dependent tests were
  deliberately deselected because host PostgreSQL was unavailable. Focused reader tests, Ruff,
  mypy, and Django system checks passed.
- `npm run check`, the production frontend build, and the owner's clean 99-test unit run passed. A
  concurrent reviewer rerun encountered one known timing flake and completed 98 of 99 tests; the
  isolated suite had passed. Playwright was not executed because the review environment lacked the
  required browser sandbox and authenticated fixture capability.
- Bash syntax checks, ShellCheck, and all 46 deployment Bats tests passed. Repository lint and
  `git diff --check` passed during final integration review and again after writing this report.
- PostgreSQL lifecycle/request coverage and the complete local Podman path could not be exercised
  in this environment. Podman validation stopped because its required pinned image was not present
  locally; project policy forbids pulling or installing it. These are verification gaps, not known
  defects, and static and mocked deployment checks found no blocker.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

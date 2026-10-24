# Damage calculator report

## Outcome

Bagredex now provides an authenticated, regulation-aware 1×1 damage calculator beside Team
Builder. It calculates six moves in either direction with exact level-50 Champions stats,
damage-relevant battle state, contextual mechanics, Mega previews, and accessible compact and full
roll output.

The implementation follows the
[damage calculator plan](../plans/2026-10-24-damage-calculator.md).

## Changes

- Added immutable release `showdown-multi-s5-i6-38ee90625b30`, with bundle SHA-256
  `38ee90625b301639ff581409f3728f91e717373a9658ea516a4e9a336113fedd`. Schema 5 and importer 6
  add normalized calculation facts, contextual descriptors, gender, weight, type effectiveness,
  Mega relations, ability slot order, and a fail-closed calculator capability contract for M-A,
  M-B, and M-C.
- Added strict Django loading and normalized persistence for the new facts, plus an authenticated
  page, versioned bootstrap, and private-cache dataset endpoint that reject stale, malformed, or
  unsupported requests without adding calculator persistence.
- Added the focused Preact calculator with legal autocomplete choices, six independent move slots,
  unrestricted per-stat 0–32 SP controls and total SP, exact current HP, status and stat stages,
  directional field effects, contextual inputs, Mega locking, and keyboard-, pointer-, and
  touch-accessible result disclosures.
- Adapted the dependency-free formula slice from locally pinned vgcmulticalc, added a local
  reference generator and 21-case exact parity matrix, and added a zero-unsupported release audit
  with shared runtime dispatch and evidence for all reachable damage branches.
- Preserved Pokémon Showdown as the sole Pokémon and mechanics-data authority. The runtime uses
  only canonical Bagredex data; vgcmulticalc supplies formula behavior only. Its pinned MIT notice
  and revision are recorded separately from Showdown and sprite provenance.
- Corrected the persistent uv configuration so backend commands reliably use the backend-local
  `src/backend/.cache/uv` cache without command-specific overrides, and aligned repository policy
  with that configuration.

## Review cycles

Data contract review first found incomplete reachable-fact coverage, contextual input definitions,
ability ordering, and Mega examples. The data owner closed the contract, regenerated the release,
and added exact validation and provenance.

Backend, Web, data, and integration reviews then resolved schema drift, incomplete formula paths,
per-move contextual-state isolation, autocomplete and disclosure behavior, HP clamping, six legal
variable-power moves, speed-dependent mechanics, strict nested parsing, Parental Bond and
progressive-hit reactions, and insufficient parity, audit, component, and browser evidence.

The final integration review found no blockers. The active release audit reports no unsupported,
unclassified, missing, stale, duplicate, or silently defaulted reachable damage branch.

## Verification

- Web TypeScript and Prettier checks passed.
- The final Vitest run passed 174 tests across 14 files. Twenty-one superseded internal-output
  fixture cases remain intentionally skipped; the active 21-case suite compares Bagredex ordered
  rolls and normalized range output against the independently generated pinned vgcmulticalc
  reference artifact.
- The final-release damage audit passed with 205 executable implemented entries and no missing,
  stale, duplicate, unsupported, or unclassified entries.
- `git diff --check` passed before this report was written.
- Data, backend, Web, and architect reviews found no remaining blocking findings.

Final deployment validation remains pending: repository lint, the complete data and
PostgreSQL-backed backend suites, production Web build and manifest checks, live Playwright across
configured projects, local Podman/runtime authentication and cache smoke tests, and cleanup of
obsolete intermediate untracked releases. These are environmental or final-cycle validation gaps,
not known product defects.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

# Cross-tool form search and selection report

## Outcome

Bagredex now presents the Pokédex's reviewed form-family search behavior in Team Builder, Damage
Calculator, and Battle Mode. Castform, Aegislash, Gourgeist, and Squawkabilly use one search result
with an ordered Form selector when multiple legal forms are available. Meowstic-Male and
Meowstic-Female remain separate searchable identities, and either exact form can be saved where
legal.

The work follows the approved
[cross-tool form selection plan](../plans/2026-11-01-cross-tool-form-selection.md).

## Changes

- Added immutable Pokémon data release `showdown-multi-s7-i9-78b322057dd0`. Schema 7/importer 9
  records direct or derived membership provenance and adds female Meowstic legality in M-A, M-B,
  and M-C from pinned related fixed-sex Showdown facts. The semantic delta contains only membership
  provenance and those three memberships.
- Added the membership-provenance database migration and retained-release defaults. A shared
  backend policy now owns the four grouped families while preserving Pokédex behavior.
- Bumped Team Builder to `team-builder-data-v6` and Damage Calculator to
  `damage-calculator-data-v3`. Both serialize strict canonical search entries; Battle Mode maps
  every reachable canonical form. Team Builder data now uses schema-aware private ETags.
- Added grouped search and native Form selectors to Team Builder, both calculator panels, and
  user-created Battle Mode opponents. Form changes preserve compatible state, clear incompatible
  choices, and retain exact canonical identities. Own-team Battle members remain read-only.
- Advanced the local deployment pin to s7/i9 and validated migration, load, activation, and the
  three interactive consumers against the local Bagredex runtime.

## Review cycles

- Pokémon data review confirmed deterministic output, the exact three-membership delta, provenance,
  retained releases, and the absence of UI grouping policy in normalized data.
- Runtime validation found and resolved an immutable-trigger conflict in migration 0007 and an
  exhausted-generator defect that produced empty search entries.
- Browser validation found and resolved a Battle Mode test locator issue and a delayed-focus race
  affecting tablet form selection.
- Final review added exact Web contract coverage, an s7/i9 female Meowstic API round trip, female
  Mega-relation and Species Clause assertions, Battle mapping coverage, and an authenticated
  save-and-reload browser case. Data, backend, Web, and integration re-reviews reported no remaining
  findings.

## Verification

- Pokémon data: 52 tests passed; two importer builds produced the same release ID; s7/i9 and the
  retained release validated with no errors.
- Backend focused checks passed, including Ruff, mypy, Django system and migration checks, and the
  s7/i9 database integration coverage for female Meowstic persistence and clauses.
- Web checks passed: 238 tests with 21 skipped, TypeScript checks, and the production build.
- Authenticated Playwright coverage passed on desktop light, tablet dark with reduced motion, and
  phone light: Team Builder 3/3, Damage Calculator 3/3, and Battle Mode 3/3.
- Deployment tests passed 42/42. The local runtime applied migration 0007, loaded and activated
  `showdown-multi-s7-i9-78b322057dd0`, and reached readiness.
- `.codex/lint.sh` and `git diff --check` passed after final review corrections.

## Deferred tasks

None.

## Commits

This report is included in the pending feature commit.

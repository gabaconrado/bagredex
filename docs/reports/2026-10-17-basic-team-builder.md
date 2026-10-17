# Basic team builder report

## Outcome

Bagredex now has an authenticated Team Builder page and private **My Teams** library for Pokémon
Champions Regulations M-A, M-B, and M-C. Users can explicitly save, reopen, rename, reorder, and
delete incomplete or complete six-slot teams pinned to one immutable regulation dataset.

The implementation follows the approved
[basic team builder plan](../plans/2026-10-17-basic-team-builder.md).

## Changes

- Added a schema-3 Pokémon-data release with regulation-effective Champions items, Serious plus
  stat-changing natures, stone-specific Mega mappings, and the 66-point total SP contract. The
  importer retains exact Showdown revisions, deterministic validation, semantic comparison, and
  compatibility with earlier bundle schemas.
- Advanced the deployment data pin to `showdown-multi-s3-i4-5073b2ab1402`; retained schema-2
  releases remain readable but cannot back new Team Builder creation because they lack the required
  legality and mechanics contracts. Deployment documentation and Bats expectations now require
  the schema-3 release.
- Added protected team, member, and move-slot persistence with case-insensitive per-user names,
  exact regulation/version references, stable form and choice identifiers, species and item
  uniqueness, legal abilities and learnsets, ordered nullable move slots, SP validation, Shiny,
  Mega preview, and exact base or Mega stat calculation.
- Added authenticated HTML and same-origin JSON endpoints for regulation-filtered summaries,
  retained-version datasets, atomic aggregate creation and replacement, owner-concealed reads and
  mutation, and permanent deletion.
- Added the second Django-rendered application page with a feature-split Preact island, six fixed
  slots, a name/type/ability/move command palette, keyboard-progressing autocompletes, direct and
  slider SP entry, live stats, Mega and Shiny presentation, explicit dirty-state protection, and
  regulation-preserving global navigation.
- Added backend, data, Web unit/component, and Playwright coverage plus the generated Vite entry
  and plain responsive themed CSS.

## Review cycles

Pokémon-data review corrected effective Champions legality handling, tightened fail-closed status
interpretation, and approved the final item, nature, mechanics, and stone-to-Mega contracts and
their provenance. Backend review expanded aggregate, authorization, boundary, exact-stat,
unsupported-data, and persistence coverage and approved the final service and HTTP contracts.

Web review corrected retained-versus-active dataset switching, autocomplete identity and external
state synchronization, nullable move-slot round trips, field-error association, fixed-slot focus
and reordering, invalid-nature handling, and canonical save timestamps. It also verified the
keyboard, responsive, theme, and accessibility structure.

Integration review aligned the data, Django, and Web identifiers, stat mappings, immutable
regulation behavior, Mega rules, navigation, error paths, and mechanics checks. Raw team admin
mutation was removed so aggregate writes remain service-owned. All scope reviewers and final
integration review reported no blocking findings.

Final deployment validation exposed test-readiness issues in the team fixture and browser setup.
The responsible owners corrected those fixtures and focused assertions without changing approved
product behavior; the affected focused and full checks then passed.

## Verification

- The complete PostgreSQL backend suite passed all 236 tests in 110.87 seconds, including team
  persistence, authorization, validation, retained data, migrations, and existing behavior.
- The data importer suite passed all 33 tests.
- Backend Ruff formatting and lint, strict mypy, migration checks, and Django system checks passed.
- Web TypeScript and Prettier checks passed, and the final Vitest suite passed all 112 tests.
- The production Vite build and emitted-asset verification passed with a separate Team Builder
  entry and assets.
- Sequential Team Builder Playwright validation passed all 10 tests in 19.5 seconds across
  Chromium and Firefox desktop, tablet, and phone projects.
- A corrected focused Chromium desktop-light repeat for Pokédex history, regulation, and shortcut
  behavior passed both tests in about 15.2 seconds.
- Three attempts to run the full sequential existing Pokédex browser matrix could not start because
  host Chromium terminated with a sandbox `FATAL` and `Operation not permitted` under the managed
  sandbox. Project policy forbids bypassing that restriction. The focused repeat and Team Builder
  matrix passed, and this is an environmental verification limitation rather than a known defect.
- All 46 deployment Bats tests passed with the schema-3 pin and expectations.
- Runtime migrations were current and a no-op. Loading and activating
  `showdown-multi-s3-i4-5073b2ab1402` reported the release already loaded and active with no data
  changes, while retaining its semantic diff. The application container was healthy, its internal
  health check passed, and `/teams/` returned HTTP 200.
- `.codex/lint.sh` and `git diff --check` passed.

## Deferred tasks

None. The remaining full Pokédex browser-matrix limitation is environmental, not deferred product
work or a known implementation defect.

## Commits

This report is included in the pending cycle commit.

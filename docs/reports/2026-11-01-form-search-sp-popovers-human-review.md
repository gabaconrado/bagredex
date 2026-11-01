# Form-search and popover human-review report

## Outcome

The completed `form-search-sp-popovers` feature now incorporates the accepted browser-review
corrections. Damage Calculator move modifiers use a compact in-field trigger, Team Builder Real
Stats reflect eligible held-item stat modifiers, and expanded member cards expose the existing
remove action beside collapse.

This report supplements the original
[plan](../plans/2026-11-01-form-search-sp-popovers.md),
[report](2026-11-01-form-search-sp-popovers.md), and
[human-review plan](../plans/2026-11-01-form-search-sp-popovers-human-review.md).

## Changes

- Replaced the layout-disrupting move-modifier button with an accessible `+` trigger inside the
  applicable move field while preserving popover state, positioning, dismissal, and focus return.
- Added immutable bundle `showdown-multi-s6-i8-e712c7acc763`, schema 6 and importer 8. It derives
  ordered exact item stat modifiers and unconditional held-item suppression from the pinned local
  Pokémon Showdown sources while retaining prior releases.
- Added Django persistence and migration `0006_held_item_stat_mechanics`, advanced the Team Builder
  dataset to `team-builder-data-v5`, and serialized modifier, suppression, and `is_nfe` facts.
- Updated Team Builder to replace raw Real Stats with eligible item-adjusted values using exact
  integer rounding. Eviolite eligibility and Klutz-style suppression remain data-driven; triggered
  and damage-only effects remain excluded.
- Added the existing accessible member-removal action beside collapse on expanded cards without a
  second confirmation or state path.
- Extended human-review reload so a ready session validates and adopts the reviewed local bundle
  before marker mutation, while interrupted recovery retains its recorded bundle and database
  volume. The deployment pin now selects i8.

The separately planned cross-tool form-selection feature is not part of this human-review result.

## Review cycles

Pokémon-data, backend, Web, and integration reviews completed. Owner corrections tightened exact
modifier normalization and bounds, retained-release test construction, documentation of the schema
transition, and deployment coverage. Deployment review also found stale release-test expectations
and incomplete pre-mutation artifact validation; the owner updated the expectations and replaced
the shallow manifest check with canonical local bundle validation.

Re-review reported no blocking or actionable findings. The schema-6/importer-8 release, Django
models and migration, Team Builder v5 serializer and parser, Web calculation contract, deployment
pin, and lifecycle marker semantics agree.

## Verification

- Data tests passed: 47 full bundle tests and 2 focused held-item mechanics tests. Two deterministic
  rebuilds produced the same i8 release identifier, and canonical release validation returned
  `status: valid` with no errors.
- Backend formatting and lint, mypy over 53 source files, Django system check, migration drift
  check, and focused bundle, retained-release, malformed-fact, and Team Builder checks passed.
- Web type checking, the 233-test unit/component suite with 21 intentional skips, production build,
  and focused component suites passed.
- Authenticated focused browser checks passed for independent move controls, item-adjusted Real
  Stats, and expanded-member removal.
- Shell syntax and ShellCheck passed. Deployment command tests passed 32/32, human-review lifecycle
  tests passed 35/35, and release tests passed 10/10.
- `.codex/lint.sh` and `git diff --check` passed during final integration re-review.

Final aggregate validation, reviewed-result commit creation, report hash correction, completion
receipt, and lifecycle completion acknowledgment remain pending for the deployment workflow. The
initial host-only backend test attempt could not reach PostgreSQL; runtime migration, i8 load and
activation, and authenticated browser checks subsequently succeeded in the isolated human-review
environment.

## Deferred tasks

None. The cross-tool search grouping and form selection request belongs to its own approved feature
cycle and is intentionally outside this report.

## Commits

This report is included in the pending reviewed-result commit.

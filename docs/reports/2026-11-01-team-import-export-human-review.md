# Team import and export human-review report

## Outcome

The completed Team Builder text interchange now accepts the reviewed Showdown paste shape without
weakening Champions rules. `EVs:` is a compatibility label for direct Champions points, ordinary
nature names resolve independently of decorated selector labels, and Mega-form sets normalize to
stored base forms and legal base abilities.

This changed session supplements the original
[team import and export plan](../plans/2026-11-01-team-import-export.md),
[feature report](2026-11-01-team-import-export.md), and reviewed base boundary
`adcfb55a11e8fca8b4740283433fdf9cfc4a72e2`. The accepted feedback and implementation are defined
by the [human-review plan](../plans/2026-11-01-team-import-export-human-review.md).

## Changes

- Accepted `EVs:` or `SPs:` as one Champions point-allocation line per set. Both retain the 0–32
  per-stat and 66-total limits; repeated or mixed allocation lines reject the complete import.
- Separated canonical nature interchange names from decorated selector labels, so names such as
  Timid, Jolly, Sassy, Brave, and Modest import and export normally.
- Advanced the retained browser dataset to `team-builder-data-v7`. Each base form now exposes its
  exact retained Showdown slot-0 ability, with fail-closed backend and browser validation.
- Accepted valid base or Mega headers with their matching Mega Stone. Legal pasted base abilities
  remain unchanged; related Mega-only abilities use the approved slot-0 fallback. Gengar with
  Shadow Tag stores Cursed Body, and Raichu with Electric Surge stores Static.
- Kept canonical export and `team-draft-v1` persistence on base forms and base abilities. The
  normalized release, saved-team schema, database schema, and active data pin remain unchanged.

## Review cycles

- Round 1 reproduced the reported paste and traced ordinary nature failures to decorated Web
  labels rather than missing normalized data. The user approved `EVs:` as a bounded Champions-point
  alias, not 252-scale EVs.
- Round 2 traced Mega ability failures to the deliberate base-form persistence model. Because most
  related base forms have multiple legal abilities, the user approved retained Showdown slot 0 as
  the deterministic fallback when a pasted ability exists only on the related Mega form.
- Backend review, Web GUI review, and architect integration review reported no blocking findings.
  Fixture corrections preserved Pokémon-data immutability, and final validation completed the
  earlier backend performance gap without a failing assertion.

## Verification

- The retained-release backend regression passed: 1 test in 16.92 seconds.
- The full team backend suite passed: 57 tests in 51.82 seconds.
- Ruff format and lint checks passed; mypy passed across 69 files; Django system checks passed.
- Deployment checks passed with 2 intentionally silenced findings. Django reported no migration
  changes; its host-database availability warning did not affect the migration-state result.
- The full Web suite passed: 276 tests, with 21 skipped.
- TypeScript checks, the production Web build, `.codex/lint.sh`, and `git diff --check` passed.
- The latest pre-teardown focused Playwright workflow passed 2 tests across the configured desktop
  and tablet projects, covering retained-payload EV/nature parsing and both Mega translations.

## Deferred tasks

None.

## Commits

This supplemental report is included in the pending reviewed-result commit.

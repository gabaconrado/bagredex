# Review runtime defaults report

## Outcome

Bagredex's local browser-review paths now default to port `8000` and the loopback-only
`admin` / `admin` account. Ordinary review retains its configurable port, while human review uses
the fixed proxy-visible port and the `$human-review` workflow injects no port override.

The active Basic Team Builder review session migrated from port `8001` without losing its target,
active Pokémon bundle, database volume, or review data. See the
[review runtime defaults plan](../plans/2026-10-24-review-runtime-defaults.md).

## Changes

- Changed ordinary review's local password default to `admin` while preserving `BAGREDEX_PORT` and
  explicit username/password overrides.
- Fixed human review to port `8000`, ignored the retired human-review port override, and changed
  new-session credentials to `admin` / `admin`.
- Added read-only legacy-marker detection and an atomic, resumable reload migration. The exact old
  default credentials migrate, while intentional custom credentials remain unchanged.
- Made reload recreate only the human-review server. Migration, data activation, and account setup
  use dependency-free one-off server containers; the replacement server starts detached with the
  expected fixed name, service port, health contract, and Compose project membership.
- Updated the explicit skill contract, operator documentation, and regression coverage for fixed
  port behavior, defaults, overrides, migration failure safety, and database preservation.

## Review cycles

Initial code review found no blocking defect in the defaults or marker migration. The first real
reload exposed a Podman Compose 1.0.6 behavior not represented by the mocks: dependency
reconciliation replaced the database container once. The named volume, its label, and all persisted
data survived, but container replacement violated the server-only reload objective.

The deployment owner corrected reload to remove and recreate only the server and to run transient
server tasks with `run --no-deps`. Focused tests were expanded to require that command shape and
exclude database `up` during an ordinary reload. Final integration review found no blocking or
actionable findings. A subsequent real reload retained the exact database container identity and
preserved the lifecycle, health, status, and finish contracts.

## Verification

- The complete deployment check passed all 68 tests.
- The focused command and human-review Bats suites passed all 53 tests.
- Bash syntax, ShellCheck, repository lint, and `git diff --check` passed.
- A local-only real reload reported target `basic-team-builder`, state `ready`, URL
  `http://127.0.0.1:8000/`, username and password `admin`, active bundle
  `showdown-multi-s5-i6-38ee90625b30`, project `bagredex-human-review`, and volume
  `bagredex-human-review-database`.
- HTTP readiness on `127.0.0.1:8000` passed, and Django authentication with the new default account
  succeeded.
- The named volume retained its original `2026-10-24 18:25:06 UTC` creation time and workflow
  label. The review team count remained zero across the final reload.
- The corrected no-dependency reload retained database container ID prefix `27d2e1cd`. No ordinary
  `bagredex-local` container existed before or after the reload.
- All required images were already local. Validation did not access a registry or other remote
  operational service.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

# GitHub validation report

## Outcome

Bagredex now has test-only GitHub Actions validation for pull requests, pushes to `main`, and
manual runs. The README shows both the validation result and the latest manually published Docker
image version for `gabaconrado/bagredex`.

Implementation followed the [GitHub validation plan](../plans/2026-11-02-github-validation.md).

## Changes

- Added three independent validation jobs for the Web GUI, backend and PostgreSQL-backed tests,
  and documentation, shell, and deployment-script checks.
- Restricted the workflow token to read-only repository contents and omitted secrets, deployment
  environments, publishing, registry operations, SSH, and deployment steps.
- Used repository-pinned runtime versions, frozen dependency locks, and commit-pinned GitHub
  Actions.
- Added linked GitHub Actions status and Docker image version badges to the README.

## Review cycles

The architect reviewed the workflow triggers, permissions, locked setup, validation coverage,
badge targets, and operational boundaries. No blocking findings remained. The first hosted run
still needs to confirm GitHub runner support for the repository's pinned Python and Node.js
versions and Podman Compose.

## Verification

- `./bagredex.sh check` passed: 283 Web tests passed with 21 skipped, 332 backend tests passed,
  and all 82 Bats tests passed.
- `.codex/lint.sh` passed.
- `git diff --check` passed.
- Structural checks confirmed the exact approved events, read-only contents permission, complete
  scoped command coverage, and absence of secrets, publishing, deployment, registry, SSH, or
  production-environment behavior.
- No suitable local YAML parser was available, so no separate YAML parser check was run.

## Deferred tasks

None.

## Commits

- `4b2397c3af58997253b7302efac37cde13239278` — `ci: add GitHub validation workflow`

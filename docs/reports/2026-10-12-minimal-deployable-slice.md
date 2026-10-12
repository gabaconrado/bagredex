# Minimal deployable slice report

## Outcome

Bagredex now has a database-free Django placeholder application and a complete, human-operated
delivery path for local execution, image publication, and rollback-capable production deployment.
The implementation follows the approved
[minimal deployable slice plan](../plans/2026-10-12-minimal-deployable-slice.md).

## Changes

- Added a uv-locked Django and Gunicorn application with a server-rendered home page and
  dependency-free liveness and readiness endpoints.
- Added semantic templates and responsive plain CSS with operating-system light and dark themes and
  Indigo Purple accents.
- Added rootless Podman application and Nginx image targets, local and production Compose files,
  one-domain Nginx and Certbot configuration, and systemd user units.
- Added `bagredex.sh` commands for checks, local execution, image publication, and deployment.
- Added stable-version guards, canonical production-domain validation, timestamped releases,
  serialized deployment, health verification, retention, and automatic application rollback.
- Documented local use, production preparation, TLS bootstrap and renewal, release behavior, custom
  deployment directories, and the human-only operational boundary.

## Review cycles

Backend review found that production initially accepted wildcard hosts. The backend owner added one
lowercase ASCII FQDN contract, malformed-domain coverage, and wrong-host request coverage. Final
review then found an order-dependent database-settings test, which was isolated and corrected.

Web GUI review found no blocking issues. It verified semantic structure, no-CSS content, static
asset integration, responsive behavior by inspection, accessibility provisions, and contrast
ratios of at least 6.66:1.

Integration review returned five deployment findings: account-wide image cleanup, production-domain
leakage into local health checks, request-host redirects, incomplete rollback and release-transition
tests, and undocumented systemd path assumptions. All were corrected. A further cross-scope review
aligned Django, preflight, Nginx, Certbot, certificate paths, and documentation on the same canonical
domain rules. Final backend, Web GUI, deployment, and integration reviews found no blockers.

## Verification

- `./bagredex.sh check`: passed, including Ruff formatting and lint, strict mypy, local and
  production Django checks, 63 pytest tests, repository documentation lint, Bash syntax,
  ShellCheck, and 19 Bats tests.
- Isolated settings test module: 39 tests passed.
- Static collection: passed and collected the namespaced stylesheet.
- Web GUI static review: passed for semantic structure, light and dark tokens, responsive layouts,
  focus treatment, reduced motion, and text contrast.
- `git diff --check`: passed after the final review fixes.
- Podman Compose resolution, image builds, container execution, HTTP smoke tests, and interrupt
  cleanup could not run in the agent sandbox. The normal attempt and the user-authorized
  workspace-local `XDG_RUNTIME_DIR` retry both failed because Podman's configured RunRoot and event
  paths remained protected under `/run/user/1000`; no storage or security workaround was attempted.
- Real-browser viewport and theme rendering was not run because this slice deliberately introduced
  no browser test toolchain. The Web GUI review therefore verified those behaviors statically.
- Registry publication, SSH deployment, certificate issuance, systemd enablement, and production
  smoke testing remain deliberate human-run operations and were not executed by agents.

## Deferred tasks

None. The Podman runtime and real-browser gaps are reported verification limitations, not known
implementation defects or deferred feature work.

## Commits

This report is included in the pending cycle commit.

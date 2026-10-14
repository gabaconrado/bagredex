# Authentication and Django admin report

## Outcome

Bagredex now has username/password authentication, protected application pages, a project-owned
Django user model, and standard Django administration backed by PostgreSQL. The implementation
follows the approved
[authentication and Django admin plan](../plans/2026-10-14-authentication-admin.md).

## Changes

- Added the `accounts.User` model, standard Django auth/admin/session apps, database migrations,
  default login-required middleware, safe login redirects, POST-only logout, and active-staff admin
  authorization.
- Added an accessible server-rendered login page and authenticated header with first-name/username
  fallback, CSRF-protected logout, responsive plain CSS, and existing light/dark theme support.
- Added private PostgreSQL services for local and production Compose, persistent named volumes,
  database-aware readiness, migration-before-release-switch deployment, and documented first-admin
  creation.
- Added exact POST-only Nginx rate limiting for `/login/` and `/admin/login/` at 10 requests per
  minute per client IP with burst 5 and 429 responses.
- Configured uv persistently to use repository-root `.cache/uv`, removed command-local cache
  overrides, and added a development image/test path with locked dependencies and the project
  virtual environment on its runtime `PATH`.
- Updated local commands, deployment tests, environment examples, preflight checks, and operator
  documentation for database configuration, persistence, rollback limits, and image availability.

## Review cycles

Backend implementation was re-reviewed after owner corrections; the final backend review found no
actionable authentication, authorization, migration, settings, or persistence findings.

Web GUI review identified missing error association for invalid login credentials. The owner linked
the generic login error to both fields with `aria-describedby`; re-review found no blockers.

Integration review verified the route/template/user, database environment, persistent volume, uv
cache, readiness, migration ordering, and Nginx contracts. It found one low-severity documentation
gap: production prerequisites mentioned only the two Bagredex images. The deployment owner updated
the guide to include pinned PostgreSQL and Certbot images. Final backend, Web GUI, deployment, and
integration reviews found no actionable findings.

After the original feature commit, a user-enabled online development build populated the remaining
locked dependencies and exposed that the development image did not place `/app/.venv/bin` on
`PATH`. The deployment owner scoped the PATH correction to the development stage and added a Bats
regression assertion. Focused integration re-review confirmed that the production application
stage was unchanged and found no actionable findings.

## Verification

- Backend formatting, Ruff lint, strict mypy, local and production Django checks, migration checks,
  and the complete 107-test pytest suite passed against PostgreSQL.
- Clean PostgreSQL migration, authenticated login and home access, database-aware readiness, and
  session persistence across a database restart passed in real container smoke tests.
- The configured uv cache resolved to repository-root `.cache/uv` without `UV_CACHE_DIR` command
  overrides.
- Repository documentation lint, Bash syntax, ShellCheck, all 30 Bats tests, and
  `git diff --check` passed.
- `nginx -t` passed. A live limiter smoke admitted six rapid POST requests, rejected the next ten
  with 429, and admitted a subsequent GET. Admitted requests returned the expected 502 because the
  isolated test intentionally provided no upstream server.
- After the user-enabled online build populated all locked dependencies, exact
  `./bagredex.sh check` rebuilt the development image from cached layers offline. The project
  virtual environment resolved `pytest`; all 107 pytest and 30 Bats tests plus Ruff, mypy, Django,
  documentation lint, Bash syntax, ShellCheck, and diff checks passed without network access, image
  pulls, or dependency installation. Validation cleanup left no containers or networks and retained
  the persistent local database volume.
- Registry publication, SSH deployment, certificate issuance, systemd changes, production account
  creation, and production smoke testing remain human-run operations and were not executed.

Residual risks are the missing automated PostgreSQL backup and point-in-time recovery workflow,
forward-compatible rather than automatic schema rollback, shared-NAT coupling in per-IP rate
limits, and the deliberately human-run production operations.

## Deferred tasks

None. No task files were created. The operational risks are recorded limitations, not known
blocking defects or unfinished approved scope.

## Commits

The original feature was committed as `5ebc7a0741f0343443a34f81739b984470575a90`. The development
image validation correction and this report update are included in a pending fix commit.

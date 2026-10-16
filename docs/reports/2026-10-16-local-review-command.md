# Local review command report

## Outcome

Bagredex now provides `./bagredex.sh review` for launching a complete, repeatable local browser
review environment from a prepared checkout. It initializes the reviewed Pokémon data and local
administrator before announcing readiness, stays attached until interrupted, and preserves the
named local database volume.

See the [local review command plan](../plans/2026-10-16-local-review-command.md).

## Changes

- Added the zero-argument `review` command to the root script and help output.
- Added bounded database and application readiness checks before printing the URL and credentials.
- Added ordered frontend and development-image builds, migrations, idempotent bundle loading,
  explicit activation of the version pinned by `deploy/pokemon-data.env`, and idempotent local
  superuser provisioning.
- Added defaults for `admin` and `bagredex-local`, with validated
  `BAGREDEX_REVIEW_USERNAME`, `BAGREDEX_REVIEW_PASSWORD`, and `BAGREDEX_PORT` overrides.
  Credentials cross into Django as opaque NUL-delimited input rather than executable shell or
  Python content.
- Added fixed-project cleanup for normal exit, failures, and interruption without deleting the
  `bagredex-local-database` volume.
- Documented local security boundaries, retained state, explicit data activation, configuration,
  and host-loopback Incus proxy setup and removal.
- Added deployment tests for validation, operation ordering, failure propagation, readiness,
  credentials, repetition, interruption, and volume preservation.

## Review cycles

The first integration review found three blockers and one nonblocking safety issue: database
readiness could wait forever, readiness and credentials were printed before the server started,
failure and interruption coverage was incomplete, and control characters could corrupt terminal
output. The deployment owner added bounded database and server waits, delayed output until an HTTP
readiness response, expanded cleanup and repeatability tests, and rejected control characters in
printed credentials.

The second integration review confirmed every finding was resolved. Command ordering, pinned
explicit activation, credential transport, cleanup scope, named-volume retention, production
isolation, and Incus guidance matched the plan, with no blocking or nonblocking findings remaining.

## Verification

- `bash -n`, ShellCheck, documentation lint, and `git diff --check` passed.
- All 31 focused command Bats tests passed, including initialization failures, server readiness
  failure, repeated runs, `SIGINT`, and absence of volume deletion.
- The complete deployment suite passed all 46 tests.
- A real offline Podman smoke used `BAGREDEX_PORT=8018`, offline npm inputs, and already-local
  images. It completed the frontend and development-image builds, migrations, bundle loading,
  explicit activation, and account provisioning without an external, registry, or remote operation.
- The detached server returned HTTP 200 from `/health/ready`, Podman reported it healthy, and
  foreground attachment worked. Chromium login with `admin` and `bagredex-local` reached the
  Pokédex.
- Database inspection confirmed the account was active, staff, and a superuser, and the active data
  version was exactly `showdown-3a766f2c-s1-i1-923ba416555c`.
- A second invocation reported the bundle already loaded and active while safely reprovisioning the
  account. `Ctrl+C` removed the server and database containers, and the named
  `bagredex-local-database` volume remained.

## Deferred tasks

None.

## Commits

This report is included in the pending cycle commit.

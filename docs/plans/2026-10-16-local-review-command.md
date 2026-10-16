# Local review command

## Summary

Add `./bagredex.sh review` as a one-command, local-only way to open a fully initialized Bagredex
review environment. It builds the current frontend and development image, starts the local
PostgreSQL service, migrates the database, loads and explicitly activates the reviewed Pokémon
bundle pinned by `deploy/pokemon-data.env`, ensures a configurable local superuser exists, prints
the loopback URL and credentials, and attaches to the application until the operator presses
`Ctrl+C`.

The command reuses the existing local Compose project and named database volume. It changes no
production runtime, application behavior, dependency graph, or remote system.

## Goals

- Make the browser-visible application reviewable from a prepared checkout with one memorable
  command.
- Guarantee that the current schema and pinned Pokémon release are loaded and selected before the
  review server starts.
- Guarantee that a known local-only administrator can sign in, while allowing its username and
  password to be overridden for the current invocation.
- Keep repeated runs safe and deterministic without deleting the local database volume.
- Document loopback port selection and access when Bagredex itself runs inside an Incus container.

## Non-goals

- Production deployment, image publication, registry access, external network calls, or remote
  smoke testing.
- A production bootstrap account, signup flow, credential store, or general-purpose user management
  command.
- Resetting the database, deleting containers or volumes outside the existing local Compose project,
  or guaranteeing an otherwise pristine database.
- Replacing `run`, `migrate`, frontend checks, or the complete repository check workflow.
- Adding a host tool, Python package, frontend package, image, service, or application migration.

## User-visible behavior

Running:

```bash
./bagredex.sh review
```

performs these ordered operations:

1. Validate required local tools and review configuration before starting work.
2. Install the already-locked frontend dependencies and build and verify the Vite assets through
   the existing helpers.
3. Build the existing development server image and start the local PostgreSQL service, waiting for
   its health check.
4. Run Django migrations against that database.
5. Read `BAGREDEX_POKEMON_DATA_VERSION` from `deploy/pokemon-data.env`, validate its identifier, and
   run `load_pokemon_data` for `/app/src/data/releases/<version>`.
6. Run `activate_pokemon_data <version>` without `--if-none`, so the review environment always uses
   the bundle pinned by this checkout. Loading and activation retain their existing idempotent
   behavior.
7. Create the requested local user when absent or update that same username when present. The user
   is active, staff, and a superuser, and its password is reset to the requested review password on
   every run.
8. Print the sign-in URL, username, password, active data version, and the fact that `Ctrl+C` stops
   the review containers while preserving the database volume.
9. Start and attach to the development server in the foreground until `Ctrl+C` or server failure.

The defaults are:

```text
URL:      http://127.0.0.1:8000/
Username: admin
Password: bagredex-local
```

`BAGREDEX_PORT` selects another host loopback port. `BAGREDEX_REVIEW_USERNAME` and
`BAGREDEX_REVIEW_PASSWORD` select the local review credentials:

```bash
BAGREDEX_PORT=8080 \
BAGREDEX_REVIEW_USERNAME=reviewer \
BAGREDEX_REVIEW_PASSWORD='local-review-password' \
./bagredex.sh review
```

The credentials are deliberately printed because this is an isolated loopback-only development
workflow with known defaults. The command never writes them to tracked files, Compose configuration,
the shell history itself, or production configuration. Callers remain responsible for how they set
environment variables in their shell.

Success and failure behavior is explicit:

- A missing tool, malformed port, empty credential override, missing or malformed data pin, failed
  build, unhealthy database, migration error, load error, activation error, or account update error
  stops before the application is presented as ready and returns nonzero.
- The URL and credentials are printed only after every initialization step succeeds.
- Normal interruption and failures stop and remove containers in the `bagredex-local` Compose
  project through the existing cleanup pattern. Cleanup never passes `--volumes`; the named
  `bagredex-local-database` volume and its accounts and loaded data remain.
- Repeating the command rebuilds current code and assets, reapplies safe migrations, recognizes an
  identical loaded bundle, explicitly selects the pinned bundle, and resets the chosen user's
  privileges and password to the declared review values.

## Decisions and assumptions

- This is a development convenience command and is not reachable through production scripts,
  Compose overlays, images, or services.
- The existing `compose_local` wrapper, frontend install/build helpers, development image, database
  health check, network, loopback port mapping, and named volume remain authoritative. Shared shell
  logic should be factored only enough to avoid behavioral drift between `run` and `review`.
- `deploy/pokemon-data.env` is the single source of the reviewed bundle identifier, matching the
  production pin. The command does not discover the newest directory or accept an independent
  command-line bundle argument.
- The environment file must contain exactly one usable `BAGREDEX_POKEMON_DATA_VERSION` assignment
  in the existing simple identifier format. It is repository-controlled input, but parsing must not
  execute arbitrary shell content. The resulting value is restricted to the canonical bundle
  identifier character set before it enters a path or command argument.
- `BAGREDEX_PORT` defaults to `8000` and must be an integer from 1 through 65535. Compose continues
  publishing only `127.0.0.1:<port>:8000`; the review command must not change the bind address.
- Review username and password default only when their variables are unset. Explicit empty values
  are errors. The username is passed as data to Django's user model rather than interpolated into
  executable Python or shell. The password is supplied through a process environment boundary and
  read as data; it is never embedded in generated source or a command string.
- The account operation uses Django's configured user model and an ORM `update_or_create`-style
  transaction followed by `set_password`. It preserves the row identity for an existing username,
  sets `is_active`, `is_staff`, and `is_superuser` true, and does not delete or demote other local
  users. No backend source change is needed; deployment-owned automation may invoke Django through
  a safely quoted management-shell adapter.
- Explicit activation is intentional for review. Unlike production's first-bootstrap `--if-none`,
  a retained local database pointing at an older version is switched to the pin from the current
  checkout on every run.
- The repository already contains every required image and dependency input for the normal local
  workflow. Agents perform no pull, install, login, Git remote operation, external call, or other
  network access while implementing or validating this feature.
- An Incus system container has its own loopback namespace. Documentation gives a human-operated
  proxy-device example, conceptually:

  ```bash
  incus config device add <container> bagredex-review proxy \
    listen=tcp:127.0.0.1:<host-port> connect=tcp:127.0.0.1:<container-port>
  ```

  `<container-port>` must equal `BAGREDEX_PORT` used inside the container. Operators choose the
  container name and host port, run the command on the Incus host, and remove the device with
  `incus config device remove <container> bagredex-review` afterward. This is guidance only: the
  Bagredex script never invokes Incus, changes a firewall, or exposes a non-loopback listener.

## Scope and ownership

### Deployment agent

Own all implementation, tests, and user documentation for this feature:

- `bagredex.sh` for the `review` command, validation, ordered orchestration, output, foreground
  attachment, and cleanup behavior;
- `deploy/scripts/**` only if a small deployment-owned helper makes credential handling or testing
  materially safer than inline shell;
- `deploy/compose.local.yaml` only if the existing local environment cannot support the workflow
  without a focused local-only adjustment;
- `deploy/tests/**` for Bats coverage of dispatch, ordering, validation, credential handling,
  failure propagation, idempotent intent, cleanup, and volume preservation;
- deployment-facing `README.md` or `deploy/README.md` sections for usage, configuration, security
  boundary, retained state, and Incus proxy guidance.

The deployment agent also owns final local validation and all local Git mutations. It must preserve
concurrent backend and Web GUI edits and must not change application source under `src/backend`,
`src/web`, or `src/data`.

### Architect

Own this plan, integration review, and `docs/reports/2026-10-16-local-review-command.md`. The
architect does not implement the shell workflow or mutate Git.

No backend, Web GUI, or Pokémon data coder is required. If implementation demonstrates that an
application change is unavoidable, stop and return the evidence to the architect instead of
crossing ownership boundaries.

## Data and interface impact

- The public shell interface gains one zero-argument command: `./bagredex.sh review`. Extra
  positional arguments print usage and return nonzero, matching existing commands.
- The environment interface gains `BAGREDEX_REVIEW_USERNAME` and `BAGREDEX_REVIEW_PASSWORD` for
  this command only. `BAGREDEX_PORT` retains its existing local Compose meaning.
- The workflow consumes the existing `BAGREDEX_POKEMON_DATA_VERSION` pin and existing Django
  management commands. It does not define another data-version source.
- The local database may gain or update the named review user, migration state, loaded immutable
  data version, active-version pointer, and activation audit through supported Django interfaces.
  These are expected local effects and persist in `bagredex-local-database`.
- No schema, endpoint, template, frontend bundle, production Compose configuration, production
  image behavior, or deployment protocol changes.

## Implementation sequence

1. Add focused Bats fixtures/mocks that capture command arguments and ordering without contacting a
   registry or starting unrelated containers.
2. Refactor only reusable local orchestration needed by both commands, then implement `review` with
   early input validation, pinned-version parsing, frontend and image builds, database startup,
   migration, load, explicit activation, safe user creation/update, ready output, foreground attach,
   and cleanup traps.
3. Update command help and local deployment documentation, including overrides, known-default
   credential warning, volume persistence, explicit activation difference, and Incus proxy setup
   and removal.
4. Run syntax, ShellCheck, documentation lint, Bats, and safe local smoke validation. Fix ordinary
   findings within deployment ownership.
5. The architect reviews the full diff for scope, command ordering, input injection, credential
   exposure, failure behavior, cleanup, volume retention, production isolation, tests, and docs.
   Findings return to the deployment agent until no blockers remain.
6. The architect writes the concise cycle report. The deployment agent runs final checks, stages
   only reviewed feature files, and creates the justified local commit without a remote operation.

## Review and verification

- Bats tests prove `review` is advertised, rejects arguments, requires the expected tools, and
  validates port, nonempty credentials, data-pin presence, and identifier shape before mutation.
- Command-capture tests prove frontend install/build and verification precede the development image
  build; database health precedes migration; migration precedes load; load uses exactly
  `/app/src/data/releases/<pinned-version>`; load precedes explicit activation; activation omits
  `--if-none`; account setup follows activation; and readiness output precedes foreground attach.
- Account tests prove defaults, safe override transport, create/update intent, password hashing via
  `set_password`, required privilege flags, and failure propagation without evaluating credentials
  as shell or Python source.
- Cleanup tests cover normal exit, `SIGINT`, and initialization or server failure. They prove cleanup
  targets only the fixed `bagredex-local` project and never uses `--volumes`, `volume rm`, pruning,
  or another destructive operation.
- Documentation tests or assertions cover the three environment variables, known local defaults,
  loopback-only URL, pinned explicit activation, retained named volume, and Incus proxy-device add
  and remove guidance.
- Run `.codex/lint.sh`, `bash -n bagredex.sh`, ShellCheck on every changed shell file, the complete
  `deploy/tests` Bats suite, and `git diff --check`.
- If all referenced Podman images are already local and local Podman permission is available, run a
  safe smoke on the fixed Bagredex local project: start `review`, observe successful build,
  migration, load, activation, user provisioning, printed URL, authenticated sign-in and Pokédex,
  interrupt it, rerun it to confirm idempotency, and verify the named database volume remains. The
  deployment agent may use the repository-approved exact local Podman elevation path if sandboxing
  alone blocks this check. Otherwise report the precise smoke step not run; never pull an image or
  weaken configuration to force it.

## Risks

- A known default superuser password is unsafe beyond local review. Loopback-only publication,
  explicit documentation, configurable overrides, and complete production isolation are mandatory.
- Shell or Python interpolation of credential values could create injection or accidental logging.
  Treat both as opaque environment data, quote every shell expansion, and test metacharacter values.
- A retained volume can contain an older active version or account state. Explicit activation and
  deterministic user update make the review outcome match the current checkout without erasing
  unrelated local state.
- Cleanup bugs could delete persistent review data or affect another Podman project. Use the fixed
  Compose project wrapper and ordinary `down` without volume flags; test the exact calls.
- An Incus proxy can outlive a review session or bind more broadly than intended. Documentation uses
  a named device, host loopback listener, explicit removal, and leaves the operation entirely under
  the human operator's control.

## Completion criteria

- `./bagredex.sh review` performs the complete ordered local initialization, prints truthful access
  details, and remains attached until interruption.
- Defaults and all three supported environment overrides behave as documented and reject malformed
  or explicitly empty values safely.
- The bundle pinned by `deploy/pokemon-data.env` is idempotently loaded and explicitly active before
  readiness is announced; the configured local user can authenticate as a superuser.
- Repeated runs are safe, failures return nonzero, cleanup affects only review containers, and the
  named local database volume is preserved.
- User documentation covers ordinary use, security boundaries, retained state, and loopback access
  through a human-managed Incus proxy.
- No production behavior, application source, data schema, dependency set, or external system is
  changed or contacted.
- Shell syntax, ShellCheck, documentation lint, complete Bats tests, diff checks, and the safe local
  smoke when available pass with observed outcomes recorded in the report.
- Architect review has no blocking findings, the cycle report exists, and the deployment agent
  reports the final local commit.

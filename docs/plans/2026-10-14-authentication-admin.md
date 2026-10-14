# Authentication and Django admin

## Summary

Add Bagredex's first persistent system feature: a project-owned Django user model, username and
password login, POST-only logout, a default-authenticated application shell, and the standard
Django admin with light Bagredex branding. Introduce PostgreSQL for users, permissions, and
sessions, while keeping liveness public and dependency-free and making readiness prove database
connectivity.

Nginx will rate-limit POST attempts to the Bagredex and Django admin login endpoints per client IP.
Production deployment will start PostgreSQL, apply migrations before starting the new application,
and retain the database volume independently from immutable application releases.

## Goals

- Require authentication for every ordinary Bagredex page, including `/`, and redirect anonymous
  requests to `/login/` with the original local destination in `next`.
- Provide `/login/` and `/logout/` using Django authentication, CSRF protection, and only username
  and password credentials.
- Define `accounts.User` as a project-owned `AbstractUser` subclass before any application data
  migrations depend on Django's user model.
- Preserve the standard username, password, first name, last name, and email fields without adding
  profile fields.
- Enable the standard Django admin at `/admin/` for active staff users, with normal superuser and
  model-permission behavior and simple Bagredex site text.
- Persist users, permissions, admin logs, and sessions in PostgreSQL in local and production
  container workflows.
- Persist sessions across browser restarts for Django's default two-week lifetime, without a
  remember-me control.
- Show an authenticated application header with the user's first name when non-empty, otherwise
  their username, and a POST logout control.
- Rate-limit authentication POSTs to `/login/` and `/admin/login/` at 10 requests per minute per
  client IP with a burst allowance of 5.
- Document the human-run production command for creating the first superuser inside the running
  application container and the admin workflow for creating later users.

## Non-goals

- Public or invitation-based signup, account activation, or user self-registration.
- Social login, passkeys, email login, multifactor authentication, single sign-on, or external
  identity providers.
- A forgot-password link, password-reset routes, password-reset email, or outbound email setup.
- A profile or account page, profile fields, avatars, or user-editable personal details.
- A remember-me choice or a custom session-duration policy.
- Custom admin templates, custom admin styling, or replacing Django's permission model.
- A Preact island, Vite setup, client-side form validation, or a Django authentication dependency.
- Automated database backups, point-in-time recovery, or schema downgrade automation. These need a
  separate persistence-operations feature before Bagredex stores irreplaceable user content.

## User-visible behavior

- An anonymous `GET /` redirects to `/login/?next=/`. Future ordinary Django views are protected by
  default rather than relying on each view author to remember a decorator.
- `GET /login/` renders an accessible Django form with username and password fields. Invalid
  credentials produce a generic inline error and do not reveal whether a username exists.
- A successful login redirects to a safe same-origin `next` path when one was submitted. Missing,
  malformed, external-host, or insecure cross-scheme destinations fall back to `/`.
- An authenticated request to `/login/` redirects to `/` rather than rendering the form.
- Logout is a CSRF-protected `POST /logout/`. It deletes the authenticated session and redirects to
  `/login/`; `GET /logout/` and other unsupported methods do not log the user out.
- The session cookie survives browser restart and expires after 1,209,600 seconds. Production
  retains its secure-cookie settings.
- Authenticated pages show a header containing Bagredex, the user's first name or username, and a
  logout button. The login page does not show signed-in controls.
- `/admin/` uses Django's standard login and administration behavior. Only active `is_staff` users
  enter the admin; active non-staff and inactive users cannot. Superusers retain all standard
  permissions.
- The admin site header and browser title identify Bagredex, but its templates and stylesheet stay
  unmodified.
- `/health/live` and `/health/ready` remain reachable without authentication. Liveness reports a
  loaded web process without accessing PostgreSQL. Readiness returns `200` only after a trivial
  PostgreSQL query succeeds and returns `503` with a non-sensitive JSON status when it does not.
- Static assets remain publicly served by Django's development static handler locally and directly
  by Nginx in production.
- Nginx counts only POST requests to the exact `/login/` and `/admin/login/` paths against the
  per-client-IP authentication zone. Requests beyond 10 per minute plus the configured burst
  receive `429`; GET requests for either form do not consume the limit.
- There is no signup or password-reset link. Administrators recover accounts and create later users
  through `/admin/`.

## Decisions and assumptions

- Use Django's built-in auth, admin, content types, messages, and database-backed sessions. Add only
  the PostgreSQL driver required for persistence; do not add an authentication package.
- Create `bagredex.accounts.User(AbstractUser)` with no extra fields and set
  `AUTH_USER_MODEL = "accounts.User"`. Its initial migration must be present before any other
  Bagredex model references users. There is no legacy user data to migrate.
- Register the custom user with Django's standard `UserAdmin`, preserving the standard add/change,
  password, group, permission, staff, active, and superuser controls.
- Use Django 5.2's `LoginRequiredMiddleware` after authentication middleware. Django's login view,
  the admin login view, and explicitly decorated health views are the only application-level
  anonymous exceptions. Admin wrappers keep their own `/admin/login/` destination.
- Use Django `LoginView` with `redirect_authenticated_user=True` and `LogoutView` with a login-page
  success destination. Rely on Django's redirect allow-list and secure-request checks instead of
  parsing `next` in template or custom application code.
- Configure `LOGIN_URL`, `LOGIN_REDIRECT_URL`, and `LOGOUT_REDIRECT_URL` with named local routes.
  Keep `SESSION_COOKIE_AGE = 1209600` and `SESSION_EXPIRE_AT_BROWSER_CLOSE = False` explicit so the
  agreed session behavior is protected by settings tests.
- Keep Django's standard password validators and password hashing. Account recovery is an
  administrator operation, but administrators may still use standard Django admin password-change
  behavior after signing in.
- Use PostgreSQL for development, tests, and production rather than introducing a SQLite-only
  alternate behavior. The deployment agent will pin a supported PostgreSQL image to an exact
  version available to the local toolchain; agents must not pull it merely to satisfy validation.
- The stable database configuration interface is `BAGREDEX_DATABASE_NAME`,
  `BAGREDEX_DATABASE_USER`, `BAGREDEX_DATABASE_PASSWORD`, `BAGREDEX_DATABASE_HOST`, and
  `BAGREDEX_DATABASE_PORT`. Local Compose supplies development-only values. Production requires all
  five through `shared/.env`; examples contain obvious replacement values, never real secrets.
- The PostgreSQL service is internal-only and publishes no host port. A named volume owns its data
  independently of release directories, application image versions, and ordinary Compose `down`.
  No script may use `down --volumes` or otherwise delete that volume.
- Readiness executes a minimal `SELECT 1` and catches database availability errors without logging
  credentials or exception details to the client. Liveness stays database-independent so operators
  can distinguish a running process from a usable application.
- Before switching a production release, start the database, wait for its container health check,
  and run `python manage.py migrate --noinput` from the new application image. Migration failure
  leaves the current release serving. Schema migrations are not reversed during application
  rollback; this initial additive auth schema is compatible with the preceding database-free
  release, and future plans must preserve expand/contract compatibility.
- The first production deployment may complete before a human creates the first account. Until the
  documented `python manage.py createsuperuser` command is run in the production server container,
  ordinary pages remain correctly protected but no user can sign in.
- Implement the Nginx limit with a shared zone keyed from `$binary_remote_addr` only for POST
  requests, `rate=10r/m`, `burst=5`, and `limit_req_status 429`. Do not trust a caller-supplied
  forwarding header as the key. Nginx continues to set `X-Forwarded-For` for Django diagnostics.
- Public application browsing remains HTTPS-only in production. The existing proxy-aware secure
  request, CSRF, HSTS, allowed-host, and secure-cookie policies remain in force.
- Configure uv persistently in the backend project's `pyproject.toml` to use the repository-root
  `.cache/uv` directory (the backend-relative path is `../../.cache/uv`). The directory is already
  ignored. This is the project's normal cache location, not a sandbox workaround; shell commands
  must not set `UV_CACHE_DIR` or add command-specific cache overrides.

## Scope and ownership

### Backend coder

Own only `src/backend`, including:

- `pyproject.toml` and `uv.lock` for the PostgreSQL driver without an auth package, including the
  persistent repository-root `.cache/uv` uv cache setting;
- `bagredex/accounts/` for the app configuration, custom user, admin registration, and initial
  migration;
- base, local, and production settings for contrib apps, middleware, templates, password
  validation, sessions, auth redirects, custom user, and PostgreSQL;
- `bagredex/urls.py` and thin auth/health view configuration;
- backend request, settings, model, admin, readiness, and migration tests.

The backend coder must not edit templates, CSS, Compose, Nginx, shell automation, or deployment
documentation. The owner supplies the Web GUI coder with the auth route names, form context, and
authenticated-user contract, and supplies the deployment agent with database setting names,
readiness semantics, and the required migration command.

### Web GUI coder

Own only `src/web`, including:

- `templates/base.html` for the authenticated header and CSRF-protected logout form;
- a server-rendered login template at `templates/registration/login.html`;
- `static/web/css/site.css` for the login form, header, errors, responsive states, and existing
  light/dark token system.

The Web GUI coder must use the Django authentication form supplied by the backend, render any safe
`next` value as a hidden field, and avoid JavaScript. It must not customize Django admin templates
or static files.

### Deployment agent

Own `bagredex.sh`, `deploy/**`, deployment-facing updates to `README.md`, final local validation,
and all local Git mutations. Expected work includes:

- a pinned PostgreSQL service, health check, private application network, persistent named volume,
  and local/production environment mapping in the Compose files;
- a development container target or equivalent reproducible Compose test path containing the
  locked development tools, while keeping the production application image runtime-only;
- removal of per-command `UV_CACHE_DIR` handling from `bagredex.sh`, with every host and container
  uv invocation relying on the backend project's persistent configuration;
- production preflight validation for all database variables and documentation of volume
  persistence and secret handling;
- release-worker sequencing for database startup, health, migrations, readiness, and rollback that
  never deletes or attempts to reverse the database volume;
- Nginx POST-only client-IP rate limiting for the two exact login endpoints, with deterministic
  configuration tests;
- command and deployment tests covering database lifecycle, migration failure before release
  switch, volume retention, and rate-limit configuration;
- deployment documentation for local migrations, the first production superuser command, later
  admin-created users, and the current absence of automated backups.

The deployment agent must not create a superuser, put account credentials into configuration, run
production commands, contact a registry or host, or alter files under `src/backend` or `src/web`.

### Reviewers and architect

- `backend_reviewer` reviews `src/backend` without editing it, emphasizing migration correctness,
  authentication and authorization, redirect safety, CSRF, settings, and failure behavior.
- `web_gui_reviewer` reviews `src/web` without editing it, emphasizing semantic forms, error
  association, focus, autocomplete, responsive layout, theme contrast, and logout behavior.
- The architect reviews the complete local diff and reviewer results for database, route, template,
  readiness, migration, proxy, and deployment-contract consistency without editing implementation.
- The architect owns the final report under `docs/reports`; the deployment agent owns final checks,
  staging, and one or more justified local commits.
- No Pokémon data agent is involved because this feature does not change `src/data` or normalized
  Pokémon data.

## Data and interface impact

PostgreSQL becomes a required runtime dependency. Django migrations create the standard content
type, permission, group, session, admin log, and custom `accounts_user` tables plus the custom
user's standard many-to-many relations. The schema contains authentication metadata and personally
entered names/email, so logs, fixtures, examples, and test output must not expose real credentials
or private data.

The HTTP contract becomes:

- `/`: authenticated server-rendered home; anonymous requests redirect to login;
- `/login/`: anonymous GET form and POST authentication; authenticated users redirect home;
- `/logout/`: authenticated, CSRF-protected POST logout only;
- `/admin/`: standard Django admin with its own login and active-staff authorization;
- `/health/live`: public dependency-free liveness JSON;
- `/health/ready`: public to the Compose network, database-aware readiness JSON, still blocked by
  production Nginx;
- `/static/`: public assets served outside the authenticated Django page boundary.

The template contract provides `request.user` through Django's auth context processor. The header
uses `get_short_name()` when it returns a value and otherwise `get_username()`. The login template
receives Django's bound authentication form and `next`; it does not duplicate credential checking
or redirect validation.

Production `shared/.env` adds the five `BAGREDEX_DATABASE_*` values. Compose maps name, user, and
password into PostgreSQL initialization variables and passes all five values to Django. Changing
database identity values after volume initialization is not a credential-rotation mechanism and
must be documented as an operator-managed database change.

The named PostgreSQL volume survives releases, rollbacks, restarts, and normal stack shutdown.
Application rollback changes images and release links only. No Pokémon data version or import
interface changes in this cycle.

## Implementation sequence

1. Backend coder first configures the backend project to place uv's cache at repository-root
   `.cache/uv`, then adds the custom user app and initial migration and enables Django contrib apps,
   middleware, context processors, password validators, PostgreSQL settings, and explicit
   auth/session settings. Add migration and settings tests before later Bagredex models can land.
2. Backend coder wires admin branding, `/admin/`, `/login/`, and `/logout/`; marks only health views
   anonymous; makes readiness database-aware; and adds behavioral tests for every access boundary,
   redirect, session, and admin permission decision.
3. After the backend publishes the route names and form/user context contract, Web GUI coder updates
   the base shell, creates the login template, and extends plain CSS. This can overlap with
   remaining backend tests once that interface is fixed.
4. Deployment agent may prepare independent PostgreSQL Compose and Nginx rate-limit changes in
   parallel after the database variable and endpoint contracts are fixed. The agent then integrates
   the completed backend migration/readiness behavior into local commands and production release
   sequencing.
5. Deployment agent removes command-local uv cache overrides, then updates deployment tests and
   documentation, including a human-run first-admin procedure. Prove that migration failure occurs
   before the release switch and that normal stop, failed deployment, and rollback paths preserve
   the database volume.
6. Backend coder runs all non-container checks and database tests available in its environment.
   Deployment agent runs the Compose-backed PostgreSQL test path when required images are already
   local. Owners fix ordinary failures in only their scopes.
7. Backend and Web GUI reviewers inspect their respective complete changes. The architect performs
   integration review after both reviews, reading the full deployment diff and observed checks.
8. Return every actionable finding to its owner and repeat the matching review until no blocking
   findings remain. Do not defer a broken auth boundary, migration path, readiness check, or
   persistent-volume lifecycle.
9. Architect writes the cycle report. Deployment agent runs final checks, verifies complete and
   staged diffs, and creates the local cycle commit or commits without any Git remote operation.

## Review and verification

Backend verification must run through uv and include:

- inspection of uv's resolved cache directory from the backend project, proving it is the
  repository-root `.cache/uv` without `UV_CACHE_DIR` in the command environment;
- Ruff format and lint, strict mypy, and the complete pytest suite against PostgreSQL;
- `manage.py check` under local settings and `check --deploy --fail-level WARNING` with complete
  placeholder production and database variables;
- `manage.py makemigrations --check --dry-run` and a clean migration from an empty test database;
- custom-user metadata and manager behavior, standard fields, admin registration, and absence of
  extra profile fields;
- anonymous home redirect with encoded local `next`, authenticated home access, invalid login,
  valid login, session creation, two-week persistent-session settings, and authenticated login
  redirect;
- safe local `next` acceptance and rejection of absolute external, scheme-relative, malformed, and
  insecure cross-scheme redirect targets;
- POST logout success, CSRF enforcement, unsupported logout methods, and post-logout access;
- public health access, dependency-free liveness, readiness success, and a controlled `503` when
  PostgreSQL is unavailable;
- admin login destination, active staff access, active non-staff denial, inactive-user denial,
  superuser permissions, user administration, and exact Bagredex branding values;
- route absence for signup and password reset, without asserting irrelevant Django internals.

Web GUI review must verify:

- explicit labels, username and current-password autocomplete tokens, generic form errors, a
  logical heading structure, autofocus/focus visibility, and keyboard submission;
- a hidden `next` value that is rendered safely and never interpreted by client code;
- a semantic POST logout form with CSRF token and a clear accessible name;
- first-name/username fallback, signed-in header presence only for authenticated pages, and usable
  layout with CSS unavailable;
- light and dark themes, contrast, reduced motion, desktop and tablet presentation, and functional
  phone fallback. No Preact, browser package, or component test harness is introduced.

Deployment verification must include:

- `.codex/lint.sh`, `bash -n`, ShellCheck, Bats, and `git diff --check`;
- a deterministic shell test proving `bagredex.sh` does not export or inject `UV_CACHE_DIR` and
  delegates cache selection to the backend project configuration;
- resolved local and production Compose configurations with placeholder secrets, a private healthy
  PostgreSQL service, no published database port, and an explicitly named persistent volume;
- deterministic tests that ordinary shutdown and rollback commands omit volume deletion;
- script tests proving database startup and health precede migrations, migrations precede release
  switching, and migration failure leaves the current release active;
- static assertions for a POST-only `$binary_remote_addr` limit key, `10r/m`, `burst=5`, status 429,
  and exact `/login/` and `/admin/login/` application;
- Nginx configuration validation and a rate-limit smoke test if the required local image and TLS
  harness are already available; otherwise report that limitation without pulling an image;
- a Compose-backed empty-database migration and backend test run, application login smoke test,
  database-aware readiness, database-restart session persistence, and first-superuser command
  validation without creating production credentials;
- a production migration/rollback simulation using stubs only, with no registry, SSH, Certbot,
  systemd, or operational-service contact;
- complete-diff and staged-diff inspection before the local commit.

If a required host tool, cached dependency, PostgreSQL image, Nginx image, or local Podman
capability is absent, report the exact unrun check. Agents must not download tools or pull images to
make validation pass.

## Risks

- A custom user model is expensive to introduce after other migrations exist. Creating it now and
  testing migration order prevents later foreign-key replacement work.
- PostgreSQL changes the application from stateless to stateful. The persistent volume prevents
  release cleanup from deleting users, but it is not a backup; host or volume loss remains a
  documented residual risk until a separate backup feature is approved.
- Django application rollback cannot generally reverse a schema migration safely. This cycle is
  additive and compatible with the prior release, but future schema plans must use compatible
  staged migrations and explicitly assess rollback.
- Misordered middleware can break request users, messages, CSRF, or default protection. Settings
  tests and request-level tests must assert the security-relevant order and observable results.
- An unsafe `next` implementation could create an open redirect. Redirect selection remains in
  Django's tested auth view and receives adversarial request tests.
- Login rate limiting is per observed client IP and process-shared Nginx zone, not per account or a
  substitute for stronger abuse controls. Shared NAT clients can affect one another, and multiple
  independent Nginx hosts would not share counters.
- PostgreSQL initialization variables apply only to a new data directory. Documentation must not
  imply that editing the environment rotates credentials in an existing volume.
- The first deployment intentionally has no usable login until the human creates a superuser.
  Health checks must not depend on an account, and the documented bootstrap command must be clear.

## Completion criteria

- A clean PostgreSQL database migrates successfully with the project-owned `accounts.User` and all
  required Django contrib tables; no pending model changes remain.
- Backend uv commands consistently resolve their cache to repository-root `.cache/uv` through
  project configuration, with no per-command environment override.
- Anonymous ordinary pages redirect to `/login/`, public health/static behavior remains correct,
  and authenticated page, login, safe redirect, session, and POST logout behavior match this plan.
- The authenticated header and accessible login form work across supported themes and viewport
  sizes without JavaScript.
- Django admin is available at `/admin/`, uses Bagredex text with standard styling, and enforces
  active-staff and normal Django permission rules for the custom user.
- PostgreSQL is internal, healthy, persistent across normal stop and rollback, configured through
  the documented production interface, and checked by readiness without affecting liveness.
- Production sequencing applies migrations before release switching, fails safely on migration
  errors, and never automatically reverses schema or deletes the database volume.
- Nginx applies the agreed POST-only 10-per-minute, burst-5 client-IP limit to both exact login
  endpoints and returns 429 when exceeded.
- Deployment documentation accurately explains secrets, persistence, migration behavior, the
  human-run first-superuser command, admin-created users, rollback limits, and the backup gap.
- Backend, Web GUI, deployment, and architect integration reviews report no unresolved blocking
  findings, and all runnable required checks pass with any environment-limited checks named.
- The cycle report records the observed outcome and checks, and the deployment agent creates and
  reports the local feature commit or commits without any Git remote operation.

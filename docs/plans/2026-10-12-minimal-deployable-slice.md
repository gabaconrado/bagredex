# Minimal deployable slice

## Summary

Create Bagredex's first deployable end-to-end slice: a database-free Django application that serves
a styled placeholder page, plus rootless Podman packaging, local execution, image publication, and
rollback-capable production deployment derived from the local Penni More model.

The application surface is deliberately small, but the delivery path is real. A user can run the
same application image shape locally, publish stable versioned application and Nginx images, deploy
them behind Nginx and Let's Encrypt, and recover the previous release automatically when health
verification fails.

## Goals

- Serve `/` as accessible, server-rendered HTML with `Bagredex` as the page title and visible
  heading, and `Coming soon` as the body message.
- Establish a uv-managed Django project with reproducible locked dependencies and production
  Gunicorn execution.
- Provide dependency-free liveness and readiness endpoints for containers and release automation.
- Provide a responsive plain-CSS presentation with light and dark colors selected from the
  operating-system preference and Indigo Purple as the primary accent.
- Run the local containerized server in the foreground at `http://127.0.0.1:8000` through
  `./bagredex.sh run`; `Ctrl+C` must stop the local stack.
- Publish stable semantic versions of separate application and Nginx images for `linux/amd64`.
- Deploy timestamped releases to a rootless Podman host with one-domain TLS, serialized deployment,
  health verification, automatic rollback, and `current`/`previous` release retention.
- Document local prerequisites, command behavior, production host preparation, environment
  configuration, first TLS bootstrap, certificate renewal, deployment, rollback behavior, and the
  boundary between agent validation and human-run remote operations.

## Non-goals

- PostgreSQL, SQLite, Django models, migrations, database volumes, database probes, or backups.
- Django admin, authentication, content types, sessions, messages, or other database-backed apps
  and middleware.
- Vite, Preact, TypeScript, Node.js dependencies, browser-side state, or a manual theme switch.
- Pokémon data, team building, damage calculation, accounts, APIs, or user-authored persistence.
- A `latest` image tag, remote Git tags, Git pushes, CI/CD, multi-domain certificates, `www`
  aliases, wildcard certificates, HSTS preload, or subdomain HSTS.
- Automated host provisioning, package installation, firewall changes, SSH hardening, DNS changes,
  Podman registry credentials, or initial systemd enablement.

## User-visible behavior

- `GET /` returns `200` and renders a semantic page whose document title and main heading are
  `Bagredex` and whose main content contains `Coming soon`.
- The page fits desktop and tablet viewports without overflow and remains legible and functional at
  phone widths. It has a visible focus treatment if focusable elements are introduced, honors
  reduced-motion preferences, and does not require JavaScript.
- The palette follows `prefers-color-scheme`; there is no stored preference or theme control.
  Semantic CSS tokens provide both palettes, with contrast-safe Indigo Purple accent values chosen
  independently for light and dark backgrounds.
- `GET /health/live` and `GET /health/ready` return `200` JSON with `{"status": "ok"}`. Other HTTP
  methods are rejected. Both are dependency-free in this database-free slice; readiness means the
  Django process loaded its configuration and can serve requests.
- `./bagredex.sh run` builds and attaches to the local Compose server on loopback port 8000. It
  accepts no production configuration, and an interrupt stops the foreground stack and leaves no
  running Bagredex local container.
- In production, HTTP serves the ACME challenge path and redirects all other requests to the same
  host over HTTPS. HTTPS serves static assets and proxies application requests. Only the exact
  `BAGREDEX_DOMAIN` receives configuration and a certificate.
- Public production liveness is available at `/health/live`. Nginx does not expose
  `/health/ready`; readiness remains an orchestration interface inside the Compose network.

## Decisions and assumptions

- Use Python 3.14, Django 5.2, Gunicorn, uv, and the repository's existing toolchain direction.
  Dependency constraints and `uv.lock` must be committed; implementation may use only already
  available local tools and cached project dependencies during agent-run validation.
- Keep `django.contrib.staticfiles`, because the stylesheet is collected into the Nginx image. Do
  not install database-backed Django contrib apps. Configure no default database connection rather
  than silently falling back to SQLite, and ensure no runtime path creates `db.sqlite3`.
- Separate local and production settings. Production requires `DJANGO_SECRET_KEY`,
  `BAGREDEX_DOMAIN`, and `BAGREDEX_IMAGE_VERSION`, accepts only stable `MAJOR.MINOR.PATCH` image
  versions, trusts only the configured host and HTTPS origin, and enables Django's proxy-aware
  HTTPS and security settings. Start HSTS at a documented configurable value of 300 seconds,
  without subdomains or preload.
- Keep Django templates and CSS in `src/web`, referenced by Django settings under `src/backend`.
  This is the cross-scope contract: the backend renders `home.html`, static collection consumes
  `src/web/static`, and the Nginx image serves the collected `/static/` tree.
- Use one multi-stage `deploy/Containerfile` with `application` and `nginx` targets. The application
  runs as a fixed unprivileged user; the production Compose service is read-only apart from an
  explicit temporary filesystem. Nginx also runs unprivileged internally and binds host ports 80
  and 443 through rootless Podman.
- Adapt Penni More's base/local/production Compose split without its database or API documentation
  services. The local overlay builds `application`, runs Django's development server, and publishes
  only `127.0.0.1:8000`. Production selects both images by one required stable version.
- `./bagredex.sh publish VERSION` targets
  `docker.io/gabaconrado/bagredex:VERSION` and
  `docker.io/gabaconrado/bagredex-nginx:VERSION`. It requires a clean `main`, runs the complete
  local validation, creates or reconciles an annotated local `vVERSION` tag at the validated
  commit, builds both `linux/amd64` targets, and pushes the application image before the Nginx
  image. It creates neither a `latest` tag nor a remote Git tag. Repeating the same version is the
  documented recovery for a partial two-image publication.
- `./bagredex.sh deploy VERSION [--dry-run]` requires a clean `main`, an annotated local
  `vVERSION` pointing at `HEAD`, and safe deployment identifiers. It defaults to SSH alias
  `bagredex` and `/home/bagredex/bagredex`, overridden independently by `DEPLOY_SSH_TARGET` and
  `DEPLOY_REMOTE_DIR`. A dry run performs remote read-only preflight only.
- Release IDs combine a UTC timestamp and the short commit. Production stores releases under
  `releases/`, stable environment state under `shared/`, and symlinks `current` and `previous`.
  Deployments use a nonblocking host lock, pull both images before mutation, retain only the active
  and previous releases after success, and record version and commit metadata per release.
- Once production mutation begins, any startup, internal readiness, certificate, Nginx, or public
  liveness failure stops the failed release and restores the previous symlink and previous images.
  On a first deployment there is no prior release to restore, so the failed stack remains stopped
  and `current` must not point at it. There is no data rollback concern in this slice.
- Adapt Penni More's Certbot webroot bootstrap, twice-daily systemd user renewal timer, certificate
  volume permissions, and Nginx reload. The production account needs lingering and permission for
  rootless processes to bind ports 80 and 443. Scripts never invoke `sudo`.
- Agents implement and validate only local behavior. They do not log in to Docker Hub, push images,
  open SSH connections, transfer releases, contact the VPS, bootstrap certificates, or enable
  remote systemd units. Those commands are documented for the user to invoke.

## Scope and ownership

### Backend coder

Own all files under `src/backend`, including:

- `pyproject.toml` and `uv.lock` with the smallest runtime and development dependency set;
- `manage.py`, the `bagredex` Django package, base/local/production settings, URL routing, WSGI, and
  thin home and health views;
- request, settings, and configuration tests.

The backend coder must not create a model, migration, SQLite file, database dependency, or file
under `src/web` or `deploy`.

### Web GUI coder

Own all files under `src/web`, including the base/home templates and plain stylesheet. This owner
implements the responsive semantic page, CSS tokens, operating-system light/dark themes, Indigo
Purple accent, and accessibility details. No package manifest or browser build is needed in this
cycle.

The Web GUI coder depends on the architect-defined template/static contract but can work in
parallel with the backend coder after agreeing the template name and stylesheet path.

### Deployment agent

Own `bagredex.sh`, all files under `deploy`, deployment-facing sections of `README.md`, final local
validation, staging, tagging behavior implementation, and the cycle commit. Expected deployment
assets include:

- base, local, and production Compose files and the multi-target Containerfile;
- Nginx base configuration, production and ACME-bootstrap templates, and entrypoint;
- publication, deployment, remote preflight, serialized release worker, production start/stop,
  certificate bootstrap, and certificate renewal scripts;
- production environment example without database variables;
- Bagredex application and Certbot systemd user service/timer files;
- shell/deployment tests and `deploy/README.md`.

The deployment agent must not execute user-only registry, SSH, certificate, or production commands.
Only this owner may perform the planned local Git mutations.

### Reviewers and architect

- `backend_reviewer` reviews `src/backend` without editing it.
- `web_gui_reviewer` reviews `src/web` without editing it.
- The architect reviews the complete diff and reviewer results for cross-scope contracts, then owns
  the cycle report under `docs/reports`.
- No Pokémon data agent is needed because this cycle does not touch `src/data`.

## Data and interface impact

There is no durable application data and no database interface. The only HTTP interfaces are:

- `/`: public server-rendered placeholder HTML;
- `/health/live`: public process liveness JSON;
- `/health/ready`: internal dependency-free readiness JSON, blocked by production Nginx.

The stable configuration interface is:

- local optional `BAGREDEX_PORT`, defaulting to `8000` and bound to loopback;
- production `BAGREDEX_ENVIRONMENT=production`, `BAGREDEX_DOMAIN`,
  `BAGREDEX_EXPECTED_IP`, `LETSENCRYPT_EMAIL`, `DJANGO_SECRET_KEY`,
  `DJANGO_SECURE_HSTS_SECONDS`, and optional Gunicorn worker/thread counts;
- release-generated `BAGREDEX_RELEASE_ID`, `BAGREDEX_IMAGE_VERSION`, commit, and branch metadata;
- caller-side `DEPLOY_SSH_TARGET` and `DEPLOY_REMOTE_DIR` overrides.

Example files use reserved invalid domains, documentation IP ranges, and obvious replacement values;
they contain no credentials. Production secrets live only in `${DEPLOY_REMOTE_DIR}/shared/.env`,
outside timestamped releases.

## Implementation sequence

1. Backend coder creates the uv project, locked dependencies, database-free Django settings, routes,
   views, and backend tests. Confirm the agreed `home.html` and stylesheet paths with the Web GUI
   owner before handoff.
2. Web GUI coder creates the base and home templates and stylesheet against that contract. Backend
   and Web GUI implementation may proceed concurrently once paths are fixed.
3. Backend coder runs backend checks with the real Web GUI assets present and resolves integration
   defects in owned files; Web GUI coder does the same for template/style findings.
4. Deployment agent adapts the Penni More container and Compose structure, deleting all database,
   migration, backup, Node, and API-documentation behavior. Static collection bridges the Web GUI
   assets into the Nginx image.
5. Deployment agent implements `bagredex.sh` and support scripts, then adds deterministic shell
   tests for argument validation, command dispatch, local interrupt cleanup, version/tag guards,
   dry-run boundaries, remote release transitions, rollback, and first-release failure.
6. Deployment agent documents local use and the production lifecycle in `deploy/README.md`, and
   updates the top-level README status, layout, command entry point, and links without overstating
   unexecuted publication or deployment.
7. Matching reviewers inspect their scopes. The architect then reviews the complete change for
   template/static/settings/health/version/environment agreement and compliance with this plan.
8. Owners fix every actionable finding and repeat the relevant reviews until no blocker remains.
9. Architect writes the cycle report. Deployment agent runs final checks, inspects the complete and
   staged diffs, and creates one or more justified local commits. No remote Git operation occurs.

## Review and verification

Backend verification should run through uv and cover:

- Ruff format and lint, strict mypy, and pytest;
- Django `check` with local settings;
- Django `check --deploy --fail-level WARNING` with complete placeholder production variables;
- root-page status, template selection, exact title/heading/message, and GET-only health behavior;
- production required-variable failures, exact allowed host/origin, proxy HTTPS behavior, stable
  version validation, and the absence of configured database-backed apps and SQLite artifacts;
- `collectstatic --noinput` into a temporary output directory.

Web GUI review should verify semantic landmarks and heading order, stylesheet loading, contrast-safe
token pairs, visible content with CSS unavailable, light and dark operating-system preferences,
reduced motion, desktop/tablet layout, and functional phone fallback. Because this cycle has no
JavaScript toolchain or interaction, Playwright and component tests are deliberately not introduced.

Deployment verification should include:

- `.codex/lint.sh`, `bash -n`, ShellCheck, and Bats for all maintained shell behavior;
- resolved base/local and base/production Compose configurations using placeholder environment
  values, plus assertions that no database service or volume exists;
- Containerfile target/build validation and local Compose execution only when required base images
  are already available; agents must not pull from a registry to make a check pass;
- `./bagredex.sh run`, a loopback request proving the placeholder page, liveness, and readiness,
  and an interrupt proving the local container stops;
- safe stubbed tests proving publish/deploy command order and arguments without registry login,
  push, SSH, rsync, remote mutation, Certbot contact, or systemd changes;
- rollback tests proving the prior release and image version are restored after new-release health
  failure, and proving a failed first release does not remain active;
- `git diff --check`, complete-diff review, staged-diff review, and a clean status after the local
  commit.

Any check that cannot run because a host tool, cached dependency, base image, or local Podman
capability is absent must be reported accurately. Agents do not install, download, pull, or contact
an operational service to fill the gap.

## Risks

- The two public images cannot be pushed atomically. Ordered publication and idempotent reruns limit
  recovery complexity but do not eliminate a temporarily partial version.
- The first deployment cannot roll back when no previous release exists. The worker must fail closed
  with the bad release stopped and clear diagnostics.
- Rootless low-port binding and certificate directory ownership are host-specific. Preflight and
  deployment documentation must expose these requirements before production mutation.
- Nginx, Django, Compose, and release scripts share domain, image-version, health-path, and static
  path contracts. Cross-scope review must catch drift because a unit test in one scope may not.
- Agent restrictions may prevent a real image build or container run if images or dependencies are
  not already cached. Stubbed automation tests are necessary but do not replace the user's eventual
  publication and deployment smoke test.
- This slice deliberately has no persistence. Introducing PostgreSQL later requires a separate plan
  for database health, migrations, backups, and rollback semantics rather than silently extending
  these scripts.

## Completion criteria

- The root page and both health endpoints behave exactly as documented, and backend checks pass.
- The page uses semantic Django-rendered HTML and reviewed responsive light/dark CSS with an Indigo
  Purple accent, without JavaScript or frontend build dependencies.
- No database service, file, dependency, app, middleware, migration, volume, backup, or runtime
  access exists.
- `./bagredex.sh run` proves the local foreground Compose path and cleans up on interrupt, or a
  concrete environment limitation is reported with all safe fallback checks passing.
- Publish and deploy automation enforce stable versions, clean/tagged local state, exact image
  names, safe defaults and overrides, and the no-remote-agent boundary.
- Production assets define one-domain Nginx/Certbot TLS, systemd user startup and renewal, internal
  readiness, public liveness, timestamped releases, serialized mutation, and verified rollback.
- Backend, Web GUI, deployment, and integration review have no unresolved blocking findings.
- README and deployment documentation are consistent with implemented behavior and distinguish
  locally observed checks from user-only production steps.
- The cycle report records observed verification and residual gaps, and the deployment agent creates
  and reports the local feature commit without any Git remote operation.

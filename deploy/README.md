# Bagredex deployment

Bagredex runs as a Django application backed by PostgreSQL and served behind Nginx. Rootless Podman
Compose owns the application, private database network, Nginx, and on-demand Certbot containers.
Production releases are immutable directories with `current` and `previous` symlinks; a failed
release automatically attempts to restart the previous application release. PostgreSQL data lives
outside release directories in the named `bagredex-database` volume.

The application image contains every committed normalized Pokémon data release and its selected
normal and shiny WebP sprites. It does not contain `references` or the upstream Showdown and
PokeAPI repositories. `deploy/pokemon-data.env` pins the one reviewed bundle that deployment may
load; deployment never discovers a bundle by directory ordering.

The scripts in this directory support human-operated publishing and deployment. Project agents may
validate local behavior, but they do not log in to a registry, push images, open SSH connections,
contact Let's Encrypt, or modify a production host.

## Local run

Install the pinned Python and uv versions plus Podman with a Compose provider. Then run:

```bash
./bagredex.sh run
```

The command builds the development image, starts PostgreSQL, applies migrations, attaches to the
stack, and publishes the application only at `http://127.0.0.1:8000`. Press `Ctrl+C` to stop and
remove the containers. The database volume remains. Set `BAGREDEX_PORT` to choose another loopback
port.

Apply migrations without starting the web server when needed:

```bash
./bagredex.sh migrate
```

`./bagredex.sh check` runs backend, documentation, shell, and deployment tests. Backend tests run in
the development container against PostgreSQL. uv uses the ignored repository-root `.cache/uv`
directory configured in the backend project. The scripts never install missing host tools.

## Local review

Run a complete browser-review environment with the bundle pinned by `deploy/pokemon-data.env`:

```bash
./bagredex.sh review
```

The command builds the frontend and development image, starts PostgreSQL, migrates, loads and
explicitly activates the pinned bundle, and creates or updates this local-only superuser:

```text
URL:      http://127.0.0.1:8000/
Username: admin
Password: bagredex-local
```

These known credentials are safe only for the loopback-bound local review environment. Override
the port or credentials for one invocation when needed:

```bash
BAGREDEX_PORT=8080 \
BAGREDEX_REVIEW_USERNAME=reviewer \
BAGREDEX_REVIEW_PASSWORD='choose-a-local-password' \
./bagredex.sh review
```

Credential overrides must be nonempty and cannot contain control characters such as tabs or
newlines because the command prints them after the server is ready.

The pinned bundle is explicitly selected even when the retained database previously used another
version. Press `Ctrl+C` to remove the local containers. The named `bagredex-local-database` volume,
loaded data, and local accounts remain for the next run.

When Bagredex runs inside an Incus container, its loopback is separate from the host. On the Incus
host, add a loopback-only proxy whose container port matches `BAGREDEX_PORT`. This example exposes
container `bagredex-dev` port 8000 on host port 8080:

```bash
incus config device add bagredex-dev bagredex-review proxy \
  listen=tcp:127.0.0.1:8080 connect=tcp:127.0.0.1:8000
```

Remove the proxy after reviewing:

```bash
incus config device remove bagredex-dev bagredex-review
```

The review command does not invoke Incus, change firewall rules, or bind Bagredex beyond loopback.

## Publish images

Publishing requires a clean `main` checkout, Podman, a Docker Hub login, and a stable semantic
version. The command runs the full local check, creates an annotated local tag, builds both targets
for `linux/amd64`, then pushes the application image before the Nginx image:

```bash
./bagredex.sh publish 0.1.0
```

This publishes `docker.io/gabaconrado/bagredex:0.1.0` and
`docker.io/gabaconrado/bagredex-nginx:0.1.0`. It does not create `latest`, a remote Git tag, or any
other Git remote state. If only the first image is pushed, rerun the same version from the same
commit; an existing annotated tag is accepted only when it still points at `HEAD`.

## Prepare the production account

The default target is SSH alias `bagredex` and directory `/home/bagredex/bagredex`. Before the first
deployment, prepare that directory as the production account:

```text
/home/bagredex/bagredex/
└── shared/
    └── .env
```

Copy `deploy/env/production.env.example` to `shared/.env`, replace every placeholder, and restrict
it to the production account. The account also needs:

- Podman 4.9 or newer with a working Compose provider;
- `bash`, `curl`, `flock`, `rsync`, `ssh`, `systemctl`, `journalctl`, `getent`, and `ss`;
- user lingering enabled so user services run without a login session;
- rootless permission to bind ports 80 and 443;
- DNS for the one configured `BAGREDEX_DOMAIN` resolving to `BAGREDEX_EXPECTED_IP`;
- at least 1 GB RAM and 2 GB free space at the deployment directory;
- local availability of, or registry pull access for, every public image referenced by Compose:
  pinned PostgreSQL, pinned Certbot, and both versioned Bagredex application and Nginx images.

Host provisioning, firewall changes, DNS, SSH hardening, package installation, registry
authentication, and lingering configuration are intentionally manual host-administration tasks.
The scripts never invoke `sudo`.

`BAGREDEX_DOMAIN` must be the raw lowercase ASCII fully qualified hostname: at least two valid DNS
labels separated by a dot, no scheme, port, path, wildcard, trailing dot, uppercase character, or
internationalized Unicode form. Its final label must begin with a letter. This exact value is used
for Django host validation, Nginx routing, Certbot issuance, and certificate paths.

The five `BAGREDEX_DATABASE_*` values configure both Django and PostgreSQL. Keep the database host
as the private Compose service name `database` and the port as `5432`; neither is published on the
host. Use a strong, unique database password and keep `shared/.env` readable only by the production
account. PostgreSQL initialization values are used only when `bagredex-database` is empty. Editing
them later does not rotate credentials in an existing database; credential rotation is a separate,
operator-managed database change.

## Deploy and bootstrap TLS

Deploy only a version whose annotated local `vVERSION` tag points at the clean `main` `HEAD`:

```bash
./bagredex.sh deploy 0.1.0 --dry-run
./bagredex.sh deploy 0.1.0
```

Override the target independently when needed:

```bash
DEPLOY_SSH_TARGET=bagredex-production \
DEPLOY_REMOTE_DIR=/home/bagredex/bagredex \
./bagredex.sh deploy 0.1.0
```

The dry run opens SSH only for a read-only host preflight; it does not copy files or mutate remote
state. A real deployment creates a timestamped release, transfers only deployment assets and
release metadata, acquires a nonblocking deployment lock, pulls the pinned database and versioned
application images, checks Django, starts PostgreSQL, waits for database health, and applies
migrations from the new application image. It then validates and idempotently loads the bundle
pinned in `deploy/pokemon-data.env`, followed by `activate_pokemon_data --if-none`. Only then does
it stop the old application and switch `current`. A migration, load, or initial-activation failure
therefore leaves the current release serving. The first release uses
an HTTP-only Nginx bootstrap container to obtain the single-domain certificate, fixes certificate
read permissions for unprivileged Nginx, then starts the HTTPS proxy. HTTP serves ACME challenges
and redirects all other requests to HTTPS.

The deployment succeeds only after internal readiness and public `/health/live` checks pass.
`/health/ready` is deliberately unavailable through production Nginx. On failure after the switch,
the new application is stopped and `current` is restored to the prior release. With no prior
release, the failed application remains stopped and `current` is removed. PostgreSQL and its named
volume are not rolled back or deleted. This feature's migrations are additive; future releases must
preserve schema compatibility across application rollback. After success, only `current` and
`previous` release directories are retained.

`--if-none` is deliberately limited to first bootstrap. A deployment against a database that
already has an active version leaves that pointer unchanged, even when the image pins a newer
bundle. Loading the same reviewed bundle again is an idempotent no-op. Application rollback never
deletes loaded versions, changes the active pointer, or removes committed prior bundles from the
image.

## Manage Pokémon data versions

Builds require the three user-supplied local reference repositories and the exact tools documented
in `src/data/README.md`; production does not contain those inputs. After reviewing and committing a
new bundle, update `deploy/pokemon-data.env` in the same release. The current pin is
`showdown-multi-s3-i4-5073b2ab1402`, whose canonical bundle hash is
`5073b2ab1402a90ec951e0b4ccc123956998b40092d7d74c26b50e9736a61267`.

From a prepared source checkout, build the deterministic bundle with:

```bash
uv --directory src/backend run python manage.py build_pokemon_data \
  --showdown references/pokemon-showdown \
  --sprites references/sprites \
  --pokeapi references/pokeapi
```

Deployment performs the strict load automatically. To validate and idempotently load a committed
bundle manually in production, use the production Compose environment shown below and run:

```bash
podman compose -p bagredex \
  -f current/deploy/compose.yaml \
  -f current/deploy/compose.production.yaml \
  exec server python manage.py load_pokemon_data /app/src/data/releases/BUNDLE_ID
```

To expose Regulation M-A on an existing installation, explicitly activate the loaded multi-source
release with the production Compose environment shown in the administrator example below:

```bash
podman compose -p bagredex \
  -f current/deploy/compose.yaml \
  -f current/deploy/compose.production.yaml \
  exec server python manage.py activate_pokemon_data showdown-multi-s3-i4-5073b2ab1402
```

Rollback uses the same command with a retained, validated release. For example, return to the
preceding M-B/M-C release with:

```bash
podman compose -p bagredex \
  -f current/deploy/compose.yaml \
  -f current/deploy/compose.production.yaml \
  exec server python manage.py activate_pokemon_data showdown-multi-s2-i3-fc85b358deaa
```

Activation moves the singleton pointer atomically and retains both database versions and their
activation audit.
Deploying application code afterward does not auto-select another bundle. Never delete a retained
bundle from source or its loaded database rows while an application rollback may still need it.

## Create and manage administrators

After the first production deployment, create the first superuser interactively inside the running
server container. From the production deployment directory, load the protected configuration so
Compose can resolve it, then run Django's command:

```bash
set -a
. shared/.env
. current/release.env
set +a
podman compose -p bagredex \
  -f current/deploy/compose.yaml \
  -f current/deploy/compose.production.yaml \
  exec server python manage.py createsuperuser
```

No credentials belong in Compose files, release metadata, shell history, fixtures, or repository
documentation. Sign in at `/admin/` with that account and use the standard Users administration to
create later accounts. Set `is_staff` only for administrators who need admin access; ordinary active
users can sign in to Bagredex without it. There is no signup or email password-recovery workflow.

## User services and renewal

After the first successful deployment, copy the files from `deploy/systemd` into
`~/.config/systemd/user/` on the production account, reload the user manager, and enable the
application service and renewal timer. These are deliberate human-run production operations:

```bash
systemctl --user daemon-reload
systemctl --user enable --now bagredex.service
systemctl --user enable --now bagredex-certbot.timer
```

The checked-in units assume the default `/home/bagredex/bagredex` deployment directory through
`%h/bagredex`. If `DEPLOY_REMOTE_DIR` is overridden, edit all `WorkingDirectory`, `ExecStart`, and
`ExecStop` paths in the copied units to match before enabling them.

The timer runs twice daily with randomized delay. Certbot renews through the webroot and Nginx is
reloaded afterward. Inspect operations with `systemctl --user status` and `journalctl --user`.

## Layout and configuration

- `compose.yaml` defines PostgreSQL, its health check and named volume, the private application
  network, and the server readiness probe.
- `compose.local.yaml` supplies development-only database values and builds the development server.
- `compose.production.yaml` selects versioned images and defines Nginx and Certbot.
- `Containerfile` provides separate `application` and `nginx` targets.
- `scripts/remote-release-worker.sh` owns the release transition and rollback.
- `shared/.env` is stable secret configuration and never belongs in a release directory.
- `release.env` records the release ID, image version, commit, and source branch.

Normal Compose shutdown, failed deployment, and application rollback retain the explicitly named
`bagredex-database` volume. Do not use `podman compose down --volumes` or manually remove the
volume. Application rollback never reverses migrations. There is currently no automated backup or
point-in-time recovery, so host or volume loss can permanently destroy accounts and sessions. Add a
reviewed persistence-operations workflow before storing irreplaceable user content.

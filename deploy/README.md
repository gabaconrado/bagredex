# Bagredex deployment

Bagredex runs as a database-free Django application behind Nginx. Rootless Podman Compose owns the
application, Nginx, and on-demand Certbot containers. Production releases are immutable directories
with `current` and `previous` symlinks; a failed release automatically attempts to restart the
previous one.

The scripts in this directory support human-operated publishing and deployment. Project agents may
validate local behavior, but they do not log in to a registry, push images, open SSH connections,
contact Let's Encrypt, or modify a production host.

## Local run

Install the pinned Python and uv versions plus Podman with a Compose provider. Then run:

```bash
./bagredex.sh run
```

The command builds the application image, attaches to the stack, and publishes it only at
`http://127.0.0.1:8000`. Press `Ctrl+C` to stop and remove the local container. Set `BAGREDEX_PORT`
to choose another loopback port.

`./bagredex.sh check` runs backend, documentation, shell, and deployment tests. uv uses the ignored
repository-local `.cache/uv` directory by default. It never installs missing host tools.

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
- registry access sufficient to pull both public versioned images.

Host provisioning, firewall changes, DNS, SSH hardening, package installation, registry
authentication, and lingering configuration are intentionally manual host-administration tasks.
The scripts never invoke `sudo`.

`BAGREDEX_DOMAIN` must be the raw lowercase ASCII fully qualified hostname: at least two valid DNS
labels separated by a dot, no scheme, port, path, wildcard, trailing dot, uppercase character, or
internationalized Unicode form. Its final label must begin with a letter. This exact value is used
for Django host validation, Nginx routing, Certbot issuance, and certificate paths.

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
release metadata, acquires a nonblocking deployment lock, pulls both images, checks Django, and
switches `current`. The first release uses an HTTP-only Nginx bootstrap container to obtain the
single-domain certificate, fixes certificate read permissions for unprivileged Nginx, then starts
the HTTPS proxy. HTTP serves ACME challenges and redirects all other requests to HTTPS.

The deployment succeeds only after internal readiness and public `/health/live` checks pass.
`/health/ready` is deliberately unavailable through production Nginx. On failure after mutation,
the new stack is stopped and `current` is restored to the prior release. With no prior release, the
failed stack remains stopped and `current` is removed. After success, only `current` and `previous`
release directories are retained.

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

- `compose.yaml` defines the application network and readiness probe.
- `compose.local.yaml` builds and publishes only the development server.
- `compose.production.yaml` selects versioned images and defines Nginx and Certbot.
- `Containerfile` provides separate `application` and `nginx` targets.
- `scripts/remote-release-worker.sh` owns the release transition and rollback.
- `shared/.env` is stable secret configuration and never belongs in a release directory.
- `release.env` records the release ID, image version, commit, and source branch.

There is no database, migration, backup, or persistent application-data path in this slice.
